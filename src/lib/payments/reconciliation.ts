import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { dispatchRegularCleaningOffers } from "@/lib/regular-cleaning/dispatch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type RecurringSeriesRow = Database["public"]["Tables"]["booking_recurring_series"]["Row"];

export type PaystackVerification = Awaited<ReturnType<typeof verifyPaystackTransaction>>;

export type PaymentReconciliationInput = {
  bookingId?: string | null;
  reference: string;
  source: "callback" | "webhook";
  supabase?: Supabase;
  verification?: PaystackVerification;
};

export type PaymentReconciliationResult = {
  bookingId: string;
  paymentId: string;
  reference: string;
  providerStatus: string;
  paymentStatus: string;
  bookingStatus: string;
  reconciled: boolean;
};

export type PaystackReconciliationDecisionInput = {
  providerStatus: string;
  verifiedAmountCents: number;
  bookingTotalCents: number;
  paymentAmountCents: number;
};

export function resolvePaystackReconciliationDecision(input: PaystackReconciliationDecisionInput) {
  if (input.providerStatus === "success") {
    if (input.verifiedAmountCents !== input.bookingTotalCents) {
      throw new Error("Paystack amount does not match the booking total.");
    }

    if (input.paymentAmountCents !== input.bookingTotalCents) {
      throw new Error("Stored payment amount does not match the booking total.");
    }

    return {
      paymentStatus: "paid",
      bookingStatus: "confirmed",
      reconciled: true,
    } as const;
  }

  if (["failed", "abandoned"].includes(input.providerStatus)) {
    return {
      paymentStatus: "failed",
      bookingStatus: null,
      reconciled: false,
    } as const;
  }

  return {
    paymentStatus: null,
    bookingStatus: null,
    reconciled: false,
  } as const;
}

export async function reconcilePaystackPayment(input: PaymentReconciliationInput): Promise<PaymentReconciliationResult> {
  const reference = input.reference.trim();

  if (!reference) {
    throw new Error("Paystack reference is required for reconciliation.");
  }

  const supabase = input.supabase ?? createSupabaseAdminClient();
  const verification = input.verification ?? await verifyPaystackTransaction(reference);
  const bookingId = input.bookingId ?? verification.bookingId ?? null;
  const payment = await findPaymentByReference(supabase, reference, bookingId);

  if (!payment) {
    throw new Error("No Paystack payment row matches this reference.");
  }

  const booking = await findBookingForPayment(supabase, payment.booking_id, bookingId);
  const recurringSeries = booking.recurring_series_id
    ? await findRecurringSeries(supabase, booking.recurring_series_id)
    : null;
  const targetAmountCents = recurringSeries?.series_total_cents ?? booking.final_total_cents;

  if (payment.booking_id !== booking.id) {
    throw new Error("Payment reference does not belong to the requested booking.");
  }

  const decision = resolvePaystackReconciliationDecision({
    providerStatus: verification.providerStatus,
    verifiedAmountCents: verification.amountCents,
    bookingTotalCents: targetAmountCents,
    paymentAmountCents: Number(payment.amount_cents),
  });

  if (!decision.reconciled) {
    await markPaymentFailedIfFinal(supabase, payment, verification);

    return {
      bookingId: booking.id,
      paymentId: payment.id,
      reference,
      providerStatus: verification.providerStatus,
      paymentStatus: decision.paymentStatus ?? payment.status,
      bookingStatus: recurringSeries?.status ?? booking.booking_status,
      reconciled: false,
    };
  }

  const verifiedMetadata = buildVerifiedMetadata(payment, verification, input.source);

  const paymentUpdate = await supabase
    .from("payments")
    .update({
      status: decision.paymentStatus,
      provider_ref: reference,
      provider_reference: reference,
      metadata: verifiedMetadata,
    })
    .eq("id", payment.id)
    .select("id, status")
    .single();

  if (paymentUpdate.error) throw paymentUpdate.error;

  const bookingUpdate = recurringSeries
    ? await markRecurringBookingsPaid(supabase, recurringSeries, decision)
    : await markSingleBookingPaid(supabase, booking, decision);

  if (bookingUpdate.error) throw bookingUpdate.error;

  const dispatchedBookingIds = recurringSeries
    ? await findBookingIdsForRecurringSeries(supabase, recurringSeries.id)
    : [booking.id];
  await dispatchRegularCleaningOffers(supabase, dispatchedBookingIds);

  return {
    bookingId: booking.id,
    paymentId: payment.id,
    reference,
    providerStatus: verification.providerStatus,
    paymentStatus: bookingUpdate.paymentStatus,
    bookingStatus: bookingUpdate.bookingStatus,
    reconciled: true,
  };
}

