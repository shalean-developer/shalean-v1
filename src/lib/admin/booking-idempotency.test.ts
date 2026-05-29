import { describe, expect, it } from "vitest";
import {
  claimAdminBookingCreation,
  loadBookingIdsForIdempotencyKey,
} from "./booking-idempotency";

function makeSupabaseStub(state: {
  bookings: Array<{ id: string; booking_reference: string | null; occurrence_index: number }>;
  idempotencyRows: Map<string, Record<string, unknown>>;
  claimFails?: boolean;
}) {
  return {
    from(table: string) {
      const filters: Record<string, string> = {};
      let op: "select" | "insert" | "upsert" = "select";
      let payload: Record<string, unknown> | null = null;

      const builder: Record<string, unknown> = {
        select: () => builder,
        insert: (value: Record<string, unknown>) => {
          op = "insert";
          payload = value;
          return builder;
        },
        upsert: (value: Record<string, unknown>) => {
          op = "upsert";
          payload = value;
          return builder;
        },
        eq: (column: string, value: string) => {
          filters[column] = value;
          return builder;
        },
        order: () => builder,
        maybeSingle: async () => {
          if (table === "bookings" && op === "select") {
            if (filters.idempotency_key) {
              const matched = state.bookings;
              if (matched.length === 0) {
                return { data: null, error: null };
              }
              return { data: matched[0] ?? null, error: null };
            }
          }
          if (table === "admin_booking_assist_idempotency" && op === "select") {
            const row = state.idempotencyRows.get(filters.idempotency_key ?? "");
            return { data: row ?? null, error: null };
          }
          return { data: null, error: null };
        },
        then: (onF: (value: unknown) => unknown) => {
          if (table === "bookings" && op === "select") {
            const matched = filters.idempotency_key
              ? state.bookings
              : [];
            return Promise.resolve({ data: matched, error: null }).then(onF);
          }
          if (table === "admin_booking_assist_idempotency" && op === "insert") {
            const key = String(payload?.idempotency_key ?? "");
            if (state.idempotencyRows.has(key) || state.claimFails) {
              return Promise.resolve({
                data: null,
                error: { code: "23505", message: "duplicate key" },
              }).then(onF);
            }
            state.idempotencyRows.set(key, payload ?? {});
            return Promise.resolve({ data: null, error: null }).then(onF);
          }
          return Promise.resolve({ data: null, error: null }).then(onF);
        },
      };

      return builder;
    },
  } as never;
}

describe("loadBookingIdsForIdempotencyKey", () => {
  it("returns all occurrence rows for a key", async () => {
    const supabase = makeSupabaseStub({
      bookings: [
        { id: "b1", booking_reference: "SHL-AAA", occurrence_index: 0 },
        { id: "b2", booking_reference: "SHL-BBB", occurrence_index: 1 },
      ],
      idempotencyRows: new Map(),
    });

    const result = await loadBookingIdsForIdempotencyKey(supabase, "idem-1");
    expect(result?.bookingIds).toEqual(["b1", "b2"]);
    expect(result?.primaryBookingId).toBe("b1");
  });
});

describe("claimAdminBookingCreation", () => {
  it("reuses existing bookings without claiming", async () => {
    const supabase = makeSupabaseStub({
      bookings: [{ id: "b1", booking_reference: "SHL-AAA", occurrence_index: 0 }],
      idempotencyRows: new Map(),
    });

    const claim = await claimAdminBookingCreation(supabase, {
      idempotencyKey: "idem-1",
      adminProfileId: "admin-1",
      customerId: "cust-1",
    });

    expect(claim.status).toBe("reused");
    if (claim.status === "reused") {
      expect(claim.outcome.bookingIds).toEqual(["b1"]);
    }
  });

  it("claims a new key when no booking exists", async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const supabase = makeSupabaseStub({
      bookings: [],
      idempotencyRows: rows,
    });

    const claim = await claimAdminBookingCreation(supabase, {
      idempotencyKey: "idem-new",
      adminProfileId: "admin-1",
      customerId: "cust-1",
    });

    expect(claim.status).toBe("create");
    expect(rows.has("idem-new")).toBe(true);
  });
});
