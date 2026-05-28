import type {
  RegularCleaningBookingInput,
  RegularCleaningCatalog,
  RegularCleaningPriceBreakdown,
} from "./types";

export function calculateRegularCleaningPrice(
  input: RegularCleaningBookingInput,
  catalog: RegularCleaningCatalog,
): RegularCleaningPriceBreakdown {
  if (!catalog.service?.active) {
    throw new Error("Regular Cleaning service pricing is not configured");
  }

  const bedroomRule = resolvePricingRule(catalog, "bedroom");
  const bathroomRule = resolvePricingRule(catalog, "bathroom");
  const extraRoomRule = resolvePricingRule(catalog, "extra_room");
  const minimumRule = resolvePricingRule(catalog, "minimum_booking");
  const largePropertyRule = catalog.pricingRules.find((rule) => rule.key === "large_property_25sqm" && rule.active);
  const cleanerRule = catalog.cleanerQuantityRule;
  const cleanerCount = clamp(input.cleanerCount, cleanerRule.min_cleaners, cleanerRule.max_cleaners);
  const selectedAddonKeySet = new Set(input.selectedAddonKeys);
  const selectedAddons = catalog.addons
    .filter((addon) => addon.active && selectedAddonKeySet.has(addon.key))
    .map((addon) => ({
      key: addon.key,
      label: addon.label,
      priceCents: safeCents(addon.price_cents),
      durationMinutes: Math.max(0, addon.duration_minutes),
    }));

  const equipmentOption =
    catalog.equipmentOptions.find((option) => option.key === input.equipmentOptionKey && option.active) ??
    catalog.equipmentOptions.find((option) => option.key === "without_equipment");

  if (!equipmentOption) {
    throw new Error("Regular Cleaning equipment options are not configured");
  }

  const addonsTotalCents = selectedAddons.reduce((total, addon) => total + addon.priceCents, 0);
  const equipmentTotalCents = safeCents(equipmentOption.price_cents);
  const extraCleanerCount = Math.max(0, cleanerCount - cleanerRule.included_cleaners);
  const extraCleanersTotalCents = extraCleanerCount * safeCents(cleanerRule.extra_cleaner_price_cents);
  const basePriceCents = safeCents(catalog.service.base_price_cents);
  const bedroomAllocationCents = safeCents(input.bedrooms * bedroomRule.price_cents);
  const bathroomAllocationCents = safeCents(input.bathrooms * bathroomRule.price_cents);
  const extraRoomAllocationCents = safeCents(input.extraRooms * extraRoomRule.price_cents);
  const squareMeterAdjustmentCents = largePropertyRule
    ? safeCents(Math.ceil(Math.max(0, getSquareMeterAdjustment(input)) / 25) * largePropertyRule.price_cents)
    : 0;
  const roomTotalCents = bedroomAllocationCents + bathroomAllocationCents + extraRoomAllocationCents + squareMeterAdjustmentCents;
  const subtotalBeforeMinimumCents = safeCents(
    basePriceCents + roomTotalCents + addonsTotalCents + equipmentTotalCents + extraCleanersTotalCents,
  );
  const minimumAdjustmentCents = Math.max(0, safeCents(minimumRule.price_cents) - subtotalBeforeMinimumCents);
  const finalTotalCents = safeCents(subtotalBeforeMinimumCents + minimumAdjustmentCents);
  const workloadMinutes =
    Math.max(0, catalog.service.default_duration_minutes) +
    input.bedrooms * bedroomRule.estimated_minutes +
    input.bathrooms * bathroomRule.estimated_minutes +
    input.extraRooms * extraRoomRule.estimated_minutes +
    Math.ceil(Math.max(0, getSquareMeterAdjustment(input)) / 25) * (largePropertyRule?.estimated_minutes ?? 0) +
    selectedAddons.reduce((total, addon) => total + addon.durationMinutes, 0);
  const recommendedCleanerCount = clamp(
    Math.ceil(workloadMinutes / cleanerRule.recommended_workload_minutes_per_cleaner),
    cleanerRule.min_cleaners,
    cleanerRule.max_cleaners,
  );

  return {
    serviceSlug: "regular-cleaning",
    basePriceCents,
    roomTotalCents,
    addonsTotalCents,
    equipmentTotalCents,
    extraCleanersTotalCents,
    bedroomAllocationCents,
    bathroomAllocationCents,
    extraRoomAllocationCents,
    largePropertyCents: squareMeterAdjustmentCents,
    minimumAdjustmentCents,
    finalTotalCents,
    estimatedMinutes: Math.ceil(workloadMinutes / cleanerCount),
    workloadMinutes,
    cleanerCount,
    recommendedCleanerCount,
    breakdown: [
      { key: "base", label: catalog.service.title ?? catalog.service.name ?? "Regular Cleaning", amountCents: basePriceCents, category: "base" as const },
      { key: "bedroom", label: `${input.bedrooms} bedroom allocation`, amountCents: bedroomAllocationCents, category: "rooms" as const, durationMinutes: input.bedrooms * bedroomRule.estimated_minutes },
      { key: "bathroom", label: `${input.bathrooms} bathroom allocation`, amountCents: bathroomAllocationCents, category: "rooms" as const, durationMinutes: input.bathrooms * bathroomRule.estimated_minutes },
      ...(input.extraRooms > 0 ? [{
        key: "extra_room",
        label: `${input.extraRooms} extra room allocation`,
        amountCents: extraRoomAllocationCents,
        category: "rooms" as const,
        durationMinutes: input.extraRooms * extraRoomRule.estimated_minutes,
      }] : []),
      ...(squareMeterAdjustmentCents > 0 ? [{
        key: "large_property_25sqm",
        label: "Large property adjustment",
        amountCents: squareMeterAdjustmentCents,
        category: "rooms" as const,
        durationMinutes: Math.ceil(Math.max(0, getSquareMeterAdjustment(input)) / 25) * (largePropertyRule?.estimated_minutes ?? 0),
      }] : []),
      ...selectedAddons.map((addon) => ({
        key: addon.key,
        label: addon.label,
        amountCents: addon.priceCents,
        category: "addon" as const,
        durationMinutes: addon.durationMinutes,
      })),
      ...(equipmentTotalCents > 0 ? [{
        key: equipmentOption.key,
        label: equipmentOption.label,
        amountCents: equipmentTotalCents,
        category: "equipment" as const,
      }] : []),
      ...(extraCleanersTotalCents > 0 ? [{
        key: "extra_cleaners",
        label: `${cleanerCount} cleaner team speed-up`,
        amountCents: extraCleanersTotalCents,
        category: "cleaners" as const,
      }] : []),
      ...(minimumAdjustmentCents > 0 ? [{
        key: "minimum_booking",
        label: "Minimum booking adjustment",
        amountCents: minimumAdjustmentCents,
        category: "minimum" as const,
      }] : []),
    ].filter((item) => item.amountCents > 0 || item.key === "base"),
    selectedAddons,
    equipmentOption: {
      key: equipmentOption.key,
      label: equipmentOption.label,
      priceCents: equipmentTotalCents,
      includedItems: equipmentOption.included_items,
    },
  };
}

function resolvePricingRule(catalog: RegularCleaningCatalog, key: string) {
  const rule = catalog.pricingRules.find((item) => item.key === key && item.active);

  if (!rule) {
    throw new Error(`Regular Cleaning pricing rule is not configured: ${key}`);
  }

  return rule;
}

function getSquareMeterAdjustment(input: RegularCleaningBookingInput) {
  return Math.max(0, input.squareMeters - 120);
}

function safeCents(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
