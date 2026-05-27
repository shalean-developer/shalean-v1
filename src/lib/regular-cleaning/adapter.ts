import type { BookingDraft } from "@/lib/booking/types";
import type { RegularCleaningBookingInput } from "./types";
import { REGULAR_CLEANING_SLUG } from "./types";

export function bookingDraftToRegularCleaningInput(draft: BookingDraft): RegularCleaningBookingInput {
  const selectedAddonKeys = Object.entries(draft.addOns)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  const selectedCleanerId =
    (draft.preferredCleanerId && isUuid(draft.preferredCleanerId) ? draft.preferredCleanerId : null) ??
    draft.selectedCleanerIds.find(isUuid) ??
    null;

  return {
    checkoutId: draft.checkoutId,
    serviceSlug: REGULAR_CLEANING_SLUG,
    frequency: draft.frequency,
    recurrenceWeekdays: draft.recurrence.weekdays,
    bookingDate: draft.date,
    bookingTime: draft.timeWindow,
    address: draft.address,
    suburb: draft.suburb,
    propertyType: draft.propertyType,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    extraRooms: draft.extraRooms,
    selectedAddonKeys,
    equipmentOptionKey: draft.equipment.mode,
    cleanerCount: draft.requestedCleaners,
    selectedCleanerId,
    accessNotes: draft.notes,
    customer: {
      fullName: draft.customer.name,
      email: draft.customer.email,
      phone: draft.customer.phone,
    },
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
