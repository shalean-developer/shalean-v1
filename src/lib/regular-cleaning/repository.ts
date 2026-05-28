import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { calculateRegularCleaningPrice } from "./pricing";
import { buildRegularCleaningOccurrences, isRecurringFrequency, normalizeRecurrenceWeekdays } from "./recurrence";
import type { RegularCleaningBookingInput, RegularCleaningCatalog, RegularCleaningQuoteResponse } from "./types";
import { REGULAR_CLEANING_SLUG } from "./types";
import { upsertCustomerIdentity } from "@/lib/customers/identity";

export async function loadRegularCleaningCatalog(
  supabase: SupabaseClient<Database>,
  suburb?: string,
): Promise<RegularCleaningCatalog> {
  const [
    serviceResult,
    addonsResult,
    equipmentResult,
    quantityResult,
    pricingResult,
    cleanersResult,
  ] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .eq("slug", REGULAR_CLEANING_SLUG)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("service_addons")
      .select("*")
      .eq("service_slug", REGULAR_CLEANING_SLUG)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("service_equipment_options")
      .select("*")
      .eq("service_slug", REGULAR_CLEANING_SLUG)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("cleaner_quantity_rules")
      .select("*")
      .eq("service_slug", REGULAR_CLEANING_SLUG)
      .eq("active", true)
      .single(),
    supabase
      .from("regular_cleaning_pricing_rules")
      .select("*")
      .eq("active", true)
      .order("bedrooms")
      .order("bathrooms"),
    supabase
      .from("cleaners")
      .select("*")
      .contains("service_slugs", [REGULAR_CLEANING_SLUG])
      .eq("active", true),
  ]);

  if (serviceResult.error) throw serviceResult.error;
  if (addonsResult.error) throw addonsResult.error;
  if (equipmentResult.error) throw equipmentResult.error;
  if (quantityResult.error) throw quantityResult.error;
  if (pricingResult.error) throw pricingResult.error;
  if (cleanersResult.error) throw cleanersResult.error;

  const cleaners = (cleanersResult.data ?? []).map((cleaner) => ({
    ...cleaner,
    available: cleaner.available && (!suburb || cleaner.suburbs.includes(suburb)),
  }));

  return {
    serviceSlug: REGULAR_CLEANING_SLUG,
    service: serviceResult.data,
    addons: addonsResult.data ?? [],
    equipmentOptions: equipmentResult.data ?? [],
    cleanerQuantityRule: quantityResult.data,
    pricingRules: pricingResult.data ?? [],
    cleaners,
  };
}

