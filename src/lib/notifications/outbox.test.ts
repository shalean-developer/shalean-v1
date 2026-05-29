import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SendEmailResult } from "@/lib/email/client";
import {
  MAX_NOTIFICATION_ATTEMPTS,
  computeBackoffMs,
  enqueueNotification,
  processNotificationOutbox,
} from "./outbox";

// ---------------------------------------------------------------------------
// Minimal in-memory PostgREST-ish fake supporting only the chains the worker uses.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function buildOrPredicate(expr: string): (row: Row) => boolean {
  const clauses: Array<(row: Row) => boolean> = [];
  for (const part of expr.split(",")) {
    if (part.endsWith(".is.null")) {
      const col = part.slice(0, -".is.null".length);
      clauses.push((row) => row[col] == null);
    } else {
      const idx = part.indexOf(".lte.");
      if (idx >= 0) {
        const col = part.slice(0, idx);
        const value = part.slice(idx + ".lte.".length);
        clauses.push((row) => row[col] != null && String(row[col]) <= value);
      }
    }
  }
  return (row) => clauses.some((clause) => clause(row));
}

class FakeBuilder {
  private op: "select" | "insert" | "update" = "select";
  private preds: Array<(row: Row) => boolean> = [];
  private orPred: ((row: Row) => boolean) | null = null;
  private values: Row | Row[] | null = null;
  private orderCol: string | null = null;
  private limitN: number | null = null;
  private selectAfter = false;
  private singleMode: "maybe" | "single" | null = null;

  constructor(
    private store: Record<string, Row[]>,
    private table: string,
    private genId: () => string,
  ) {}

  select() {
    this.selectAfter = true;
    return this;
  }
  insert(values: Row | Row[]) {
    this.op = "insert";
    this.values = values;
    return this;
  }
  update(values: Row) {
    this.op = "update";
    this.values = values;
    return this;
  }
  eq(col: string, val: unknown) {
    this.preds.push((row) => row[col] === val);
    return this;
  }
  lt(col: string, val: string) {
    this.preds.push((row) => row[col] != null && String(row[col]) < val);
    return this;
  }
  or(expr: string) {
    this.orPred = buildOrPredicate(expr);
    return this;
  }
  order(col: string) {
    this.orderCol = col;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return Promise.resolve(this.run());
  }
  single() {
    this.singleMode = "single";
    return Promise.resolve(this.run());
  }
  then(resolve: (value: { data: unknown; error: null }) => void) {
    resolve(this.run());
  }

  private match(): Row[] {
    let rows = (this.store[this.table] ?? []).filter(
      (row) => this.preds.every((p) => p(row)) && (this.orPred ? this.orPred(row) : true),
    );
    if (this.orderCol) {
      const col = this.orderCol;
      rows = [...rows].sort((a, b) => (String(a[col]) > String(b[col]) ? 1 : -1));
    }
    if (this.limitN != null) {
      rows = rows.slice(0, this.limitN);
    }
    return rows;
  }

