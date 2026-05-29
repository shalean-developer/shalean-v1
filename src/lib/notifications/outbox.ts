// Durable notification delivery on top of the existing notification_outbox table.
//
// enqueueNotification() writes a pending row. processNotificationOutbox() drains
// due rows, renders the matching Shalean template, sends via Resend, and applies
// exponential backoff using the table's attempts / next_retry_at columns. Each
// run is logged to notification_worker_runs. Nothing here ever throws to callers.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { sendEmail, isResendConfigured, type SendEmailInput, type SendEmailResult } from "@/lib/email/client";
import { isNotificationType, renderNotification, type NotificationType } from "@/lib/email/templates";

type Supabase = SupabaseClient<Database>;

export const NOTIFICATION_CHANNEL_EMAIL = "email";
export const MAX_NOTIFICATION_ATTEMPTS = 5;
const DEFAULT_BATCH_LIMIT = 25;
const RECLAIM_STUCK_AFTER_MS = 10 * 60 * 1000;
const BACKOFF_BASE_MS = 60 * 1000; // 1 minute
const BACKOFF_CAP_MS = 60 * 60 * 1000; // 1 hour

export type NotificationPayload = {
  type: NotificationType;
  data: Record<string, unknown>;
  from?: string;
  replyTo?: string;
};

export type EnqueueNotificationInput = {
  type: NotificationType;
  to: string;
  data: Record<string, unknown>;
  from?: string;
  replyTo?: string;
};

/**
 * Exponential backoff (in ms) for the Nth attempt: 1m, 2m, 4m, 8m ... capped at
 * 1 hour. `attempts` is the number of attempts already made (>= 1).
 */
export function computeBackoffMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_CAP_MS);
}

export function computeNextRetryAt(attempts: number, now: Date): string {
  return new Date(now.getTime() + computeBackoffMs(attempts)).toISOString();
}

/**
 * Enqueue a single email notification. Never throws — returns false (and logs)
 * if the row could not be written, so a notification failure can never break the
 * business flow that triggered it.
 */
