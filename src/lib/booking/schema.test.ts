import { describe, expect, it } from "vitest";
import { bookingDraftSchema, quoteRequestSchema } from "./schema";
import { createEmptyBookingDraft } from "./pricing";

function futureDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

function validDraft() {
  return {
    ...createEmptyBookingDraft(),
    date: futureDate(),
    address: "20 Sloop Street",
    customer: {
      name: "Shalean Team",
      email: "info@shalean.co.za",
      phone: "0825915525",
    },
  };
}

describe("booking draft schema", () => {
  it("rejects past booking dates", () => {
    const result = bookingDraftSchema.safeParse({
      ...validDraft(),
      date: "2000-01-01",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes("date"))).toBe(true);
  });

  it("caps Regular Cleaning cleaner quantity at four", () => {
    const result = bookingDraftSchema.safeParse({
      ...validDraft(),
      requestedCleaners: 5,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes("requestedCleaners"))).toBe(true);
  });

  it("allows partial quote requests without a selected date but still rejects past dates", () => {
    expect(quoteRequestSchema.safeParse({ ...validDraft(), date: "" }).success).toBe(true);
    expect(quoteRequestSchema.safeParse({ ...validDraft(), date: "2000-01-01" }).success).toBe(false);
  });
});
