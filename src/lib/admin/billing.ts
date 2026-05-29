// Admin-assisted booking billing orchestration (server-only).
//
// This module connects the admin booking flow to the SAME Paystack + Zoho Books
// integration used by the customer /book checkout, but with admin-specific
// behavior: the booking is created first, an UNPAID Zoho invoice + Paystack
// payment link are issued, the customer is sent the link, and the booking/invoice
// are marked paid later (online via the Paystack webhook, or offline via an
// admin-recorded manual payment).
//
// SECURITY: all Paystack/Zoho calls happen server-side here. Callers (admin
// server actions) are responsible for requireAdmin() authentication. None of the
// helpers below ever throw — each returns a structured result so a Zoho/Paystack
// outage can never break booking creation or the admin UI.

import type { SupabaseClient } from "@supabase/supabase-js";
import { appUrl } from "@/lib/config/site";
import { initializePaystackTransaction } from "@/lib/payments/paystack";
import { reconcilePaystackPayment } from "@/lib/payments/reconciliation";
import type { Database, Json } from "@/lib/supabase/database.types";
import { notifyPaymentLink, notifyPaymentReceived } from "@/lib/notifications/triggers";
import { dispatchCleanersForPaidBooking } from "@/lib/regular-cleaning/dispatch";
import { ADMIN_BOOKING_ASSIST_ACTIONS, logAdminBookingAssistAudit } from "@/lib/admin/audit";
import { syncBookingToZohoBooks, voidZohoInvoiceForBooking } from "@/lib/zoho/books";

type Supabase = SupabaseClient<Database>;
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

export const ADMIN_PAYMENT_METHODS = ["paystack", "eft", "cash", "card", "corporate", "other"] as const;
export type AdminPaymentMethod = (typeof ADMIN_PAYMENT_METHODS)[number];

export function isAdminPaymentMethod(value: string): value is AdminPaymentMethod {
  return (ADMIN_PAYMENT_METHODS as readonly string[]).includes(value);
}

/** Map an admin payment method to the closest Zoho Books payment mode. */
export function zohoPaymentModeFor(method: AdminPaymentMethod): string {
  switch (method) {
    case "eft":
      return "banktransfer";
    case "cash":
      return "cash";
    case "card":
      return "creditcard";
    case "corporate":
      return "banktransfer";
    case "paystack":
      return "banktransfer";
    default:
      return "banktransfer";
  }
}

/** Amount owed for a booking: the series total (recurring) or per-booking total. */
export function bookingAmountDueCents(booking: Pick<BookingRow, "series_total_cents" | "final_total_cents" | "amount_due_cents">): number {
  return booking.amount_due_cents ?? booking.series_total_cents ?? booking.final_total_cents;
}

// ---------------------------------------------------------------------------
// Pure helper (unit-tested): compute the booking field updates for a payment.
// Kept side-effect free so the money math is verifiable without a database.
// ---------------------------------------------------------------------------

export type ManualPaymentUpdate = {
  payment_status: "paid" | "partially_paid";
  booking_status?: string;
  amount_paid_cents: number;
  balance_remaining_cents: number;
  fullyPaid: boolean;
};