  private run(): { data: unknown; error: null } {
    if (this.op === "insert") {
      const arr = Array.isArray(this.values) ? this.values : [this.values as Row];
      const inserted = arr.map((v) => {
        const row: Row = {
          id: this.genId(),
          attempts: 0,
          next_retry_at: null,
          last_error: null,
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...v,
        };
        (this.store[this.table] ??= []).push(row);
        return row;
      });
      return { data: inserted, error: null };
    }
    if (this.op === "update") {
      const matched = this.match();
      matched.forEach((row) => Object.assign(row, this.values));
      if (this.singleMode) {
        return { data: matched[0] ?? null, error: null };
      }
      return { data: this.selectAfter ? matched : null, error: null };
    }
    const rows = this.match();
    if (this.singleMode) {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }
}

function makeFakeSupabase() {
  const store: Record<string, Row[]> = {
    notification_outbox: [],
    notification_worker_runs: [],
  };
  let seq = 0;
  const client = {
    from(table: string) {
      return new FakeBuilder(store, table, () => `row-${++seq}`);
    },
  };
  return { store, client: client as unknown as SupabaseClient<Database> };
}

const okResend = (): Promise<SendEmailResult> =>
  Promise.resolve({ ok: true, id: "re_123", provider: "resend" });
const dryRun = (): Promise<SendEmailResult> =>
  Promise.resolve({ ok: true, skipped: true, provider: "dry_run" });
const failResend = (): Promise<SendEmailResult> =>
  Promise.resolve({ ok: false, error: "boom", provider: "resend" });

function seedRow(store: Record<string, Row[]>, overrides: Row = {}) {
  const row: Row = {
    id: `seed-${store.notification_outbox.length + 1}`,
    channel: "email",
    recipient: "customer@shalean.com",
    payload: { type: "payment_received", data: { customerName: "T", bookingReference: "SHL-1", serviceName: "Regular Cleaning", amountCents: 1000 } },
    status: "pending",
    attempts: 0,
    next_retry_at: null,
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
  store.notification_outbox.push(row);
  return row;
}

describe("computeBackoffMs", () => {
  it("doubles per attempt and caps at one hour", () => {
    expect(computeBackoffMs(1)).toBe(60_000);
    expect(computeBackoffMs(2)).toBe(120_000);
    expect(computeBackoffMs(3)).toBe(240_000);
    expect(computeBackoffMs(50)).toBe(60 * 60 * 1000);
  });
});

describe("enqueueNotification", () => {
  it("writes a pending email row", async () => {
    const { store, client } = makeFakeSupabase();
    const ok = await enqueueNotification(client, {
      type: "booking_confirmation",
      to: "customer@shalean.com",
      data: { customerName: "T" },
    });
    expect(ok).toBe(true);
    expect(store.notification_outbox).toHaveLength(1);
    const row = store.notification_outbox[0];
    expect(row.channel).toBe("email");
    expect(row.recipient).toBe("customer@shalean.com");
    expect(row.status).toBe("pending");
    expect((row.payload as { type: string }).type).toBe("booking_confirmation");
  });

  it("skips invalid recipients without inserting", async () => {
    const { store, client } = makeFakeSupabase();
    const ok = await enqueueNotification(client, {
      type: "booking_confirmation",
      to: "not-an-email",
      data: {},
    });
    expect(ok).toBe(false);
    expect(store.notification_outbox).toHaveLength(0);
  });
});

describe("processNotificationOutbox", () => {
  it("marks a row sent on successful delivery", async () => {
    const { store, client } = makeFakeSupabase();
    seedRow(store);
    const summary = await processNotificationOutbox(client, { send: okResend, deliveryEnabled: true, recordRun: false });
    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(0);
    expect(store.notification_outbox[0].status).toBe("sent");
  });

  it("counts dry-run deliveries separately and still marks sent", async () => {
    const { store, client } = makeFakeSupabase();
    seedRow(store);
    const summary = await processNotificationOutbox(client, { send: dryRun, deliveryEnabled: false, recordRun: false });
    expect(summary.dryRun).toBe(1);
    expect(summary.sent).toBe(0);
    expect(store.notification_outbox[0].status).toBe("sent");
  });

  it("reschedules with backoff on a retryable failure", async () => {
    const { store, client } = makeFakeSupabase();
    seedRow(store);
    const now = new Date("2026-05-29T00:00:00.000Z");
    const summary = await processNotificationOutbox(client, { send: failResend, now, recordRun: false });
    expect(summary.failed).toBe(1);
    const row = store.notification_outbox[0];
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(1);
    expect(row.last_error).toBe("boom");
    expect(row.next_retry_at).toBe(new Date(now.getTime() + 60_000).toISOString());
  });

  it("marks failed terminally after the max attempts", async () => {
    const { store, client } = makeFakeSupabase();
    seedRow(store, { attempts: MAX_NOTIFICATION_ATTEMPTS - 1 });
    const summary = await processNotificationOutbox(client, { send: failResend, recordRun: false });
    expect(summary.failed).toBe(1);
    const row = store.notification_outbox[0];
    expect(row.status).toBe("failed");
    expect(row.attempts).toBe(MAX_NOTIFICATION_ATTEMPTS);
    expect(row.next_retry_at).toBeNull();
  });

  it("fails terminally (no retry) for an unknown notification type", async () => {
    const { store, client } = makeFakeSupabase();
    seedRow(store, { payload: { type: "totally_unknown", data: {} } });
    const sender = vi.fn(okResend);
    const summary = await processNotificationOutbox(client, { send: sender, recordRun: false });
    expect(sender).not.toHaveBeenCalled();
    expect(summary.failed).toBe(1);
    expect(store.notification_outbox[0].status).toBe("failed");
    expect(store.notification_outbox[0].attempts).toBe(0);
  });

  it("does not pick up rows whose next_retry_at is in the future", async () => {
    const { store, client } = makeFakeSupabase();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    seedRow(store, { next_retry_at: future });
    const sender = vi.fn(okResend);
    const summary = await processNotificationOutbox(client, { send: sender, now: new Date(), recordRun: false });
    expect(summary.scanned).toBe(0);
    expect(sender).not.toHaveBeenCalled();
  });

  it("writes a worker run log when recordRun is enabled", async () => {
    const { store, client } = makeFakeSupabase();
    seedRow(store);
    await processNotificationOutbox(client, { send: okResend, deliveryEnabled: true, recordRun: true, triggerSource: "manual" });
    expect(store.notification_worker_runs).toHaveLength(1);
    const run = store.notification_worker_runs[0];
    expect(run.sent).toBe(1);
    expect(run.email_provider).toBe("resend");
    expect(run.trigger_source).toBe("manual");
  });

  it("never throws even if the sender throws", async () => {
    const { store, client } = makeFakeSupabase();
    seedRow(store);
    const throwing = () => {
      throw new Error("network down");
    };
    await expect(
      processNotificationOutbox(client, { send: throwing as never, recordRun: false }),
    ).resolves.toBeDefined();
  });
});
