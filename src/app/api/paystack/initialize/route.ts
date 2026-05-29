import { bookingDraftSchema } from "@/lib/booking/schema";
import { ensureCustomerProfile, getCustomerSession } from "@/lib/auth/server";
import { bookingDraftToRegularCleaningInput } from "@/lib/regular-cleaning/adapter";
import { createRegularCleaningBooking, PreferredCleanerUnavailableError } from "@/lib/regular-cleaning/repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { initializePaystackTransaction } from "@/lib/payments/paystack";
import { notifyBookingCreated } from "@/lib/notifications/triggers";
import type { Database, Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type CreatedBooking = Awaited<ReturnType<typeof createRegularCleaningBooking>>;

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bookingDraftSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      { stage: "validation", error: "Complete the required booking details before checkout.", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  if (parsed.data.serviceSlug !== "regular-cleaning") {
    return Response.json(
      { stage: "validation", error: "Only Regular Cleaning checkout is connected to Supabase in V1." },
      { status: 422 },
    );
  }

  const origin = new URL(request.url).origin;

  try {
    const customerSession = await getCustomerSession();

    if (!customerSession) {
      return Response.json(
        { stage: "validation", code: "CUSTOMER_AUTH_REQUIRED", error: "Log in or sign up before checkout." },
        { status: 401 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const customerId = await ensureCustomerProfile({
      userId: customerSession.user.id,
      fullName: parsed.data.customer.name,
      email: customerSession.user.email ?? parsed.data.customer.email,
      phone: parsed.data.customer.phone,
    });
    const checkoutId = parsed.data.checkoutId;
    const existingPayment = await findExistingCheckoutPayment(supabase, checkoutId);

    if (existingPayment?.status === "paid") {
      return Response.json(
        {
          stage: "payment_insert",
          code: "CHECKOUT_ALREADY_PAID",
          error: "This checkout has already been paid.",
          bookingId: existingPayment.booking_id,
        },
        { status: 409 },
      );
    }

    if (existingPayment) {
      const existingAuthorizationUrl = getMetadataString(existingPayment.metadata, "authorizationUrl");
      const existingReference = existingPayment.provider_reference ?? existingPayment.provider_ref;

      if (existingAuthorizationUrl && existingReference) {
        return Response.json({
          bookingId: existingPayment.booking_id,
          quote: null,
          occurrences: [],
          isRecurring: false,
          seriesTotalCents: existingPayment.amount_cents,
          reference: existingReference,
          authorizationUrl: existingAuthorizationUrl,
          reusedCheckout: true,
        });
      }
    }

    let booking: CreatedBooking;
    let isNewlyCreatedBooking = false;
    const existingBooking = await findExistingCheckoutBooking(supabase, checkoutId, customerId);

    if (existingBooking) {
      const existingBookingRows = await findCheckoutBookingRows(supabase, existingBooking);
      booking = {
        bookingId: existingBooking.id,
        bookingIds: existingBookingRows.map((row) => row.id),
        recurringSeriesId: existingBooking.recurring_series_id,
        quote: existingBooking.pricing_snapshot as CreatedBooking["quote"],
        occurrences: existingBookingRows.map((row, index) => ({
          index: index + 1,
          bookingDate: row.booking_date,
          bookingTime: row.booking_time,
        })),
        isRecurring: Boolean(existingBooking.recurring_series_id),
        seriesTotalCents: existingBooking.series_total_cents ?? existingBooking.final_total_cents,
      };
    } else {
      try {
        booking = await createRegularCleaningBooking(
          supabase,
          bookingDraftToRegularCleaningInput(parsed.data),
          customerId,
        );
        isNewlyCreatedBooking = true;
      } catch (error) {
        if (error instanceof PreferredCleanerUnavailableError) {
          return Response.json(
            {
              stage: "preferred_cleaner",
              code: "PREFERRED_CLEANER_UNAVAILABLE",
              error: "That preferred cleaner is no longer available for this suburb. Shalean can auto-assign the best available cleaner.",
            },
            { status: 409 },
          );
        }

        throw withCheckoutStage(error, "booking_creation");
      }
    }

    let transaction: Awaited<ReturnType<typeof initializePaystackTransaction>>;

    try {
      transaction = await initializePaystackTransaction({
        email: parsed.data.customer.email,
        amountCents: booking.seriesTotalCents,
        bookingId: booking.bookingId,
        callbackUrl: `${origin}/dashboard?payment=paystack&booking=${booking.bookingId}`,
      });
    } catch (error) {
      throw withCheckoutStage(error, "paystack_initialize");
    }

    console.info("Paystack initialize", {
      stage: "paystack_initialize",
      bookingId: booking.bookingId,
      hasCustomerEmail: Boolean(parsed.data.customer.email),
      amountCents: booking.seriesTotalCents,
      reference: transaction.data.reference,
      occurrenceCount: booking.occurrences.length,
      recurringSeriesId: booking.recurringSeriesId,
      providerStatus: transaction.status,
    });

    const paymentPayload = {
      booking_id: booking.bookingId,
      checkout_session_id: checkoutId,
      status: "pending",
      provider: "paystack",
      provider_ref: transaction.data.reference,
      provider_reference: transaction.data.reference,
      idempotency_key: checkoutId,
      amount_cents: booking.seriesTotalCents,
      currency: "ZAR",
      metadata: {
        accessCode: transaction.data.access_code,
        authorizationUrl: transaction.data.authorization_url,
        bookingId: booking.bookingId,
        bookingIds: booking.bookingIds,
        recurringSeriesId: booking.recurringSeriesId,
        occurrenceCount: booking.occurrences.length,
      },
    };
    const paymentResult = existingPayment
      ? await supabase.from("payments").update(paymentPayload).eq("id", existingPayment.id)
      : await supabase.from("payments").insert(paymentPayload);

    if (paymentResult.error) {
      throw withCheckoutStage(paymentResult.error, "payment_insert");
    }

    if (isNewlyCreatedBooking) {
      // Best-effort: enqueue booking-created notifications. Never blocks checkout.
      await notifyBookingCreated(supabase, {
        booking: {
          id: booking.bookingId,
          service_slug: parsed.data.serviceSlug,
          booking_date: parsed.data.date,
          booking_time: parsed.data.timeWindow,
          suburb: parsed.data.suburb,
          address: parsed.data.address,
          final_total_cents: booking.seriesTotalCents,
        },
        customer: {
          full_name: parsed.data.customer.name,
          email: parsed.data.customer.email,
          phone: parsed.data.customer.phone,
        },
      });
    }

    return Response.json({
      bookingId: booking.bookingId,
      quote: booking.quote,
      occurrences: booking.occurrences,
      isRecurring: booking.isRecurring,
      seriesTotalCents: booking.seriesTotalCents,
      reference: transaction.data.reference,
      authorizationUrl: transaction.data.authorization_url,
    });
  } catch (error) {
    const stage = getCheckoutStage(error);

    console.error("Paystack checkout initialization failed", {
      stage,
      message: error instanceof Error ? error.message : "Unknown checkout initialization error",
    });

    return Response.json(
      {
        stage,
        error: error instanceof Error ? error.message : "Unable to initialize Paystack checkout.",
      },
      { status: 502 },
    );
  }
}

type CheckoutStage = "validation" | "preferred_cleaner" | "booking_creation" | "paystack_initialize" | "payment_insert";

function withCheckoutStage(error: unknown, stage: CheckoutStage) {
  const checkoutError = error instanceof Error ? error : new Error(formatUnknownError(error));
  (checkoutError as Error & { checkoutStage?: CheckoutStage }).checkoutStage = stage;
  return checkoutError;
}

function getCheckoutStage(error: unknown): CheckoutStage {
  return error instanceof Error && "checkoutStage" in error
    ? ((error as Error & { checkoutStage?: CheckoutStage }).checkoutStage ?? "paystack_initialize")
    : "paystack_initialize";
}

function formatUnknownError(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: unknown;
      error_description?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const parts = [
      maybeError.message,
      maybeError.error_description,
      maybeError.details,
      maybeError.hint,
      maybeError.code,
    ].filter((part): part is string => typeof part === "string" && part.length > 0);

    if (parts.length > 0) {
      return parts.join(" ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unable to initialize Paystack checkout.";
    }
  }

  return "Unable to initialize Paystack checkout.";
}

async function findExistingCheckoutPayment(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  checkoutId: string,
) {
  const result = await supabase
    .from("payments")
    .select("*")
    .eq("checkout_session_id", checkoutId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw withCheckoutStage(result.error, "payment_insert");
  }

  return result.data as PaymentRow | null;
}

async function findExistingCheckoutBooking(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  checkoutId: string,
  customerId: string,
) {
  const result = await supabase
    .from("bookings")
    .select("*")
    .eq("checkout_session_id", checkoutId)
    .eq("customer_id", customerId)
    .order("occurrence_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw withCheckoutStage(result.error, "booking_creation");
  }

  return result.data as BookingRow | null;
}

async function findCheckoutBookingRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  booking: BookingRow,
) {
  const query = supabase
    .from("bookings")
    .select("id, booking_date, booking_time")
    .order("occurrence_index", { ascending: true });
  const result = booking.recurring_series_id
    ? await query.eq("recurring_series_id", booking.recurring_series_id)
    : await query.eq("id", booking.id);

  if (result.error) {
    throw withCheckoutStage(result.error, "booking_creation");
  }

  return result.data ?? [];
}

function getMetadataString(metadata: Json, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