export function computeManualPaymentUpdate(input: {
  amountDueCents: number;
  alreadyPaidCents: number;
  newPaymentCents: number;
}): ManualPaymentUpdate {
  const amountDue = Math.max(0, Math.round(input.amountDueCents));
  const totalPaid = Math.max(0, Math.round(input.alreadyPaidCents)) + Math.max(0, Math.round(input.newPaymentCents));
  const balance = Math.max(0, amountDue - totalPaid);
  const fullyPaid = totalPaid >= amountDue && amountDue > 0;

  return {
    payment_status: fullyPaid ? "paid" : "partially_paid",
    booking_status: fullyPaid ? "confirmed" : undefined,
    amount_paid_cents: totalPaid,
    balance_remaining_cents: balance,
    fullyPaid,
  };
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

async function loadBookingWithCustomer(
  supabase: Supabase,
  bookingId: string,
): Promise<{ booking: BookingRow; customer: CustomerRow | null } | null> {
  const bookingResult = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (bookingResult.error) throw bookingResult.error;
  if (!bookingResult.data) return null;
  const booking = bookingResult.data;

  let customer: CustomerRow | null = null;
  if (booking.customer_id) {
    const customerResult = await supabase
      .from("customers")
      .select("*")
      .eq("id", booking.customer_id)
      .maybeSingle();
    if (customerResult.error) throw customerResult.error;
    customer = customerResult.data;
  }
  return { booking, customer };
}

function bookingForNotification(booking: BookingRow) {
  return {
    id: booking.id,
    service_slug: booking.service_slug,
    booking_date: booking.booking_date,
    booking_time: booking.booking_time,
    suburb: booking.suburb,
    address: booking.address,
    final_total_cents: booking.final_total_cents,
  };
}

// ---------------------------------------------------------------------------
// Unpaid invoice
// ---------------------------------------------------------------------------

/**
 * Create (or reuse) an UNPAID Zoho Books invoice for an admin-created booking.
 * Reuses the shared syncBookingToZohoBooks engine in allowUnpaid mode so the
 * exact same invoice payload/mapping as the customer flow is used.
 */
export async function createUnpaidInvoiceForBooking(
  supabase: Supabase,
  bookingId: string,
  options?: { force?: boolean },
) {
  return syncBookingToZohoBooks(bookingId, {
    supabase,
    allowUnpaid: true,
    force: options?.force ?? false,
  });
}

// ---------------------------------------------------------------------------
// Paystack payment link
// ---------------------------------------------------------------------------

export type PaymentLinkResult =
  | { ok: true; authorizationUrl: string; reference: string; reused: boolean; alreadyPaid?: false }
  | { ok: true; alreadyPaid: true }
  | { ok: false; error: string };

/**
 * Initialize (or reuse) a Paystack payment link for a booking and persist the
 * reference + authorization URL on the booking. Mirrors the customer checkout's
 * Paystack initialize so the existing webhook/callback reconciliation works
 * unchanged for admin-created bookings. Never creates a new booking.
 */
export async function ensurePaystackPaymentLink(
  supabase: Supabase,
  bookingId: string,
  options?: { force?: boolean },
): Promise<PaymentLinkResult> {
  try {
    const loaded = await loadBookingWithCustomer(supabase, bookingId);
    if (!loaded) return { ok: false, error: "Booking not found." };
    const { booking, customer } = loaded;

    if (booking.payment_status === "paid") {
      return { ok: true, alreadyPaid: true };
    }

    if (!options?.force && booking.paystack_authorization_url && booking.paystack_reference) {
      return {
        ok: true,
        authorizationUrl: booking.paystack_authorization_url,
        reference: booking.paystack_reference,
        reused: true,
      };
    }

    const email = customer?.email?.trim();
    if (!email || !email.includes("@")) {
      return { ok: false, error: "Customer email is required to create a payment link." };
    }

    const amountCents = bookingAmountDueCents(booking);
    const callbackUrl = `${appUrl()}/dashboard?payment=paystack&booking=${booking.id}`;
    const transaction = await initializePaystackTransaction({
      email,
      amountCents,
      bookingId: booking.id,
      callbackUrl,
    });
    const reference = transaction.data.reference;
    const authorizationUrl = transaction.data.authorization_url;

    // Upsert a pending payments row so the shared reconciliation can settle it.
    const idempotencyKey = booking.idempotency_key ?? `admin-${booking.id}`;
    const paymentPayload = {
      booking_id: booking.id,
      checkout_session_id: booking.checkout_session_id ?? idempotencyKey,
      status: "pending",
      provider: "paystack",
      provider_ref: reference,
      provider_reference: reference,
      idempotency_key: idempotencyKey,
      amount_cents: amountCents,
      currency: "ZAR",
      metadata: {
        accessCode: transaction.data.access_code,
        authorizationUrl,
        bookingId: booking.id,
        source: "admin",
      } as Json,
    };

    const existingPayment = await supabase
      .from("payments")
      .select("id")
      .eq("booking_id", booking.id)
      .eq("provider", "paystack")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingPayment.error) throw existingPayment.error;

    const paymentResult = existingPayment.data
      ? await supabase.from("payments").update(paymentPayload).eq("id", existingPayment.data.id)
      : await supabase.from("payments").insert(paymentPayload);
    if (paymentResult.error) throw paymentResult.error;

    const bookingUpdate = await supabase
      .from("bookings")
      .update({
        paystack_reference: reference,
        paystack_authorization_url: authorizationUrl,
        amount_due_cents: amountCents,
        balance_remaining_cents: booking.amount_paid_cents > 0 ? Math.max(0, amountCents - booking.amount_paid_cents) : amountCents,
      })
      .eq("id", booking.id);
    if (bookingUpdate.error) throw bookingUpdate.error;

    return { ok: true, authorizationUrl, reference, reused: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payment link.";
    console.error("ADMIN_PAYSTACK_LINK_FAILED", { bookingId, message });
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Provisioning (invoice + link) for a freshly created admin booking
// ---------------------------------------------------------------------------

export type AdminBillingProvisionResult = {
  invoiceStatus: "synced" | "failed" | "skipped" | "error";
  invoiceError?: string | null;
  paymentLinkOk: boolean;
  paymentLinkError?: string | null;
  authorizationUrl?: string | null;
};

/**
 * Provision billing for a newly created admin booking: create an unpaid Zoho
 * invoice for every occurrence and a Paystack payment link for the primary
 * booking. Best-effort and idempotent — never throws and never creates bookings.
 */
export async function provisionAdminBookingBilling(
  supabase: Supabase,
  bookingIds: string[],
): Promise<AdminBillingProvisionResult> {
  const result: AdminBillingProvisionResult = { invoiceStatus: "skipped", paymentLinkOk: false };
  if (bookingIds.length === 0) return result;

  // Create an unpaid invoice per occurrence (mirrors per-occurrence customer sync).
  for (const id of bookingIds) {
    try {
      const sync = await createUnpaidInvoiceForBooking(supabase, id);
      // Report the primary booking's invoice status as the headline.
      if (id === bookingIds[0]) {
        result.invoiceStatus = sync.status;
        result.invoiceError = sync.error ?? null;
      }
    } catch (error) {
      if (id === bookingIds[0]) {
        result.invoiceStatus = "error";
        result.invoiceError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  // One Paystack payment link on the primary booking covers the (series) total.
  const link = await ensurePaystackPaymentLink(supabase, bookingIds[0]);
  if (link.ok && !("alreadyPaid" in link && link.alreadyPaid)) {
    result.paymentLinkOk = true;
    result.authorizationUrl = "authorizationUrl" in link ? link.authorizationUrl : null;
  } else if (link.ok) {
    result.paymentLinkOk = true;
  } else {
    result.paymentLinkOk = false;
    result.paymentLinkError = link.error;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Send / resend payment link to the customer
// ---------------------------------------------------------------------------

export type SendPaymentLinkResult =
  | { ok: true; authorizationUrl: string }
  | { ok: false; error: string };

/**
 * Ensure an invoice + payment link exist, then email the customer a Shalean
 * (Resend) payment email that directs them to log into THEIR dashboard to pay —
 * the customer is never sent a raw Paystack/Zoho link. Used for "Send
 * invoice/payment link" and "Resend".
 */
export async function sendPaymentLinkToCustomer(
  supabase: Supabase,
  bookingId: string,
): Promise<SendPaymentLinkResult> {
  const loaded = await loadBookingWithCustomer(supabase, bookingId);
  if (!loaded) return { ok: false, error: "Booking not found." };
  const { customer } = loaded;
  if (loaded.booking.payment_status === "paid") {
    return { ok: false, error: "This booking is already paid." };
  }
  if (!customer?.email) return { ok: false, error: "Customer has no email on file." };

  // Best-effort: make sure an unpaid invoice + Paystack link exist so the
  // dashboard "Pay now" button is ready. Neither blocks sending the email —
  // the dashboard can (re)create the Paystack link on demand if needed.
  await createUnpaidInvoiceForBooking(supabase, bookingId);
  await ensurePaystackPaymentLink(supabase, bookingId);

  // Reload to capture the freshly persisted invoice number + amount.
  const refreshed = await loadBookingWithCustomer(supabase, bookingId);
  const booking = refreshed?.booking ?? loaded.booking;

  // Send the customer to their Shalean dashboard to log in and pay, NOT to a
  // raw Paystack checkout link.
  const dashboardUrl = `${appUrl()}/dashboard?booking=${booking.id}`;
  await notifyPaymentLink(supabase, {
    booking: bookingForNotification(booking),
    customer: { full_name: customer.full_name, email: customer.email, phone: customer.phone },
    amountCents: bookingAmountDueCents(booking),
    paymentUrl: dashboardUrl,
    invoiceNumber: booking.zoho_invoice_number,
  });

  return { ok: true, authorizationUrl: dashboardUrl };
}

// ---------------------------------------------------------------------------
// Check payment status (verify with Paystack + reconcile)
// ---------------------------------------------------------------------------

export type CheckPaymentStatusResult = {
  ok: boolean;
  reconciled: boolean;
  paymentStatus: string;
  message?: string;
};

export async function checkBookingPaymentStatus(
  supabase: Supabase,
  bookingId: string,
): Promise<CheckPaymentStatusResult> {
  const loaded = await loadBookingWithCustomer(supabase, bookingId);
  if (!loaded) return { ok: false, reconciled: false, paymentStatus: "unknown", message: "Booking not found." };
  const { booking } = loaded;

  if (booking.payment_status === "paid") {
    return { ok: true, reconciled: true, paymentStatus: "paid", message: "Already paid." };
  }
  if (!booking.paystack_reference) {
    return { ok: false, reconciled: false, paymentStatus: booking.payment_status, message: "No Paystack reference yet." };
  }

  try {
    const result = await reconcilePaystackPayment({
      supabase,
      bookingId: booking.id,
      reference: booking.paystack_reference,
      source: "callback",
    });
    return {
      ok: true,
      reconciled: result.reconciled,
      paymentStatus: result.paymentStatus,
    };
  } catch (error) {
    return {
      ok: false,
      reconciled: false,
      paymentStatus: booking.payment_status,
      message: error instanceof Error ? error.message : "Unable to verify payment.",
    };
  }
}

// ---------------------------------------------------------------------------
// Manual / offline payment recording
// ---------------------------------------------------------------------------

export type RecordManualPaymentInput = {
  bookingId: string;
  adminProfileId: string;
  adminName: string;
  amountCents: number;
  method: AdminPaymentMethod;
  paymentDate: string; // YYYY-MM-DD
  reference?: string | null;
  notes?: string | null;
  sendConfirmation?: boolean;
};

export type RecordManualPaymentResult =
  | { ok: true; duplicate?: boolean; fullyPaid: boolean; zohoRecorded: boolean }
  | { ok: false; error: string };

/**
 * Record a manual/offline payment against an existing booking + Zoho invoice.
 * Never creates a new booking or duplicate invoice. Idempotent via a per-payment
 * idempotency key stored in admin_booking_payment_records.
 */
export async function recordManualBookingPayment(
  supabase: Supabase,
  input: RecordManualPaymentInput,
): Promise<RecordManualPaymentResult> {
  try {
    if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
      return { ok: false, error: "Payment amount must be greater than zero." };
    }
    const loaded = await loadBookingWithCustomer(supabase, input.bookingId);
    if (!loaded) return { ok: false, error: "Booking not found." };
    const { booking, customer } = loaded;

    const idempotencyKey = [
      "manual",
      booking.id,
      input.paymentDate,
      input.amountCents,
      input.method,
      (input.reference ?? "").trim().toLowerCase(),
    ].join(":");

    // Idempotency: insert the audit/record row first. A duplicate key means this
    // exact payment was already recorded — return without re-updating anything.
    const recordInsert = await supabase.from("admin_booking_payment_records").insert({
      booking_id: booking.id,
      customer_id: booking.customer_id,
      admin_profile_id: input.adminProfileId,
      admin_name: input.adminName,
      amount_cents: input.amountCents,
      payment_method: input.method,
      payment_date: input.paymentDate,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      idempotency_key: idempotencyKey,
    });
    if (recordInsert.error) {
      if (isUniqueViolation(recordInsert.error)) {
        return { ok: true, duplicate: true, fullyPaid: booking.payment_status === "paid", zohoRecorded: false };
      }
      throw recordInsert.error;
    }

    const amountDue = bookingAmountDueCents(booking);
    const update = computeManualPaymentUpdate({
      amountDueCents: amountDue,
      alreadyPaidCents: booking.amount_paid_cents ?? 0,
      newPaymentCents: input.amountCents,
    });

    const bookingUpdate: Database["public"]["Tables"]["bookings"]["Update"] = {
      payment_status: update.payment_status,
      paid_at: update.fullyPaid ? new Date(`${input.paymentDate}T00:00:00.000Z`).toISOString() : booking.paid_at,
      payment_method: input.method,
      payment_reference: input.reference ?? booking.payment_reference,
      amount_due_cents: amountDue,
      amount_paid_cents: update.amount_paid_cents,
      balance_remaining_cents: update.balance_remaining_cents,
    };
    if (update.booking_status) {
      bookingUpdate.booking_status = update.booking_status;
    }
    const bookingResult = await supabase.from("bookings").update(bookingUpdate).eq("id", booking.id);
    if (bookingResult.error) throw bookingResult.error;

    // Record the payment against the Zoho invoice (only when fully settled).
    // A single sync creates the invoice if missing AND records the payment using
    // the chosen method (force bypasses the already-synced short-circuit).
    let zohoRecorded = false;
    if (update.fullyPaid) {
      const sync = await syncBookingToZohoBooks(booking.id, {
        supabase,
        force: true,
        paymentOverride: {
          amountCents: amountDue,
          paymentMode: zohoPaymentModeFor(input.method),
          reference: (input.reference ?? booking.booking_reference) ?? `SHL-${booking.id.slice(0, 8).toUpperCase()}`,
          date: input.paymentDate,
        },
      });
      zohoRecorded = sync.status === "synced" && sync.invoiceStatus === "paid";
      if (zohoRecorded) {
        await supabase
          .from("admin_booking_payment_records")
          .update({ zoho_payment_recorded: true })
          .eq("idempotency_key", idempotencyKey);
      }

      await supabase
        .from("bookings")
        .update({ invoice_status: "paid" })
        .eq("id", booking.id);

      await dispatchCleanersForPaidBooking(supabase, {
        id: booking.id,
        recurring_series_id: booking.recurring_series_id,
      });

      await logAdminBookingAssistAudit(supabase, {
        adminProfileId: input.adminProfileId,
        customerId: booking.customer_id ?? "",
        bookingId: booking.id,
        action: ADMIN_BOOKING_ASSIST_ACTIONS.cleanerDispatched,
        idempotencyKey,
        payload: {
          booking_reference: booking.booking_reference,
          trigger: "manual_payment",
          payment_method: input.method,
        },
      });
    }

    await logAdminBookingAssistAudit(supabase, {
      adminProfileId: input.adminProfileId,
      customerId: booking.customer_id ?? "",
      bookingId: booking.id,
      action: ADMIN_BOOKING_ASSIST_ACTIONS.paymentRecorded,
      idempotencyKey,
      payload: {
        booking_reference: booking.booking_reference,
        amount_cents: input.amountCents,
        payment_method: input.method,
        fully_paid: update.fullyPaid,
        zoho_recorded: zohoRecorded,
      },
    });

    // Optional confirmation email to the customer.
    if (input.sendConfirmation && update.fullyPaid && customer?.email) {
      await notifyPaymentReceived(supabase, {
        booking: bookingForNotification(booking),
        customer: { full_name: customer.full_name, email: customer.email, phone: customer.phone },
        amountCents: amountDue,
        paymentReference: input.reference ?? `${input.method} payment`,
      });
    }

    return { ok: true, fullyPaid: update.fullyPaid, zohoRecorded };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record payment.";
    console.error("ADMIN_MANUAL_PAYMENT_FAILED", { bookingId: input.bookingId, message });
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Admin overrides: mark paid / unpaid / void
// ---------------------------------------------------------------------------

export async function markBookingPaidManually(
  supabase: Supabase,
  input: { bookingId: string; adminProfileId: string; adminName: string },
): Promise<RecordManualPaymentResult> {
  const loaded = await loadBookingWithCustomer(supabase, input.bookingId);
  if (!loaded) return { ok: false, error: "Booking not found." };
  const amountDue = bookingAmountDueCents(loaded.booking);
  const outstanding = Math.max(1, amountDue - (loaded.booking.amount_paid_cents ?? 0));
  return recordManualBookingPayment(supabase, {
    bookingId: input.bookingId,
    adminProfileId: input.adminProfileId,
    adminName: input.adminName,
    amountCents: outstanding,
    method: "other",
    paymentDate: new Date().toISOString().slice(0, 10),
    reference: "admin-mark-paid",
    notes: `Marked as paid by ${input.adminName}.`,
  });
}

export async function markBookingUnpaid(
  supabase: Supabase,
  bookingId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const loaded = await loadBookingWithCustomer(supabase, bookingId);
    if (!loaded) return { ok: false, error: "Booking not found." };
    const { booking } = loaded;
    const amountDue = bookingAmountDueCents(booking);
    const result = await supabase
      .from("bookings")
      .update({
        payment_status: "pending",
        booking_status: "payment_pending",
        paid_at: null,
        payment_method: null,
        payment_reference: null,
        amount_paid_cents: 0,
        balance_remaining_cents: amountDue,
        invoice_status: booking.zoho_invoice_id ? "created" : "pending",
      })
      .eq("id", bookingId);
    if (result.error) throw result.error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to mark unpaid." };
  }
}

export async function voidBookingInvoice(
  supabase: Supabase,
  bookingId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const loaded = await loadBookingWithCustomer(supabase, bookingId);
    if (!loaded) return { ok: false, error: "Booking not found." };
    const { booking } = loaded;
    if (booking.zoho_invoice_id) {
      await voidZohoInvoiceForBooking(supabase, bookingId, booking.zoho_invoice_id);
    }
    const result = await supabase
      .from("bookings")
      .update({ invoice_status: "voided" })
      .eq("id", bookingId);
    if (result.error) throw result.error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to void invoice." };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error) && typeof error === "object" && (error as { code?: string }).code === "23505";
}
