import { getService } from "./services";
import type { BookingDraft, BookingQuote, PremiumAddOnKey } from "./types";

export type PremiumAddOnDefinition = {
  key: PremiumAddOnKey;
  label: string;
  description: string;
  priceCents: number;
  durationHours: number;
  workloadWeight: number;
};

export const regularCleaningAddOns: PremiumAddOnDefinition[] = [
  {
    key: "insideCabinets",
    label: "Inside Cabinets",
    description: "Kitchen and storage cabinet interiors wiped and reset.",
    priceCents: 9500,
    durationHours: 0.55,
    workloadWeight: 1,
  },
  {
    key: "insideOven",
    label: "Inside Oven",
    description: "Interior oven clean for everyday grease and residue.",
    priceCents: 8500,
    durationHours: 0.5,
    workloadWeight: 1,
  },
  {
    key: "insideFridge",
    label: "Inside Fridge",
    description: "Shelves, trays, and interior fridge surfaces cleaned.",
    priceCents: 7000,
    durationHours: 0.4,
    workloadWeight: 0.8,
  },
  {
    key: "interiorWalls",
    label: "Interior Walls",
    description: "Spot-clean visible wall marks in high-use areas.",
    priceCents: 14000,
    durationHours: 0.8,
    workloadWeight: 1.4,
  },
  {
    key: "laundryIroning",
    label: "Laundry & Ironing",
    description: "Laundry load support for wash, hang, fold, or rotate, plus light household ironing.",
    priceCents: 9000,
    durationHours: 1,
    workloadWeight: 1.2,
  },
  {
    key: "interiorWindows",
    label: "Interior Windows",
    description: "Interior glass, sills, and reachable frames.",
    priceCents: 12500,
    durationHours: 0.75,
    workloadWeight: 1.25,
  },
];

export const equipmentPackage = {
  label: "Cleaning Equipment",
  priceCents: 9000,
  durationHours: 0.15,
  items: [
    "Vacuum cleaner",
    "Mop & bucket",
    "Cleaning chemicals",
    "Microfiber cloths",
    "Professional tools",
  ],
};

const recurringDiscounts = {
  once: 0,
  weekly: 0.12,
  fortnightly: 0.08,
  monthly: 0.04,
};

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
      items: equipmentPackage.items,
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

export function estimateWorkloadHours(draft: BookingDraft) {
  const service = getService(draft.serviceSlug);
  if (!service) {
    return 0;
  }

  const roomHours =
    draft.bedrooms * 0.55 +
    draft.bathrooms * 0.75 +
    draft.extraRooms * 0.45 +
    Math.max(0, draft.squareMeters - 80) / 75;

  const addOnHours = getSelectedAddOns(draft).reduce(
    (total, addOn) => total + addOn.durationHours,
    0,
  );

  const equipmentHours = draft.equipment.mode === "with_equipment" ? equipmentPackage.durationHours : 0;

  const categoryMultiplier =
    service.category === "deep" || service.category === "move"
      ? 1.65
      : service.category === "airbnb"
        ? 0.9
        : service.category === "office"
          ? 1.1
          : 1;

  return Math.max(service.minHours, (service.minHours + roomHours + addOnHours + equipmentHours) * categoryMultiplier);
}

export function recommendCleanerCount(draft: BookingDraft) {
  const service = getService(draft.serviceSlug);
  const hours = estimateWorkloadHours(draft);
  const addOnWeight = getSelectedAddOns(draft).reduce((total, addOn) => total + addOn.workloadWeight, 0);

  if (!service) {
    return 1;
  }

  if (service.requiresTeam) {
    return Math.min(5, Math.max(2, Math.ceil(hours / 3.5)));
  }

  if (service.allowMultipleCleaners) {
    const roomPressure = draft.bedrooms + draft.bathrooms + draft.extraRooms >= 6 ? 1 : 0;
    return Math.min(4, Math.max(1, Math.ceil(hours / 4.5), Math.ceil(addOnWeight / 3), 1 + roomPressure));
  }

  return 1;
}

export function recommendCleaners(draft: BookingDraft) {
  const service = getService(draft.serviceSlug);
  const recommended = recommendCleanerCount(draft);

  if (!service?.allowMultipleCleaners) {
    return recommended;
  }

  return Math.min(4, Math.max(1, draft.requestedCleaners));
}

