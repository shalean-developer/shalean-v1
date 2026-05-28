import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { calculateRegularCleaningEarningForBooking, isValidRegularCleaningEarning } from "./earnings";
import { REGULAR_CLEANING_SLUG } from "./types";

type Supabase = SupabaseClient<Database>;
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type BookingCleanerRow = Database["public"]["Tables"]["booking_cleaners"]["Row"];
type CleanerRow = Database["public"]["Tables"]["cleaners"]["Row"];
type CleanerAvailabilityRow = Database["public"]["Tables"]["cleaner_availability"]["Row"];
type CleanerTimeOffRow = Database["public"]["Tables"]["cleaner_time_off"]["Row"];
type BusyBookingRow = Pick<BookingRow, "id" | "booking_date" | "booking_time">;

const activeOfferStatuses = ["pending_payment", "offered", "accepted"];
const busyOfferStatuses = ["accepted", "in_progress"];

type DispatchAvailabilityContext = {
  weeklyWindowsByCleaner: Map<string, CleanerAvailabilityRow[]>;
  timeOffByCleaner: Map<string, CleanerTimeOffRow[]>;
  busySlotsByCleaner: Map<string, Set<string>>;
};

export async function dispatchRegularCleaningOffers(supabase: Supabase, bookingIds: string[]) {
  if (bookingIds.length === 0) {
    return;
  }

  const bookingsResult = await supabase
    .from("bookings")
    .select("*")
    .in("id", bookingIds)
    .eq("service_slug", REGULAR_CLEANING_SLUG);

  if (bookingsResult.error) throw bookingsResult.error;

  const bookings = (bookingsResult.data ?? []).filter(
    (booking) => booking.payment_status === "paid" && ["confirmed", "assigned"].includes(booking.booking_status),
  );

  if (bookings.length === 0) {
    return;
  }

  const [cleanersResult, existingOffersResult] = await Promise.all([
    supabase
      .from("cleaners")
      .select("*")
      .contains("service_slugs", [REGULAR_CLEANING_SLUG])
      .eq("active", true),
    supabase
      .from("booking_cleaners")
      .select("*")
      .in("booking_id", bookings.map((booking) => booking.id)),
  ]);

  if (cleanersResult.error) throw cleanersResult.error;
  if (existingOffersResult.error) throw existingOffersResult.error;

  const cleaners = cleanersResult.data ?? [];
  const existingOffers = existingOffersResult.data ?? [];
  const availabilityContext = await loadDispatchAvailabilityContext(
    supabase,
    cleaners.map((cleaner) => cleaner.id),
    bookings.map((booking) => booking.id),
  );

  for (const booking of bookings) {
    await dispatchOffersForBooking(
      supabase,
      booking,
      cleaners,
      existingOffers.filter((offer) => offer.booking_id === booking.id),
      availabilityContext,
    );
  }
}

async function dispatchOffersForBooking(
  supabase: Supabase,
  booking: BookingRow,
  cleaners: CleanerRow[],
  existingOffers: BookingCleanerRow[],
  availabilityContext: DispatchAvailabilityContext,
) {
  const acceptedCount = existingOffers.filter((offer) => offer.status === "accepted").length;
  const activeOffers = existingOffers.filter((offer) => activeOfferStatuses.includes(offer.status) && offer.cleaner_id);

  if (acceptedCount >= booking.cleaner_count || activeOffers.some((offer) => offer.status === "offered")) {
    return;
  }

  const eligibleCleaners = cleaners
    .filter((cleaner) => isCleanerEligibleForBooking(cleaner, booking, availabilityContext))
    .toSorted((left, right) => Number(right.rating) - Number(left.rating));
  const preferredCleaner = booking.selected_cleaner_id
    ? eligibleCleaners.find((cleaner) => cleaner.id === booking.selected_cleaner_id)
    : null;
  const orderedCleaners = [
    ...(preferredCleaner ? [preferredCleaner] : []),
    ...eligibleCleaners.filter((cleaner) => cleaner.id !== preferredCleaner?.id),
  ].slice(0, Math.max(0, booking.cleaner_count - acceptedCount));

  if (orderedCleaners.length === 0) {
    await markAdminReassignment(supabase, booking, existingOffers);
    return;
  }

  const placeholders = existingOffers.filter((offer) => ["pending_payment", "planned", "requested"].includes(offer.status));

  for (const cleaner of orderedCleaners) {
    if (existingOffers.some((offer) => offer.cleaner_id === cleaner.id && activeOfferStatuses.includes(offer.status))) {
      continue;
    }

    const snapshot = calculateRegularCleaningEarningForBooking(booking, cleaner);
    if (!isValidRegularCleaningEarning(snapshot)) {
      continue;
    }

    const payload = {
      booking_id: booking.id,
      cleaner_id: cleaner.id,
      cleaner_count: booking.cleaner_count,
      is_preferred: booking.selected_cleaner_id === cleaner.id,
      status: "offered",
      earning_cents: snapshot.earningCents,
      eligible_value_cents: snapshot.eligibleValueCents,
      earning_rate_percent: snapshot.earningRatePercent,
      earning_rule: snapshot.earningRule,
      offered_at: new Date().toISOString(),
      offer_expires_at: null,
    };

    const placeholder = placeholders.shift();
    const result = placeholder
      ? await supabase.from("booking_cleaners").update(payload).eq("id", placeholder.id)
      : await supabase.from("booking_cleaners").insert(payload);

    if (result.error) throw result.error;
  }
}

