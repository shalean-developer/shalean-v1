import type { Database } from "@/lib/supabase/database.types";

export const REGULAR_CLEANING_SLUG = "regular-cleaning";

export type ServiceAddonRow = Database["public"]["Tables"]["service_addons"]["Row"];
export type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
export type EquipmentOptionRow = Database["public"]["Tables"]["service_equipment_options"]["Row"];
export type CleanerQuantityRuleRow = Database["public"]["Tables"]["cleaner_quantity_rules"]["Row"];
export type RegularPricingRuleRow = Database["public"]["Tables"]["regular_cleaning_pricing_rules"]["Row"];
export type CleanerRow = Database["public"]["Tables"]["cleaners"]["Row"];

export type RegularCleaningCatalog = {
  serviceSlug: typeof REGULAR_CLEANING_SLUG;
  service: ServiceRow | null;
  addons: ServiceAddonRow[];
  equipmentOptions: EquipmentOptionRow[];
  cleanerQuantityRule: CleanerQuantityRuleRow;
  pricingRules: RegularPricingRuleRow[];
  cleaners: CleanerRow[];
};

export type RegularCleaningBookingInput = {
  checkoutId: string;
  serviceSlug: typeof REGULAR_CLEANING_SLUG;
  frequency: "once" | "weekly" | "fortnightly" | "monthly";
  recurrenceWeekdays: number[];
  bookingDate: string;
  bookingTime: string;
  address: string;
  suburb: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  extraRooms: number;
  selectedAddonKeys: string[];
  equipmentOptionKey: "without_equipment" | "with_equipment";
  cleanerCount: number;
  selectedCleanerId?: string | null;
  accessNotes?: string | null;
  customer: {
    fullName: string;
    email: string;
    phone: string;
  };
};

export type RegularCleaningOccurrence = {
  index: number;
  bookingDate: string;
  bookingTime: string;
};

export type RegularCleaningPriceBreakdown = {
  serviceSlug: typeof REGULAR_CLEANING_SLUG;
  basePriceCents: number;
  addonsTotalCents: number;
  equipmentTotalCents: number;
  extraCleanersTotalCents: number;
  bedroomAllocationCents: number;
  bathroomAllocationCents: number;
  extraRoomAllocationCents: number;
  finalTotalCents: number;
  estimatedMinutes: number;
  cleanerCount: number;
  recommendedCleanerCount: number;
  selectedAddons: Array<{
    key: string;
    label: string;
    priceCents: number;
    durationMinutes: number;
  }>;
  equipmentOption: {
    key: string;
    label: string;
    priceCents: number;
    includedItems: string[];
  };
};

export type RegularCleaningQuoteResponse = {
  quote: RegularCleaningPriceBreakdown;
  occurrences: RegularCleaningOccurrence[];
  isRecurring: boolean;
  seriesTotalCents: number;
};
