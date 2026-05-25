import { getService } from "./services";
import type { BookingDraft, BookingQuote } from "./types";

const addOnPrices = {
  equipment: 9000,
  insideFridge: 6000,
  insideOven: 8000,
  windows: 12000,
  laundry: 9000,
};

const recurringDiscounts = {
  once: 0,
  weekly: 0.12,
  fortnightly: 0.08,
  monthly: 0.04,
};

export function createEmptyBookingDraft(): BookingDraft {
  return {
    serviceSlug: "regular-cleaning",
    frequency: "once",
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
      equipment: false,
      insideFridge: false,
      insideOven: false,
      windows: false,
      laundry: false,
    },
    assignmentMode: "auto",
    requestedCleaners: 1,
    customer: {
      name: "",
      email: "",
      phone: "",
    },
    notes: "",
  };
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

  const addOnHours =
    Number(draft.addOns.insideFridge) * 0.35 +
    Number(draft.addOns.insideOven) * 0.45 +
    Number(draft.addOns.windows) * 0.65 +
    Number(draft.addOns.laundry) * 0.5;

  const categoryMultiplier =
    service.category === "deep" || service.category === "move"
      ? 1.65
      : service.category === "airbnb"
        ? 0.9
        : service.category === "office"
          ? 1.1
          : 1;

  return Math.max(service.minHours, (service.minHours + roomHours + addOnHours) * categoryMultiplier);
}

export function recommendCleaners(draft: BookingDraft) {
  const service = getService(draft.serviceSlug);
  const hours = estimateWorkloadHours(draft);

  if (!service) {
    return 1;
  }

  if (service.requiresTeam) {
    return Math.min(5, Math.max(2, Math.ceil(hours / 3.5)));
  }

  if (service.allowMultipleCleaners) {
    return Math.min(4, Math.max(1, draft.requestedCleaners || Math.ceil(hours / 4.5)));
  }

  return 1;
}

export function calculateQuote(draft: BookingDraft): BookingQuote {
  const service = getService(draft.serviceSlug);

  if (!service) {
    throw new Error("Unknown service");
  }

  const hours = estimateWorkloadHours(draft);
  const cleanerCount = recommendCleaners(draft);
  const lineItems = [
    { label: service.title, amountCents: service.baseCents },
    { label: `${draft.bedrooms} bedroom allocation`, amountCents: draft.bedrooms * 7000 },
    { label: `${draft.bathrooms} bathroom allocation`, amountCents: draft.bathrooms * 8500 },
  ];

  if (draft.extraRooms > 0) {
    lineItems.push({ label: `${draft.extraRooms} extra room allocation`, amountCents: draft.extraRooms * 6500 });
  }

  if (draft.squareMeters > 120) {
    lineItems.push({
      label: "Large property adjustment",
      amountCents: Math.ceil((draft.squareMeters - 120) / 25) * 5500,
    });
  }

  Object.entries(draft.addOns).forEach(([key, enabled]) => {
    if (enabled && key in addOnPrices) {
      lineItems.push({
        label: key.replace(/([A-Z])/g, " $1").toLowerCase(),
        amountCents: addOnPrices[key as keyof typeof addOnPrices],
      });
    }
  });

  if (service.requiresTeam) {
    lineItems.push({
      label: `${cleanerCount}-person team dispatch`,
      amountCents: cleanerCount * 12500,
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
    recommendedTeamSize: service.requiresTeam ? cleanerCount : 0,
    estimatedHours: Number(hours.toFixed(1)),
    requiresTeam: service.requiresTeam,
    lineItems,
    payout,
  };
}

export function calculatePayout(
  draft: BookingDraft,
  totalCents: number,
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
  const perCleanerCents = clamp(Math.round((totalCents * commission) / safeCleanerCount), 25000, 35000);

  return {
    cleanerTotalCents: perCleanerCents * safeCleanerCount,
    perCleanerCents,
    rule: cleanerTenureMonths >= 4 ? "regular job 70% tenure rule" : "regular job 60% starter rule",
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