async function markAdminReassignment(
  supabase: Supabase,
  booking: BookingRow,
  existingOffers: BookingCleanerRow[],
) {
  const placeholder = existingOffers.find((offer) => !offer.cleaner_id);

  if (placeholder) {
    const result = await supabase
      .from("booking_cleaners")
      .update({
        status: "admin_reassignment",
        cleaner_count: booking.cleaner_count,
        is_preferred: Boolean(booking.selected_cleaner_id),
      })
      .eq("id", placeholder.id);

    if (result.error) throw result.error;
    return;
  }

  const result = await supabase.from("booking_cleaners").insert({
    booking_id: booking.id,
    cleaner_id: null,
    cleaner_count: booking.cleaner_count,
    is_preferred: Boolean(booking.selected_cleaner_id),
    status: "admin_reassignment",
  });

  if (result.error) throw result.error;
}

export function isCleanerEligibleForBooking(
  cleaner: Pick<CleanerRow, "id" | "active" | "available" | "service_slugs" | "suburbs">,
  booking: Pick<BookingRow, "suburb" | "booking_date" | "booking_time">,
  availabilityContext?: DispatchAvailabilityContext,
) {
  const coreEligible = (
    cleaner.active &&
    cleaner.available &&
    cleaner.service_slugs.includes(REGULAR_CLEANING_SLUG) &&
    cleaner.suburbs.includes(booking.suburb)
  );

  if (!coreEligible || !availabilityContext) {
    return coreEligible;
  }

  return (
    isCleanerScheduledForSlot(cleaner, booking, availabilityContext) &&
    !isCleanerOnTimeOff(cleaner, booking, availabilityContext) &&
    !isCleanerBusyInSlot(cleaner, booking, availabilityContext)
  );
}

async function loadDispatchAvailabilityContext(
  supabase: Supabase,
  cleanerIds: string[],
  excludedBookingIds: string[],
): Promise<DispatchAvailabilityContext> {
  if (cleanerIds.length === 0) {
    return {
      weeklyWindowsByCleaner: new Map(),
      timeOffByCleaner: new Map(),
      busySlotsByCleaner: new Map(),
    };
  }

  const [weeklyWindowsResult, timeOffResult, busyOffersResult] = await Promise.all([
    supabase
      .from("cleaner_availability")
      .select("*")
      .in("cleaner_id", cleanerIds),
    supabase
      .from("cleaner_time_off")
      .select("*")
      .in("cleaner_id", cleanerIds),
    supabase
      .from("booking_cleaners")
      .select("cleaner_id, booking_id")
      .in("cleaner_id", cleanerIds)
      .in("status", busyOfferStatuses),
  ]);

  if (weeklyWindowsResult.error) throw weeklyWindowsResult.error;
  if (timeOffResult.error) throw timeOffResult.error;
  if (busyOffersResult.error) throw busyOffersResult.error;

  const weeklyWindowsByCleaner = new Map<string, CleanerAvailabilityRow[]>();
  for (const window of weeklyWindowsResult.data ?? []) {
    const windows = weeklyWindowsByCleaner.get(window.cleaner_id) ?? [];
    windows.push(window);
    weeklyWindowsByCleaner.set(window.cleaner_id, windows);
  }

  const timeOffByCleaner = new Map<string, CleanerTimeOffRow[]>();
  for (const block of timeOffResult.data ?? []) {
    const blocks = timeOffByCleaner.get(block.cleaner_id) ?? [];
    blocks.push(block);
    timeOffByCleaner.set(block.cleaner_id, blocks);
  }

  const busyRows = busyOffersResult.data ?? [];
  const busyBookingIds = compactUnique(
    busyRows
      .map((row) => row.booking_id)
      .filter((bookingId) => !excludedBookingIds.includes(bookingId)),
  );
  const busyBookingsById = await loadBusyBookingsById(supabase, busyBookingIds);
  const busySlotsByCleaner = new Map<string, Set<string>>();

  for (const row of busyRows) {
    if (excludedBookingIds.includes(row.booking_id)) {
      continue;
    }
    if (!row.cleaner_id) {
      continue;
    }
    const booking = busyBookingsById.get(row.booking_id);
    if (!booking) {
      continue;
    }
    const currentSlots = busySlotsByCleaner.get(row.cleaner_id) ?? new Set<string>();
    currentSlots.add(slotKey(booking.booking_date, booking.booking_time));
    busySlotsByCleaner.set(row.cleaner_id, currentSlots);
  }

  return {
    weeklyWindowsByCleaner,
    timeOffByCleaner,
    busySlotsByCleaner,
  };
}

