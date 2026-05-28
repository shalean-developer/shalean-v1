import { describe, expect, it } from "vitest";
import { blocksDispatchForCleanerOfferStatus, isCleanerEligibleForBooking } from "./dispatch";

const cleaner = {
  id: "cleaner-1",
  active: true,
  available: true,
  service_slugs: ["regular-cleaning"],
  suburbs: ["Sea Point"],
};

const booking = {
  suburb: "Sea Point",
  booking_date: "2026-05-28",
  booking_time: "08:00-12:00",
};

describe("isCleanerEligibleForBooking", () => {
  it("returns true for active online cleaners in matching suburbs", () => {
    expect(isCleanerEligibleForBooking(cleaner, booking)).toBe(true);
  });

  it("returns false when cleaner is busy in the same slot", () => {
    const eligible = isCleanerEligibleForBooking(cleaner, booking, {
      weeklyWindowsByCleaner: new Map(),
      timeOffByCleaner: new Map(),
      busySlotsByCleaner: new Map([[cleaner.id, new Set([`${booking.booking_date}|${booking.booking_time}`])]]),
    });

    expect(eligible).toBe(false);
  });

  it("returns false when cleaner has overlapping time off", () => {
    const eligible = isCleanerEligibleForBooking(cleaner, booking, {
      weeklyWindowsByCleaner: new Map(),
      timeOffByCleaner: new Map([[
        cleaner.id,
        [
          {
            id: "time-off-1",
            cleaner_id: cleaner.id,
            start_at: "2026-05-28T07:00:00+02:00",
            end_at: "2026-05-28T09:00:00+02:00",
            reason: "Sick leave",
            created_at: "2026-05-20T08:00:00+02:00",
          },
        ],
      ]]),
      busySlotsByCleaner: new Map(),
    });

    expect(eligible).toBe(false);
  });

  it("returns false when weekly windows do not cover booking slot", () => {
    const eligible = isCleanerEligibleForBooking(cleaner, booking, {
      weeklyWindowsByCleaner: new Map([[
        cleaner.id,
        [
          {
            id: "window-1",
            cleaner_id: cleaner.id,
            day_of_week: 5,
            start_time: "08:00:00",
            end_time: "17:00:00",
            timezone: "Africa/Johannesburg",
            created_at: "2026-05-20T08:00:00+02:00",
          },
        ],
      ]]),
      timeOffByCleaner: new Map(),
      busySlotsByCleaner: new Map(),
    });

    expect(eligible).toBe(false);
  });
});

describe("blocksDispatchForCleanerOfferStatus", () => {
  it("does not block on pending_payment rows", () => {
    expect(blocksDispatchForCleanerOfferStatus("pending_payment")).toBe(false);
  });

  it("blocks on active offer and job statuses", () => {
    expect(blocksDispatchForCleanerOfferStatus("offered")).toBe(true);
    expect(blocksDispatchForCleanerOfferStatus("accepted")).toBe(true);
    expect(blocksDispatchForCleanerOfferStatus("in_progress")).toBe(true);
  });
});
