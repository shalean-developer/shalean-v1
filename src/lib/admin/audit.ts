import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

export const ADMIN_BOOKING_ASSIST_ACTIONS = {
  bookingCreated: "booking_created",
  bookingCreateReused: "booking_create_reused",
  invoiceCreated: "invoice_created",
  invoiceSent: "invoice_sent",
  paymentRecorded: "payment_recorded",
  paymentReversed: "payment_reversed",
  cleanerDispatched: "cleaner_dispatched",
  zohoSyncFailed: "zoho_sync_failed",
  zohoSyncSuccessful: "zoho_sync_successful",
} as const;

export type AdminBookingAssistAction =
  (typeof ADMIN_BOOKING_ASSIST_ACTIONS)[keyof typeof ADMIN_BOOKING_ASSIST_ACTIONS];

export type LogAdminBookingAssistAuditInput = {
  adminProfileId: string;
  customerId: string;
  bookingId?: string | null;
  action: AdminBookingAssistAction | string;
  idempotencyKey?: string | null;
  payload?: Record<string, unknown>;
};

/**
 * Append-only admin booking assist audit (service_role). Never throws — logging
 * must not block booking or payment flows.
 */
export async function logAdminBookingAssistAudit(
  supabase: Supabase,
  input: LogAdminBookingAssistAuditInput,
): Promise<void> {
  const payload = (input.payload ?? {}) as Json;
  const logPayload = {
    action: input.action,
    booking_id: input.bookingId ?? null,
    customer_id: input.customerId,
    admin_profile_id: input.adminProfileId,
    idempotency_key: input.idempotencyKey ?? null,
    ...input.payload,
  };

  console.info("ADMIN_BOOKING_ASSIST", logPayload);

  try {
    const result = await supabase.from("admin_booking_assist_audit").insert({
      admin_profile_id: input.adminProfileId,
      customer_id: input.customerId,
      booking_id: input.bookingId ?? null,
      action: input.action,
      idempotency_key: input.idempotencyKey ?? `no-key:${input.action}:${Date.now()}`,
      payload,
    });
    if (result.error) {
      console.error("ADMIN_BOOKING_ASSIST_AUDIT_INSERT_FAILED", result.error.message);
    }
  } catch (error) {
    console.error(
      "ADMIN_BOOKING_ASSIST_AUDIT_INSERT_FAILED",
      error instanceof Error ? error.message : String(error),
    );
  }
}