async function findBookingIdsForRecurringSeries(supabase: Supabase, seriesId: string) {
  const result = await supabase
    .from("bookings")
    .select("id")
    .eq("recurring_series_id", seriesId);

  if (result.error) throw result.error;

  return (result.data ?? []).map((booking) => booking.id);
}

async function findPaymentByReference(supabase: Supabase, reference: string, bookingId: string | null) {
  let query = supabase
    .from("payments")
    .select("*")
    .or(`provider_reference.eq.${reference},provider_ref.eq.${reference},idempotency_key.eq.${reference}`);

  if (bookingId) {
    query = query.eq("booking_id", bookingId);
  }

  const result = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw result.error;

  return result.data;
}

async function findBookingForPayment(supabase: Supabase, paymentBookingId: string, requestedBookingId: string | null) {
  const id = requestedBookingId ?? paymentBookingId;
  const result = await supabase.from("bookings").select("*").eq("id", id).single();

  if (result.error) throw result.error;

  return result.data;
}

async function findRecurringSeries(supabase: Supabase, seriesId: string) {
  const result = await supabase.from("booking_recurring_series").select("*").eq("id", seriesId).single();

  if (result.error) throw result.error;

  return result.data;
}

async function markSingleBookingPaid(
  supabase: Supabase,
  booking: BookingRow,
  decision: ReturnType<typeof resolvePaystackReconciliationDecision> & { reconciled: true },
) {
  const result = await supabase
    .from("bookings")
    .update({
      payment_status: decision.paymentStatus,
      booking_status: decision.bookingStatus,
    })
    .eq("id", booking.id)
    .select("id, payment_status, booking_status")
    .single();

  return {
    error: result.error,
    paymentStatus: result.data?.payment_status ?? booking.payment_status,
    bookingStatus: result.data?.booking_status ?? booking.booking_status,
  };
}

async function markRecurringBookingsPaid(
  supabase: Supabase,
  series: RecurringSeriesRow,
  decision: ReturnType<typeof resolvePaystackReconciliationDecision> & { reconciled: true },
) {
  const seriesResult = await supabase
    .from("booking_recurring_series")
    .update({
      payment_status: decision.paymentStatus,
      status: decision.bookingStatus,
    })
    .eq("id", series.id);

  if (seriesResult.error) {
    return {
      error: seriesResult.error,
      paymentStatus: series.payment_status,
      bookingStatus: series.status,
    };
  }

  const bookingsResult = await supabase
    .from("bookings")
    .update({
      payment_status: decision.paymentStatus,
      booking_status: decision.bookingStatus,
    })
    .eq("recurring_series_id", series.id);

  return {
    error: bookingsResult.error,
    paymentStatus: decision.paymentStatus,
    bookingStatus: decision.bookingStatus,
  };
}

async function markPaymentFailedIfFinal(
  supabase: Supabase,
  payment: PaymentRow,
  verification: PaystackVerification,
) {
  if (!["failed", "abandoned"].includes(verification.providerStatus)) {
    return;
  }

  const failedStatus = "failed";

  await supabase
    .from("payments")
    .update({
      status: failedStatus,
      metadata: buildVerifiedMetadata(payment, verification, "webhook"),
    })
    .eq("id", payment.id);
}

function buildVerifiedMetadata(
  payment: PaymentRow,
  verification: PaystackVerification,
  source: PaymentReconciliationInput["source"],
): Json {
  const metadata = isRecord(payment.metadata) ? payment.metadata : {};

  return {
    ...metadata,
    paystack: {
      reference: verification.reference,
      status: verification.providerStatus,
      amountCents: verification.amountCents,
      currency: verification.currency,
      paidAt: verification.paidAt,
      verifiedAt: new Date().toISOString(),
      verificationSource: source,
    },
  };
}

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
