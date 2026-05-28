import { describe, expect, it } from "vitest";
import { buildRegularCleaningOccurrences } from "./recurrence";
import type { RegularCleaningBookingInput } from "./types";

const baseInput: RegularCleaningBookingInput = {
  checkoutId: "checkout-test",
  serviceSlug: "regular-cleaning",
  frequency: "once",
  recurrenceWeekdays: [],
  bookingDate: "2026-06-01",
  bookingTime: "08:00-12:00",
  address: "1 Test Street",
  suburb: "Sea Point",
  propertyType: "apartment",
  bedrooms: 2,
  bathrooms: 1,
  extraRooms: 0,
  squareMeters: 80,
  selectedAddonKeys: [],
  equipmentOptionKey: "without_equipment",
  cleanerCount: 1,
  selectedCleanerId: null,
  customer: {
    fullName: "Test Customer",
    email: "test@example.com",
    phone: "0210000000",
  },
};

describe("Regular Cleaning recurrence", () => {
  it("generates weekly occurrences for each selected weekday", () => {
    const occurrences = buildRegularCleaningOccurrences({
      ...baseInput,
      frequency: "weekly",
      bookingDate: "2026-06-01",
      recurrenceWeekdays: [1, 3, 5],
    });

    expect(occurrences.map((occurrence) => occurrence.bookingDate)).toEqual([
      "2026-06-01",
      "2026-06-03",
      "2026-06-05",
      "2026-06-08",
      "2026-06-10",
      "2026-06-12",
      "2026-06-15",
      "2026-06-17",
    ]);
  });

  it("generates bi-weekly occurrences on alternate weeks", () => {
    const occurrences = buildRegularCleaningOccurrences({
      ...baseInput,
      frequency: "fortnightly",
      bookingDate: "2026-06-01",
      recurrenceWeekdays: [1, 3],
    });

    expect(occurrences.map((occurrence) => occurrence.bookingDate)).toEqual([
      "2026-06-01",
      "2026-06-03",
      "2026-06-15",
      "2026-06-17",
      "2026-06-29",
      "2026-07-01",
      "2026-07-13",
      "2026-07-15",
    ]);
  });

  it("generates monthly occurrences on the same clamped day of month", () => {
    const occurrences = buildRegularCleaningOccurrences({
      ...baseInput,
      frequency: "monthly",
      bookingDate: "2026-01-31",
    });

    expect(occurrences.map((occurrence) => occurrence.bookingDate)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
    ]);
  });
});