async function loadBusyBookingsById(supabase: Supabase, bookingIds: string[]) {
  if (bookingIds.length === 0) {
    return new Map<string, BusyBookingRow>();
  }

  const result = await supabase
    .from("bookings")
    .select("id, booking_date, booking_time")
    .in("id", bookingIds);

  if (result.error) throw result.error;

  return new Map((result.data ?? []).map((booking) => [booking.id, booking]));
}

function isCleanerScheduledForSlot(
  cleaner: Pick<CleanerRow, "id">,
  booking: Pick<BookingRow, "booking_date" | "booking_time">,
  context: DispatchAvailabilityContext,
) {
  const windows = context.weeklyWindowsByCleaner.get(cleaner.id) ?? [];
  if (windows.length === 0) {
    return true;
  }

  const bookingWindow = parseBookingWindowMinutes(booking.booking_time);
  if (!bookingWindow) {
    return true;
  }

  const bookingDay = dayOfWeekForDate(booking.booking_date);
  const dayWindows = windows.filter((window) => window.day_of_week === bookingDay);
  if (dayWindows.length === 0) {
    return false;
  }

  return dayWindows.some((window) => {
    const start = parseClockToMinutes(window.start_time);
    const end = parseClockToMinutes(window.end_time);
    if (start === null || end === null) {
      return false;
    }
    return bookingWindow.startMinutes >= start && bookingWindow.endMinutes <= end;
  });
}

function isCleanerOnTimeOff(
  cleaner: Pick<CleanerRow, "id">,
  booking: Pick<BookingRow, "booking_date" | "booking_time">,
  context: DispatchAvailabilityContext,
) {
  const blocks = context.timeOffByCleaner.get(cleaner.id) ?? [];
  if (blocks.length === 0) {
    return false;
  }

  const bookingRange = bookingRangeToDateMs(booking);
  if (!bookingRange) {
    return false;
  }

  return blocks.some((block) => {
    const start = Date.parse(block.start_at);
    const end = Date.parse(block.end_at);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return false;
    }
    return start < bookingRange.endMs && end > bookingRange.startMs;
  });
}

function isCleanerBusyInSlot(
  cleaner: Pick<CleanerRow, "id">,
  booking: Pick<BookingRow, "booking_date" | "booking_time">,
  context: DispatchAvailabilityContext,
) {
  const busySlots = context.busySlotsByCleaner.get(cleaner.id);
  if (!busySlots || busySlots.size === 0) {
    return false;
  }
  return busySlots.has(slotKey(booking.booking_date, booking.booking_time));
}

function slotKey(bookingDate: string, bookingTime: string) {
  return `${bookingDate}|${bookingTime}`;
}

function dayOfWeekForDate(bookingDate: string) {
  return new Date(`${bookingDate}T00:00:00Z`).getUTCDay();
}

function parseBookingWindowMinutes(bookingTime: string) {
  const [startClock, endClock] = bookingTime.split("-");
  const startMinutes = parseClockToMinutes(startClock);
  const endMinutes = parseClockToMinutes(endClock);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return null;
  }
  return { startMinutes, endMinutes };
}

function parseClockToMinutes(value: string) {
  const [hoursPart, minutesPart] = value.trim().split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return (hours * 60) + minutes;
}

function bookingRangeToDateMs(booking: Pick<BookingRow, "booking_date" | "booking_time">) {
  const [startClock, endClock] = booking.booking_time.split("-");
  if (!startClock || !endClock) {
    return null;
  }

  const start = Date.parse(`${booking.booking_date}T${normalizeClock(startClock)}:00+02:00`);
  const end = Date.parse(`${booking.booking_date}T${normalizeClock(endClock)}:00+02:00`);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return null;
  }
  return { startMs: start, endMs: end };
}

function normalizeClock(value: string) {
  const [hours = "00", minutes = "00"] = value.trim().split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function compactUnique(values: string[]) {
  return Array.from(new Set(values));
}