export async function enqueueNotification(
  supabase: Supabase,
  input: EnqueueNotificationInput,
): Promise<boolean> {
  const recipient = input.to?.trim();
  if (!recipient || !recipient.includes("@")) {
    console.warn("NOTIFICATION_ENQUEUE_SKIPPED_INVALID_RECIPIENT", { type: input.type });
    return false;
  }

  const payload: NotificationPayload = {
    type: input.type,
    data: input.data,
    ...(input.from ? { from: input.from } : {}),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  };

  try {
    const result = await supabase.from("notification_outbox").insert({
      channel: NOTIFICATION_CHANNEL_EMAIL,
      recipient,
      payload: payload as unknown as Json,
      status: "pending",
    });
    if (result.error) {
      console.error("NOTIFICATION_ENQUEUE_FAILED", { type: input.type, message: result.error.message });
      return false;
    }
    return true;
  } catch (error) {
    console.error("NOTIFICATION_ENQUEUE_UNEXPECTED", {
      type: input.type,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** Enqueue several notifications; returns the count successfully written. */
export async function enqueueNotifications(
  supabase: Supabase,
  inputs: EnqueueNotificationInput[],
): Promise<number> {
  let written = 0;
  for (const input of inputs) {
    if (await enqueueNotification(supabase, input)) {
      written += 1;
    }
  }
  return written;
}

export type WorkerSummary = {
  ok: boolean;
  reclaimed: number;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  dryRun: number;
  errorCount: number;
  errors: Array<{ id: string; error: string }>;
};

export type ProcessOptions = {
  limit?: number;
  now?: Date;
  triggerSource?: "cron" | "manual";
  /** Override the sender (used in tests). Defaults to the real Resend client. */
  send?: (input: SendEmailInput) => Promise<SendEmailResult>;
  /** Override delivery-enabled detection (used in tests). */
  deliveryEnabled?: boolean;
  /** Skip writing a notification_worker_runs row (used in tests). */
  recordRun?: boolean;
};

type OutboxRow = Database["public"]["Tables"]["notification_outbox"]["Row"];

/**
 * Process due rows from the notification outbox. Always resolves (never throws)
 * and returns a summary of the run.
 */
export async function processNotificationOutbox(
  supabase: Supabase,
  options: ProcessOptions = {},
): Promise<WorkerSummary> {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
  const send = options.send ?? sendEmail;
  const deliveryEnabled = options.deliveryEnabled ?? isResendConfigured();
  const triggerSource = options.triggerSource ?? "cron";
  const recordRun = options.recordRun ?? true;

  const summary: WorkerSummary = {
    ok: true,
    reclaimed: 0,
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    dryRun: 0,
    errorCount: 0,
    errors: [],
  };

  try {
    summary.reclaimed = await reclaimStuckRows(supabase, now);

    const dueRows = await selectDueRows(supabase, nowIso, limit);
    summary.scanned = dueRows.length;

    for (const row of dueRows) {
      const claimed = await claimRow(supabase, row.id, nowIso);
      if (!claimed) {
        continue; // another worker took it
      }

      const outcome = await deliverRow(row, send);

      if (outcome.kind === "sent") {
        summary.sent += 1;
        await markSent(supabase, row.id, nowIso);
      } else if (outcome.kind === "dry_run") {
        summary.dryRun += 1;
        await markSent(supabase, row.id, nowIso);
      } else if (outcome.kind === "terminal") {
        summary.failed += 1;
        summary.errorCount += 1;
        summary.errors.push({ id: row.id, error: outcome.error });
        await markFailedTerminal(supabase, row.id, nowIso, outcome.error);
      } else {
        // retryable failure
        summary.failed += 1;
        summary.errorCount += 1;
        summary.errors.push({ id: row.id, error: outcome.error });
        await scheduleRetry(supabase, row, nowIso, now, outcome.error);
      }
    }
  } catch (error) {
    // The worker must never throw; record the unexpected error instead.
    summary.ok = false;
    summary.errorCount += 1;
    const message = error instanceof Error ? error.message : String(error);
    summary.errors.push({ id: "worker", error: message });
    console.error("NOTIFICATION_WORKER_UNEXPECTED", { message });
  }

  summary.ok = summary.ok && summary.errorCount === 0;

  if (recordRun) {
    await recordWorkerRun(supabase, summary, {
      startedAt: nowIso,
      deliveryEnabled,
      triggerSource,
    });
  }

  return summary;
}

type DeliveryOutcome =
  | { kind: "sent" }
  | { kind: "dry_run" }
  | { kind: "retryable"; error: string }
  | { kind: "terminal"; error: string };

async function deliverRow(
  row: OutboxRow,
  send: (input: SendEmailInput) => Promise<SendEmailResult>,
): Promise<DeliveryOutcome> {
  const payload = parsePayload(row.payload);
  if (!payload) {
    return { kind: "terminal", error: "Invalid notification payload." };
  }
  if (!isNotificationType(payload.type)) {
    return { kind: "terminal", error: `Unknown notification type: ${String(payload.type)}` };
  }

  let content;
  try {
    content = renderNotification(payload.type, payload.data ?? {});
  } catch (error) {
    return {
      kind: "terminal",
      error: `Template render failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const result = await send({
    to: row.recipient,
    subject: content.subject,
    html: content.html,
    text: content.text,
    from: payload.from,
    replyTo: payload.replyTo,
  });

  if (result.ok && "skipped" in result) {
    return { kind: "dry_run" };
  }
  if (result.ok) {
    return { kind: "sent" };
  }
  return { kind: "retryable", error: result.error };
}

function parsePayload(payload: Json): NotificationPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.type !== "string") {
    return null;
  }
  const data = record.data;
  return {
    type: record.type as NotificationType,
    data: data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {},
    from: typeof record.from === "string" ? record.from : undefined,
    replyTo: typeof record.replyTo === "string" ? record.replyTo : undefined,
  };
}

async function reclaimStuckRows(supabase: Supabase, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - RECLAIM_STUCK_AFTER_MS).toISOString();
  const result = await supabase
    .from("notification_outbox")
    .update({ status: "pending", updated_at: now.toISOString() })
    .eq("status", "processing")
    .lt("updated_at", cutoff)
    .select("id");
  if (result.error) {
    console.error("NOTIFICATION_RECLAIM_FAILED", { message: result.error.message });
    return 0;
  }
  return result.data?.length ?? 0;
}

async function selectDueRows(supabase: Supabase, nowIso: string, limit: number): Promise<OutboxRow[]> {
  const result = await supabase
    .from("notification_outbox")
    .select("*")
    .eq("status", "pending")
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (result.error) {
    throw result.error;
  }
  return (result.data ?? []) as OutboxRow[];
}

async function claimRow(supabase: Supabase, id: string, nowIso: string): Promise<boolean> {
  const result = await supabase
    .from("notification_outbox")
    .update({ status: "processing", updated_at: nowIso })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (result.error) {
    console.error("NOTIFICATION_CLAIM_FAILED", { id, message: result.error.message });
    return false;
  }
  return Boolean(result.data);
}

async function markSent(supabase: Supabase, id: string, nowIso: string): Promise<void> {
  const result = await supabase
    .from("notification_outbox")
    .update({ status: "sent", last_error: null, updated_at: nowIso })
    .eq("id", id);
  if (result.error) {
    console.error("NOTIFICATION_MARK_SENT_FAILED", { id, message: result.error.message });
  }
}

async function markFailedTerminal(supabase: Supabase, id: string, nowIso: string, error: string): Promise<void> {
  const result = await supabase
    .from("notification_outbox")
    .update({ status: "failed", last_error: error.slice(0, 1000), updated_at: nowIso })
    .eq("id", id);
  if (result.error) {
    console.error("NOTIFICATION_MARK_FAILED_FAILED", { id, message: result.error.message });
  }
}

async function scheduleRetry(
  supabase: Supabase,
  row: OutboxRow,
  nowIso: string,
  now: Date,
  error: string,
): Promise<void> {
  const attempts = (row.attempts ?? 0) + 1;
  const terminal = attempts >= MAX_NOTIFICATION_ATTEMPTS;
  const result = await supabase
    .from("notification_outbox")
    .update({
      status: terminal ? "failed" : "pending",
      attempts,
      next_retry_at: terminal ? null : computeNextRetryAt(attempts, now),
      last_error: error.slice(0, 1000),
      updated_at: nowIso,
    })
    .eq("id", row.id);
  if (result.error) {
    console.error("NOTIFICATION_SCHEDULE_RETRY_FAILED", { id: row.id, message: result.error.message });
  }
}

async function recordWorkerRun(
  supabase: Supabase,
  summary: WorkerSummary,
  meta: { startedAt: string; deliveryEnabled: boolean; triggerSource: "cron" | "manual" },
): Promise<void> {
  try {
    const result = await supabase.from("notification_worker_runs").insert({
      started_at: meta.startedAt,
      ok: summary.ok,
      delivery_enabled: meta.deliveryEnabled,
      email_provider: meta.deliveryEnabled ? "resend" : "dry_run",
      trigger_source: meta.triggerSource,
      reclaimed: summary.reclaimed,
      scanned: summary.scanned,
      sent: summary.sent,
      skipped: summary.skipped,
      failed: summary.failed,
      dry_run: summary.dryRun,
      error_count: summary.errorCount,
      errors: summary.errors as unknown as Json,
    });
    if (result.error) {
      console.error("NOTIFICATION_WORKER_RUN_LOG_FAILED", { message: result.error.message });
    }
  } catch (error) {
    console.error("NOTIFICATION_WORKER_RUN_LOG_UNEXPECTED", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
