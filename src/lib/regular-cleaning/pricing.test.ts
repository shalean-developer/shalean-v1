import { describe, expect, it } from "vitest";
import { calculateRegularCleaningPrice } from "./pricing";
import { buildRegularCleaningBookingInsert } from "./repository";
import type { RegularCleaningBookingInput, RegularCleaningCatalog } from "./types";

const catalog: RegularCleaningCatalog = {
  serviceSlug: "regular-cleaning",
  service: null,
  addons: [
    {
      id: "addon-oven",
      service_slug: "regular-cleaning",
      key: "insideOven",
      label: "Inside Oven",
      description: "Interior oven clean",
      price_cents: 8500,
      duration_minutes: 30,
      workload_weight: 1,
      active: true,
      sort_order: 10,
    },
    {
      id: "addon-windows",
      service_slug: "regular-cleaning",
      key: "interiorWindows",
      label: "Interior Windows",
      description: "Interior glass and sills",
      price_cents: 12500,
      duration_minutes: 45,
      workload_weight: 1.25,
      active: true,
      sort_order: 20,
    },
  ],
  equipmentOptions: [
    {
      id: "equipment-without",
      service_slug: "regular-cleaning",
      key: "without_equipment",
      label: "Without Equipment",
      description: "Customer equipment",
      price_cents: 0,
      included_items: [],
      active: true,
      sort_order: 10,
    },
    {
      id: "equipment-with",
      service_slug: "regular-cleaning",
      key: "with_equipment",
      label: "With Equipment",
      description: "Shalean equipment",
      price_cents: 9000,
      included_items: ["Vacuum cleaner", "Mop & bucket"],
      active: true,
      sort_order: 20,
    },
  ],
  cleanerQuantityRule: {
    id: "quantity-rule",
    service_slug: "regular-cleaning",
    min_cleaners: 1,
    max_cleaners: 4,
    included_cleaners: 1,
    extra_cleaner_price_cents: 18000,
    recommended_workload_minutes_per_cleaner: 270,
    active: true,
  },
  pricingRules: [
    {
      id: "price-2-1",
      bedrooms: 2,
      bathrooms: 1,
      base_price_cents: 52000,
      estimated_minutes: 210,
      active: true,
    },
  ],
  cleaners: [],
};

const input: RegularCleaningBookingInput = {
  checkoutId: "checkout-test",
  serviceSlug: "regular-cleaning",
  frequency: "once",
  recurrenceWeekdays: [],
  bookingDate: "2026-06-01",
  bookingTime: "08:00-12:00",
  address: "12 Main Road",
  suburb: "Sea Point",
  propertyType: "house",
  bedrooms: 2,
  bathrooms: 1,
  extraRooms: 0,
  selectedAddonKeys: ["insideOven", "interiorWindows"],
  equipmentOptionKey: "with_equipment",
  cleanerCount: 2,
  selectedCleanerId: null,
  customer: {
    fullName: "Test Customer",
    email: "test@example.com",
    phone: "+27820000000",
  },
};

describe("Regular Cleaning pricing", () => {
  it("calculates final cents from base, add-ons, equipment, and extra cleaners", () => {
    const quote = calculateRegularCleaningPrice(input, catalog);

    expect(quote.basePriceCents).toBe(52000);
    expect(quote.addonsTotalCents).toBe(21000);
    expect(quote.equipmentTotalCents).toBe(9000);
    expect(quote.extraCleanersTotalCents).toBe(18000);
    expect(quote.finalTotalCents).toBe(100000);
    expect(quote.finalTotalCents).toBeGreaterThanOrEqual(0);
  });

  it("builds a booking insert with selected add-ons, equipment, cleaner count, and price breakdown", () => {
    const quote = calculateRegularCleaningPrice(input, catalog);
    const booking = buildRegularCleaningBookingInsert(input, "customer-id", quote, null);

    expect(booking.service_slug).toBe("regular-cleaning");
    expect(booking.selected_addons).toHaveLength(2);
    expect(booking.equipment_option).toBe("with_equipment");
    expect(booking.cleaner_count).toBe(2);
    expect(booking.selected_cleaner_id).toBeNull();
    expect(booking.final_total_cents).toBe(100000);
    expect(booking.pricing_snapshot).toMatchObject({
      basePriceCents: 52000,
      equipmentTotalCents: 9000,
      extraCleanersTotalCents: 18000,
    });
  });

  it("throws a configuration error when no active pricing rules exist", () => {
    const emptyPricingCatalog: RegularCleaningCatalog = {
      ...catalog,
      pricingRules: [],
    };

    expect(() => calculateRegularCleaningPrice(input, emptyPricingCatalog))
      .toThrow("Regular Cleaning bedroom/bathroom pricing is not configured");
  });
});