export async function createRegularCleaningBooking(
  supabase: SupabaseClient<Database>,
  input: RegularCleaningBookingInput,
  customerIdOverride?: string,
) {
  const catalog = await loadRegularCleaningCatalog(supabase, input.suburb);
  const quoteResponse = buildRegularCleaningQuote(input, catalog);
  const quote = quoteResponse.quote;
  const selectedCleaner = input.selectedCleanerId
    ? catalog.cleaners.find((cleaner) => cleaner.id === input.selectedCleanerId && cleaner.available)
    : null;

  if (input.selectedCleanerId && !selectedCleaner) {
    throw new PreferredCleanerUnavailableError();
  }

  const customerId = customerIdOverride ?? await createGuestCustomer(supabase, input);

  const recurringSeriesId = quoteResponse.isRecurring
    ? await createRecurringSeries(supabase, input, customerId, quoteResponse)
    : null;
  const bookingRows = quoteResponse.occurrences.map((occurrence) => buildRegularCleaningBookingInsert(
    {
      ...input,
      bookingDate: occurrence.bookingDate,
      bookingTime: occurrence.bookingTime,
    },
    customerId,
    quote,
    selectedCleaner?.id ?? null,
    {
      recurringSeriesId,
      occurrenceIndex: occurrence.index,
      occurrenceCount: quoteResponse.occurrences.length,
      perOccurrenceTotalCents: quote.finalTotalCents,
      seriesTotalCents: quoteResponse.seriesTotalCents,
    },
  ));
  logRegularCleaningDebug("BOOKING_INSERT_PAYLOAD", {
    checkoutId: input.checkoutId,
    customerId,
    selectedCleanerId: selectedCleaner?.id ?? null,
    occurrenceCount: bookingRows.length,
    bookingStatuses: bookingRows.map((row) => row.booking_status),
    paymentStatuses: bookingRows.map((row) => row.payment_status),
  });

  const bookingResult = await supabase
    .from("bookings")
    .insert(bookingRows)
    .select("id, final_total_cents");

  if (bookingResult.error) throw bookingResult.error;

  const bookings = bookingResult.data ?? [];
  const firstBooking = bookings[0];

  if (!firstBooking) {
    throw new Error("Unable to create Regular Cleaning booking occurrences");
  }

  if (quote.selectedAddons.length > 0) {
    const addonsResult = await supabase.from("booking_addons").insert(
      bookings.flatMap((booking) =>
        quote.selectedAddons.map((addon) => ({
          booking_id: booking.id,
          addon_key: addon.key,
          label: addon.label,
          price_cents: addon.priceCents,
        })),
      ),
    );
    if (addonsResult.error) throw addonsResult.error;
  }

  const equipmentResult = await supabase.from("booking_equipment").insert(bookings.map((booking) => ({
    booking_id: booking.id,
    equipment_key: quote.equipmentOption.key,
    label: quote.equipmentOption.label,
    price_cents: quote.equipmentOption.priceCents,
    included_items: quote.equipmentOption.includedItems,
  })));
  if (equipmentResult.error) throw equipmentResult.error;

  const bookingCleanerRows = bookings.map((booking) => ({
    booking_id: booking.id,
    cleaner_id: selectedCleaner?.id ?? null,
    cleaner_count: quote.cleanerCount,
    is_preferred: Boolean(selectedCleaner),
    status: "pending_payment",
  }));
  logRegularCleaningDebug("BOOKING_CLEANER_INSERT_PAYLOAD", {
    checkoutId: input.checkoutId,
    selectedCleanerId: selectedCleaner?.id ?? null,
    rows: bookingCleanerRows.map((row) => ({
      booking_id: row.booking_id,
      cleaner_id: row.cleaner_id,
      cleaner_count: row.cleaner_count,
      is_preferred: row.is_preferred,
      status: row.status,
    })),
  });

  const bookingCleanerResult = await supabase.from("booking_cleaners").insert(bookingCleanerRows);
  if (bookingCleanerResult.error) throw bookingCleanerResult.error;

  return {
    bookingId: firstBooking.id,
    bookingIds: bookings.map((booking) => booking.id),
    recurringSeriesId,
    quote,
    occurrences: quoteResponse.occurrences,
    isRecurring: quoteResponse.isRecurring,
    seriesTotalCents: quoteResponse.seriesTotalCents,
  };
}

async function createGuestCustomer(
  supabase: SupabaseClient<Database>,
  input: RegularCleaningBookingInput,
) {
  return upsertCustomerIdentity(supabase, {
    fullName: input.customer.fullName,
    email: input.customer.email,
    phone: input.customer.phone,
  });
}

export class PreferredCleanerUnavailableError extends Error {
  constructor() {
    super("Selected cleaner is not available for this Regular Cleaning booking");
    this.name = "PreferredCleanerUnavailableError";
  }
}

export function buildRegularCleaningQuote(
  input: RegularCleaningBookingInput,
  catalog: RegularCleaningCatalog,
): RegularCleaningQuoteResponse {
  const normalizedInput = {
    ...input,
    recurrenceWeekdays: normalizeRecurrenceWeekdays(input.recurrenceWeekdays, input.bookingDate),
  };
  const quote = calculateRegularCleaningPrice(normalizedInput, catalog);
  const occurrences = buildRegularCleaningOccurrences(normalizedInput);
  const isRecurring = isRecurringFrequency(normalizedInput.frequency);

  return {
    quote,
    occurrences,
    isRecurring,
    seriesTotalCents: quote.finalTotalCents * occurrences.length,
  };
}

