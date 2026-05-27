import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { calculateRegularCleaningEarningForBooking, isValidRegularCleaningEarning } from "./earnings";
import { REGULAR_CLEANING_SLUG } from "./types";

type Supabase = SupabaseClient<Database>;
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type BookingCleanerRow = Database["public"]["Tables"]["booking_cleaners"]["Row"];
type CleanerRow = Database["public"]["Tables"]["cleaners"]["Row"];

const activeOfferStatuses = ["pending_payment", "offered", "accepted"];

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

  for (const booking of bookings) {
    await dispatchOffersForBooking(supabase, booking, cleaners, existingOffers.filter((offer) => offer.booking_id === booking.id));
  }
}

async function dispatchOffersForBooking(
  supabase: Supabase,
  booking: BookingRow,
  cleaners: CleanerRow[],
  existingOffers: BookingCleanerRow[],
) {
  const acceptedCount = existingOffers.filter((offer) => offer.status === "accepted").length;
  const activeOffers = existingOffers.filter((offer) => activeOfferStatuses.includes(offer.status) && offer.cleaner_id);

  if (acceptedCount >= booking.cleaner_count || activeOffers.some((offer) => offer.status === "offered")) {
    return;
  }

  const eligibleCleaners = cleaners
    .filter((cleaner) => isCleanerEligibleForBooking(cleaner, booking))
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
  cleaner: Pick<CleanerRow, "active" | "available" | "service_slugs" | "suburbs">,
  booking: Pick<BookingRow, "suburb">,
) {
  return (
    cleaner.active &&
    cleaner.available &&
    cleaner.service_slugs.includes(REGULAR_CLEANING_SLUG) &&
    cleaner.suburbs.includes(booking.suburb)
  );
}
