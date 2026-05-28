import { describe, expect, it } from "vitest";
import { calculateRegularCleaningPrice } from "./pricing";
import { buildRegularCleaningBookingInsert } from "./repository";
import type { RegularCleaningBookingInput, RegularCleaningCatalog } from "./types";

const now = "2026-05-28T00:00:00.000Z";

const catalog: RegularCleaningCatalog = {
  serviceSlug: "regular-cleaning",
  service: {
    id: "service-regular",
    slug: "regular-cleaning",
    title: "Regular Cleaning",
    name: "Regular Cleaning",
    category: "regular",
    description: "Regular cleaning",
    default_duration_minutes: 120,
    base_price_cents: 30000,
    currency: "ZAR",
    active: true,
    min_hours: 3,
    requires_team: false,
    created_at: now,
    updated_at: now,
  },
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
      created_at: now,
      updated_at: now,
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
      created_at: now,
      updated_at: now,
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
      created_at: now,
      updated_at: now,
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
      created_at: now,
      updated_at: now,
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
    created_at: now,
    updated_at: now,
  },
  pricingRules: [
    {
      id: "rule-bedroom",
      service_slug: "regular-cleaning",
      key: "bedroom",
      name: "Price per bedroom",
      description: null,
      price_cents: 7000,
      estimated_minutes: 35,
      active: true,
      sort_order: 10,
      created_at: now,
      updated_at: now,
    },
    {
      id: "rule-bathroom",
      service_slug: "regular-cleaning",
      key: "bathroom",
      name: "Price per bathroom",
      description: null,
      price_cents: 8500,
      estimated_minutes: 45,
      active: true,
      sort_order: 20,
      created_at: now,
      updated_at: now,
    },
    {
      id: "rule-extra-room",
      service_slug: "regular-cleaning",
      key: "extra_room",
      name: "Price per extra room",
      description: null,
      price_cents: 6500,
      estimated_minutes: 25,
      active: true,
      sort_order: 30,
      created_at: now,
      updated_at: now,
    },
    {
      id: "rule-minimum",
      service_slug: "regular-cleaning",
      key: "minimum_booking",
      name: "Minimum booking",
      description: null,
      price_cents: 35000,
      estimated_minutes: 0,
      active: true,
      sort_order: 40,
      created_at: now,
      updated_at: now,
    },
  ],
  recurringPricingRules: [
    {
      id: "recurring-once",
      service_slug: "regular-cleaning",
      key: "once",
      name: "Once-off",
      description: null,
      multiplier: 1,
      prepaid_visits: 1,
      active: true,
      sort_order: 10,
      created_at: now,
      updated_at: now,
    },
  ],
  legacyPricingRules: [],
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
  squareMeters: 80,
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

    expect(quote.basePriceCents).toBe(30000);
    expect(quote.roomTotalCents).toBe(22500);
    expect(quote.addonsTotalCents).toBe(21000);
    expect(quote.equipmentTotalCents).toBe(9000);
    expect(quote.extraCleanersTotalCents).toBe(18000);
    expect(quote.finalTotalCents).toBe(100500);
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
    expect(booking.final_total_cents).toBe(100500);
    expect(booking.pricing_snapshot).toMatchObject({
      basePriceCents: 30000,
      equipmentTotalCents: 9000,
      extraCleanersTotalCents: 18000,
    });
  });

  it("throws a configuration error when no active pricing rules exist", () => {
    const emptyPricingCatalog: RegularCleaningCatalog = {
      ...catalog,
      pricingRules: catalog.pricingRules.filter((rule) => rule.key !== "bedroom"),
    };

    expect(() => calculateRegularCleaningPrice(input, emptyPricingCatalog))
      .toThrow("Regular Cleaning pricing rule is not configured: bedroom");
  });
});
