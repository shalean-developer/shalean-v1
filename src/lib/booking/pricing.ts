import type { BookingDraft } from "./types";

export function createEmptyBookingDraft(): BookingDraft {
  return {
    checkoutId: createCheckoutId(),
    serviceSlug: "regular-cleaning",
    frequency: "once",
    recurrence: {
      weekdays: [],
    },
    date: "",
    timeWindow: "08:00-12:00",
    address: "",
    suburb: "Sea Point",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 1,
    extraRooms: 0,
    squareMeters: 80,
    addOns: {
      insideCabinets: false,
      insideOven: false,
      insideFridge: false,
      interiorWalls: false,
      laundryIroning: false,
      interiorWindows: false,
    },
    equipment: {
      mode: "without_equipment",
      items: [],
    },
    assignmentMode: "auto",
    selectedCleanerIds: [],
    requestedCleaners: 1,
    customer: {
      name: "",
      email: "",
      phone: "",
    },
    notes: "",
  };
}

function createCheckoutId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "00000000-0000-4000-8000-000000000000";
}