export function buildRegularCleaningBookingInsert(
  input: RegularCleaningBookingInput,
  customerId: string,
  quote: ReturnType<typeof calculateRegularCleaningPrice>,
  selectedCleanerId: string | null,
  recurring?: {
    recurringSeriesId: string | null;
    occurrenceIndex: number;
    occurrenceCount: number;
    perOccurrenceTotalCents: number;
    seriesTotalCents: number;
  },
) {
  return {
    checkout_session_id: input.checkoutId,
    recurring_series_id: recurring?.recurringSeriesId ?? null,
    occurrence_index: recurring?.occurrenceIndex ?? 1,
    occurrence_count: recurring?.occurrenceCount ?? 1,
    occurrence_date: input.bookingDate,
    recurrence_frequency: input.frequency,
    recurrence_weekdays: input.frequency === "monthly" ? [] : normalizeRecurrenceWeekdays(input.recurrenceWeekdays, input.bookingDate),
    per_occurrence_total_cents: recurring?.perOccurrenceTotalCents ?? quote.finalTotalCents,
    series_total_cents: recurring?.seriesTotalCents ?? quote.finalTotalCents,
    customer_id: customerId,
    service_slug: REGULAR_CLEANING_SLUG,
    booking_date: input.bookingDate,
    booking_time: input.bookingTime,
    address: input.address,
    suburb: input.suburb,
    property_type: input.propertyType,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    extra_rooms: input.extraRooms,
    access_notes: input.accessNotes ?? null,
    customer_notes: null,
    selected_addons: quote.selectedAddons,
    equipment_option: quote.equipmentOption.key,
    cleaner_count: quote.cleanerCount,
    selected_cleaner_id: selectedCleanerId,
    estimated_minutes: quote.estimatedMinutes,
    base_price_cents: quote.basePriceCents,
    addons_total_cents: quote.addonsTotalCents,
    equipment_total_cents: quote.equipmentTotalCents,
    extra_cleaners_total_cents: quote.extraCleanersTotalCents,
    final_total_cents: quote.finalTotalCents,
    payment_status: "pending",
    booking_status: "payment_pending",
    pricing_snapshot: quote,
  };
}

async function createRecurringSeries(
  supabase: SupabaseClient<Database>,
  input: RegularCleaningBookingInput,
  customerId: string,
  quoteResponse: RegularCleaningQuoteResponse,
) {
  const result = await supabase
    .from("booking_recurring_series")
    .insert({
      checkout_session_id: input.checkoutId,
      service_slug: REGULAR_CLEANING_SLUG,
      customer_id: customerId,
      frequency: input.frequency,
      selected_weekdays: input.frequency === "monthly" ? [] : normalizeRecurrenceWeekdays(input.recurrenceWeekdays, input.bookingDate),
      start_date: input.bookingDate,
      time_window: input.bookingTime,
      occurrence_count: quoteResponse.occurrences.length,
      per_occurrence_total_cents: quoteResponse.quote.finalTotalCents,
      series_total_cents: quoteResponse.seriesTotalCents,
      payment_status: "pending",
      status: "payment_pending",
      recurrence_config: {
        frequency: input.frequency,
        selectedWeekdays: input.recurrenceWeekdays,
        generatedThrough: quoteResponse.occurrences.at(-1)?.bookingDate,
      },
      pricing_snapshot: quoteResponse,
    })
    .select("id")
    .single();

  if (result.error) throw result.error;

  return result.data.id;
}

function logRegularCleaningDebug(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.info(event, payload);
}
