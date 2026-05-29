import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

export type AdminBookingIdempotencyResult = {
  bookingIds: string[];
  bookingReferences: string[];
  primaryBookingId: string;
};

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" || /duplicate key/i.test(error?.message ?? "");
}

export async function loadBookingIdsForIdempotencyKey(
  supabase: Supabase,
  idempotencyKey: string,
): Promise<AdminBookingIdempotencyResult | null> {
  const result = await supabase
    .from("bookings")
    .select("id, booking_reference, occurrence_index")
    .eq("idempotency_key", idempotencyKey)
    .order("occurrence_index", { ascending: true });

  if (result.error) throw result.error;
  const rows = result.data ?? [];
  if (rows.length === 0) {
    return null;
  }

  const bookingIds = rows.map((row) => row.id);
  const bookingReferences = rows
    .map((row) => row.booking_reference)
    .filter((value): value is string => Boolean(value));

  return {
    bookingIds,
    bookingReferences,
    primaryBookingId: bookingIds[0]!,
  };
}

export async function readAdminBookingIdempotencyOutcome(
  supabase: Supabase,
  idempotencyKey: string,
): Promise<AdminBookingIdempotencyResult | null> {
  const result = await supabase
    .from("admin_booking_assist_idempotency")
    .select("result")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (result.error) throw result.error;
  if (!result.data?.result || typeof result.data.result !== "object") {
    return null;
  }

  const stored = result.data.result as Record<string, unknown>;
  const bookingIds = Array.isArray(stored.bookingIds)
    ? stored.bookingIds.filter((id): id is string => typeof id === "string")
    : [];
  if (bookingIds.length === 0) {
    return null;
  }

  const bookingReferences = Array.isArray(stored.bookingReferences)
    ? stored.bookingReferences.filter((ref): ref is string => typeof ref === "string")
    : [];

  return {
    bookingIds,
    bookingReferences,
    primaryBookingId: typeof stored.primaryBookingId === "string"
      ? stored.primaryBookingId
      : bookingIds[0]!,
  };
}

export async function persistAdminBookingIdempotencyOutcome(
  supabase: Supabase,
  input: {
    idempotencyKey: string;
    adminProfileId: string;
    customerId: string;
    outcome: AdminBookingIdempotencyResult;
  },
): Promise<void> {
  const result: Json = {
    bookingIds: input.outcome.bookingIds,
    bookingReferences: input.outcome.bookingReferences,
    primaryBookingId: input.outcome.primaryBookingId,
    storedAt: new Date().toISOString(),
  };

  const upsert = await supabase.from("admin_booking_assist_idempotency").upsert({
    idempotency_key: input.idempotencyKey,
    admin_profile_id: input.adminProfileId,
    customer_id: input.customerId,
    result,
  });

  if (upsert.error && !isUniqueViolation(upsert.error)) {
    throw upsert.error;
  }
}

/**
 * Claim an idempotency key before insert. Returns existing outcome when the key
 * was already used (bookings or stored idempotency row).
 */
export async function claimAdminBookingCreation(
  supabase: Supabase,
  input: { idempotencyKey: string; adminProfileId: string; customerId: string },
): Promise<{ status: "create" } | { status: "reused"; outcome: AdminBookingIdempotencyResult }> {
  const fromBookings = await loadBookingIdsForIdempotencyKey(supabase, input.idempotencyKey);
  if (fromBookings) {
    return { status: "reused", outcome: fromBookings };
  }

  const fromStore = await readAdminBookingIdempotencyOutcome(supabase, input.idempotencyKey);
  if (fromStore) {
    const hydrated = await loadBookingIdsForIdempotencyKey(supabase, input.idempotencyKey);
    return { status: "reused", outcome: hydrated ?? fromStore };
  }

  const claim = await supabase.from("admin_booking_assist_idempotency").insert({
    idempotency_key: input.idempotencyKey,
    admin_profile_id: input.adminProfileId,
    customer_id: input.customerId,
    result: { status: "in_progress" } as Json,
  });

  if (claim.error) {
    if (isUniqueViolation(claim.error)) {
      const raced = await loadBookingIdsForIdempotencyKey(supabase, input.idempotencyKey);
      if (raced) {
        return { status: "reused", outcome: raced };
      }
      const stored = await readAdminBookingIdempotencyOutcome(supabase, input.idempotencyKey);
      if (stored) {
        return { status: "reused", outcome: stored };
      }
    }
    throw claim.error;
  }

  return { status: "create" };
}
