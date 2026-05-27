import type {
  RegularCleaningBookingInput,
  RegularCleaningCatalog,
  RegularCleaningPriceBreakdown,
  RegularPricingRuleRow,
} from "./types";

export function calculateRegularCleaningPrice(
  input: RegularCleaningBookingInput,
  catalog: RegularCleaningCatalog,
): RegularCleaningPriceBreakdown {
  const cleanerRule = catalog.cleanerQuantityRule;
  const cleanerCount = clamp(input.cleanerCount, cleanerRule.min_cleaners, cleanerRule.max_cleaners);
  const baseRule = resolveBasePricingRule(input.bedrooms, input.bathrooms, catalog.pricingRules);
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
  const basePriceCents = safeCents(baseRule.base_price_cents);
  const bedroomAllocationCents = safeCents(input.bedrooms * 7000);
  const bathroomAllocationCents = safeCents(input.bathrooms * 8500);
  const extraRoomAllocationCents = safeCents(input.extraRooms * 6500);
  const finalTotalCents = safeCents(
    basePriceCents + extraRoomAllocationCents + addonsTotalCents + equipmentTotalCents + extraCleanersTotalCents,
  );
  const workloadMinutes =
    baseRule.estimated_minutes +
    input.extraRooms * 25 +
    selectedAddons.reduce((total, addon) => total + addon.durationMinutes, 0);
  const recommendedCleanerCount = clamp(
    Math.ceil(workloadMinutes / cleanerRule.recommended_workload_minutes_per_cleaner),
    cleanerRule.min_cleaners,
    cleanerRule.max_cleaners,
  );

  return {
    serviceSlug: "regular-cleaning",
    basePriceCents,
    addonsTotalCents,
    equipmentTotalCents,
    extraCleanersTotalCents,
    bedroomAllocationCents,
    bathroomAllocationCents,
    extraRoomAllocationCents,
    finalTotalCents,
    estimatedMinutes: Math.ceil(workloadMinutes / cleanerCount),
    cleanerCount,
    recommendedCleanerCount,
    selectedAddons,
    equipmentOption: {
      key: equipmentOption.key,
      label: equipmentOption.label,
      priceCents: equipmentTotalCents,
      includedItems: equipmentOption.included_items,
    },
  };
}

function resolveBasePricingRule(
  bedrooms: number,
  bathrooms: number,
  pricingRules: RegularPricingRuleRow[],
) {
  const activeRules = pricingRules.filter((rule) => rule.active);
  const exactRule = activeRules.find((rule) => rule.bedrooms === bedrooms && rule.bathrooms === bathrooms);

  if (exactRule) {
    return exactRule;
  }

  const fallbackRule = activeRules
    .toSorted((a, b) => b.bedrooms + b.bathrooms - (a.bedrooms + a.bathrooms))
    .find((rule) => rule.bedrooms <= bedrooms && rule.bathrooms <= bathrooms);

  if (!fallbackRule) {
    throw new Error("Regular Cleaning bedroom/bathroom pricing is not configured");
  }

  return {
    ...fallbackRule,
    base_price_cents:
      fallbackRule.base_price_cents +
      Math.max(0, bedrooms - fallbackRule.bedrooms) * 12000 +
      Math.max(0, bathrooms - fallbackRule.bathrooms) * 9000,
    estimated_minutes:
      fallbackRule.estimated_minutes +
      Math.max(0, bedrooms - fallbackRule.bedrooms) * 35 +
      Math.max(0, bathrooms - fallbackRule.bathrooms) * 30,
  };
}

function safeCents(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
