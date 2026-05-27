import type { Database } from "@/lib/supabase/database.types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type CleanerRow = Database["public"]["Tables"]["cleaners"]["Row"];

const bedroomAllocationCents = 7000;
const bathroomAllocationCents = 8500;
const extraRoomAllocationCents = 6500;
const minimumRegularCleanerEarningCents = 25000;
const maximumRegularCleanerEarningCents = 30000;

export type RegularCleaningEarningInput = {
  bedrooms: number;
  bathrooms: number;
  extraRooms: number;
  addonsTotalCents: number;
  tenureMonths: number;
};

export type RegularCleaningEarningSnapshot = {
  earningCents: number;
  eligibleValueCents: number;
  earningRatePercent: 60 | 70;
  earningRule: string;
};

export function calculateRegularCleaningEarning(input: RegularCleaningEarningInput): RegularCleaningEarningSnapshot {
  const earningRatePercent = input.tenureMonths >= 4 ? 70 : 60;
  const eligibleValueCents = safeCents(
    input.bedrooms * bedroomAllocationCents +
      input.bathrooms * bathroomAllocationCents +
      input.extraRooms * extraRoomAllocationCents +
      input.addonsTotalCents,
  );
  const earningCents = clamp(
    Math.round(eligibleValueCents * (earningRatePercent / 100)),
    minimumRegularCleanerEarningCents,
    maximumRegularCleanerEarningCents,
  );

  return {
    earningCents,
    eligibleValueCents,
    earningRatePercent,
    earningRule:
      earningRatePercent === 70
        ? "Regular Cleaning 70% tenure rule, capped R250-R300"
        : "Regular Cleaning 60% starter rule, capped R250-R300",
  };
}

export function calculateRegularCleaningEarningForBooking(
  booking: Pick<BookingRow, "bedrooms" | "bathrooms" | "extra_rooms" | "addons_total_cents">,
  cleaner: Pick<CleanerRow, "tenure_months">,
) {
  return calculateRegularCleaningEarning({
    bedrooms: booking.bedrooms,
    bathrooms: booking.bathrooms,
    extraRooms: booking.extra_rooms,
    addonsTotalCents: booking.addons_total_cents,
    tenureMonths: cleaner.tenure_months,
  });
}

export function isValidRegularCleaningEarning(snapshot: RegularCleaningEarningSnapshot) {
  return Number.isFinite(snapshot.earningCents) && snapshot.earningCents > 0;
}

function safeCents(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