export function calculateQuote(draft: BookingDraft): BookingQuote {
  const service = getService(draft.serviceSlug);

  if (!service) {
    throw new Error("Unknown service");
  }

  const workloadHours = estimateWorkloadHours(draft);
  const cleanerCount = recommendCleaners(draft);
  const recommendedCleanerCount = recommendCleanerCount(draft);
  const visitHours = Math.max(service.minHours / cleanerCount, workloadHours / cleanerCount);
  const lineItems: BookingQuote["lineItems"] = [
    { label: service.title, amountCents: service.baseCents, category: "base" },
    { label: `${draft.bedrooms} bedroom allocation`, amountCents: draft.bedrooms * 7000, category: "rooms" },
    { label: `${draft.bathrooms} bathroom allocation`, amountCents: draft.bathrooms * 8500, category: "rooms" },
  ];

  if (draft.extraRooms > 0) {
    lineItems.push({ label: `${draft.extraRooms} extra room allocation`, amountCents: draft.extraRooms * 6500, category: "rooms" });
  }

  if (draft.squareMeters > 120) {
    lineItems.push({
      label: "Large property adjustment",
      amountCents: Math.ceil((draft.squareMeters - 120) / 25) * 5500,
      category: "rooms",
    });
  }

  getSelectedAddOns(draft).forEach((addOn) => {
    lineItems.push({
      label: addOn.label,
      amountCents: addOn.priceCents,
      durationHours: addOn.durationHours,
      category: "addon",
    });
  });

  if (draft.equipment.mode === "with_equipment") {
    lineItems.push({
      label: equipmentPackage.label,
      amountCents: equipmentPackage.priceCents,
      durationHours: equipmentPackage.durationHours,
      category: "equipment",
    });
  }

  if (!service.requiresTeam && cleanerCount > 1) {
    lineItems.push({
      label: `${cleanerCount} cleaner team speed-up`,
      amountCents: (cleanerCount - 1) * 18000,
      category: "cleaners",
    });
  }

  if (service.requiresTeam) {
    lineItems.push({
      label: `${cleanerCount}-person team dispatch`,
      amountCents: cleanerCount * 12500,
      category: "team",
    });
  }

  const subtotalCents = lineItems.reduce((total, item) => total + item.amountCents, 0);
  const discountCents = Math.round(subtotalCents * recurringDiscounts[draft.frequency]);
  const totalCents = Math.max(25000, subtotalCents - discountCents);
  const payout = calculatePayout(draft, totalCents, cleanerCount);

  return {
    serviceSlug: service.slug,
    totalCents,
    subtotalCents,
    discountCents,
    cleanerCount,
    recommendedCleanerCount,
    recommendedTeamSize: service.requiresTeam ? cleanerCount : 0,
    estimatedHours: Number(visitHours.toFixed(1)),
    workloadHours: Number(workloadHours.toFixed(1)),
    requiresTeam: service.requiresTeam,
    lineItems,
    addOnTotalCents: getSelectedAddOns(draft).reduce((total, addOn) => total + addOn.priceCents, 0),
    equipmentCents: draft.equipment.mode === "with_equipment" ? equipmentPackage.priceCents : 0,
    payout,
  };
}

export function getSelectedAddOns(draft: BookingDraft) {
  return regularCleaningAddOns.filter((addOn) => draft.addOns[addOn.key]);
}

export function calculatePayout(
  draft: BookingDraft,
  _totalCents: number,
  cleanerCount: number,
  cleanerTenureMonths = 0,
) {
  const service = getService(draft.serviceSlug);
  const safeCleanerCount = Math.max(1, cleanerCount);

  if (!service) {
    return {
      cleanerTotalCents: 25000,
      perCleanerCents: 25000,
      rule: "fallback minimum payout",
    };
  }

  if (service.requiresTeam || service.category === "deep" || service.category === "move") {
    const perCleanerCents = 25000;
    return {
      cleanerTotalCents: perCleanerCents * safeCleanerCount,
      perCleanerCents,
      rule: "team job fixed R250 per cleaner",
    };
  }

  const commission = cleanerTenureMonths >= 4 ? 0.7 : 0.6;
  const eligibleCents =
    draft.bedrooms * 7000 +
    draft.bathrooms * 8500 +
    draft.extraRooms * 6500 +
    getSelectedAddOns(draft).reduce((total, addOn) => total + addOn.priceCents, 0);
  const perCleanerCents = clamp(Math.round(eligibleCents * commission), 25000, 30000);

  return {
    cleanerTotalCents: perCleanerCents * safeCleanerCount,
    perCleanerCents,
    rule: cleanerTenureMonths >= 4 ? "regular job 70% tenure rule" : "regular job 60% starter rule",
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
