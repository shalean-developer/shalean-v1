import { describe, expect, it } from "vitest";
import { calculateRegularCleaningEarning } from "./earnings";

describe("Regular Cleaning cleaner earnings", () => {
  it("uses eligible cleaning value only for starter cleaners", () => {
    const earning = calculateRegularCleaningEarning({
      bedrooms: 3,
      bathrooms: 2,
      extraRooms: 1,
      addonsTotalCents: 21000,
      tenureMonths: 2,
    });

    expect(earning.eligibleValueCents).toBe(65500);
    expect(earning.earningRatePercent).toBe(60);
    expect(earning.earningCents).toBe(30000);
  });

  it("uses the 70 percent tenure rule for cleaners with four or more months", () => {
    const earning = calculateRegularCleaningEarning({
      bedrooms: 1,
      bathrooms: 1,
      extraRooms: 0,
      addonsTotalCents: 0,
      tenureMonths: 4,
    });

    expect(earning.earningRatePercent).toBe(70);
    expect(earning.earningCents).toBe(25000);
  });

  it("caps every individual cleaner earning between R250 and R300", () => {
    expect(calculateRegularCleaningEarning({
      bedrooms: 0,
      bathrooms: 0,
      extraRooms: 0,
      addonsTotalCents: 0,
      tenureMonths: 0,
    }).earningCents).toBe(25000);

    expect(calculateRegularCleaningEarning({
      bedrooms: 8,
      bathrooms: 5,
      extraRooms: 4,
      addonsTotalCents: 40000,
      tenureMonths: 12,
    }).earningCents).toBe(30000);
  });
});
