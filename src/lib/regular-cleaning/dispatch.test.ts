import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import {
  blocksDispatchForCleanerOfferStatus,
  ensureCustomerSelectedCleanerAccepted,
  isBookingEligibleForCleanerDispatch,
  isCleanerEligibleForBooking,
} from "./dispatch";

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

describe("isBookingEligibleForCleanerDispatch", () => {
  it("allows paid confirmed bookings", () => {
    expect(
      isBookingEligibleForCleanerDispatch({
        payment_status: "paid",
        booking_status: "confirmed",
      }),
    ).toBe(true);
  });

  it("allows unpaid confirmed bookings when admin-assisted dispatch is enabled", () => {
    expect(
      isBookingEligibleForCleanerDispatch(
        { payment_status: "pending", booking_status: "confirmed" },
        { allowUnpaid: true },
      ),
    ).toBe(true);
  });

  it("blocks unpaid bookings for the default paid-only dispatch path", () => {
    expect(
      isBookingEligibleForCleanerDispatch({
        payment_status: "pending",
        booking_status: "confirmed",
      }),
    ).toBe(false);
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

describe("ensureCustomerSelectedCleanerAccepted", () => {
  it("promotes selected cleaner to accepted and marks booking as assigned", async () => {
    const booking = {
      id: "booking-1",
      selected_cleaner_id: "cleaner-1",
      cleaner_count: 1,
      booking_status: "confirmed",
      bedrooms: 2,
      bathrooms: 1,
      extra_rooms: 1,
      addons_total_cents: 3000,
    } as Database["public"]["Tables"]["bookings"]["Row"];
    const cleaner = {
      id: "cleaner-1",
      tenure_months: 6,
    } as Database["public"]["Tables"]["cleaners"]["Row"];
    const existingOffer = {
      id: "offer-1",
      booking_id: booking.id,
      cleaner_id: cleaner.id,
      cleaner_count: 1,
      is_preferred: true,
      status: "pending_payment",
      earning_cents: null,
      eligible_value_cents: null,
      earning_rate_percent: null,
      earning_rule: null,
      offered_at: null,
      accepted_at: null,
      started_at: null,
      completed_at: null,
      declined_at: null,
      decline_reason: null,
      offer_expires_at: null,
      created_at: "2026-05-28T08:00:00.000Z",
      updated_at: "2026-05-28T08:00:00.000Z",
    } as Database["public"]["Tables"]["booking_cleaners"]["Row"];
    const supabase = createSupabaseDispatchMock({
      booking,
      offers: [existingOffer],
    });

    const updatedOffers = await ensureCustomerSelectedCleanerAccepted(
      supabase as never,
      booking,
      [cleaner],
      [existingOffer],
    );

    expect(updatedOffers).toHaveLength(1);
    expect(updatedOffers[0]?.status).toBe("accepted");
    expect(updatedOffers[0]?.earning_cents).toBeGreaterThan(0);
    expect(supabase.getBooking().booking_status).toBe("assigned");
  });
});

function createSupabaseDispatchMock({
  booking,
  offers,
}: {
  booking: Database["public"]["Tables"]["bookings"]["Row"];
  offers: Database["public"]["Tables"]["booking_cleaners"]["Row"][];
}) {
  let currentBooking = { ...booking };
  const currentOffers = offers.map((offer) => ({ ...offer }));

  return {
    from(table: string) {
      if (table === "booking_cleaners") {
        let mode: "update" | "insert" | null = null;
        let payload: Record<string, unknown> = {};
        let targetId: string | null = null;

        return {
          update(nextPayload: Record<string, unknown>) {
            mode = "update";
            payload = nextPayload;
            return this;
          },
          insert(nextPayload: Record<string, unknown>) {
            mode = "insert";
            payload = nextPayload;
            return this;
          },
          eq(column: string, value: string) {
            if (column === "id") {
              targetId = value;
            }
            return this;
          },
          select() {
            return this;
          },
          async single() {
            if (mode === "update") {
              const index = currentOffers.findIndex((offer) => offer.id === targetId);
              if (index < 0) {
                return { data: null, error: new Error("Offer not found") };
              }
              const updated = {
                ...currentOffers[index],
                ...payload,
                updated_at: "2026-05-28T08:30:00.000Z",
              } as Database["public"]["Tables"]["booking_cleaners"]["Row"];
              currentOffers[index] = updated;
              return { data: updated, error: null };
            }

            if (mode === "insert") {
              const inserted = {
                id: `offer-${currentOffers.length + 1}`,
                booking_id: payload.booking_id as string,
                cleaner_id: (payload.cleaner_id as string | null) ?? null,
                cleaner_count: payload.cleaner_count as number,
                is_preferred: Boolean(payload.is_preferred),
                status: payload.status as string,
                earning_cents: (payload.earning_cents as number | null) ?? null,
                eligible_value_cents: (payload.eligible_value_cents as number | null) ?? null,
                earning_rate_percent: (payload.earning_rate_percent as number | null) ?? null,
                earning_rule: (payload.earning_rule as string | null) ?? null,
                offered_at: (payload.offered_at as string | null) ?? null,
                accepted_at: (payload.accepted_at as string | null) ?? null,
                started_at: null,
                completed_at: null,
                declined_at: (payload.declined_at as string | null) ?? null,
                decline_reason: (payload.decline_reason as string | null) ?? null,
                offer_expires_at: (payload.offer_expires_at as string | null) ?? null,
                created_at: "2026-05-28T08:00:00.000Z",
                updated_at: "2026-05-28T08:30:00.000Z",
              } as Database["public"]["Tables"]["booking_cleaners"]["Row"];
              currentOffers.push(inserted);
              return { data: inserted, error: null };
            }

            return { data: null, error: new Error("Unsupported booking_cleaners operation") };
          },
        };
      }

      if (table === "bookings") {
        return {
          update(payload: Record<string, unknown>) {
            return {
              async eq(column: string, value: string) {
                if (column !== "id" || value !== currentBooking.id) {
                  return { error: new Error("Booking not found") };
                }
                currentBooking = {
                  ...currentBooking,
                  ...payload,
                } as Database["public"]["Tables"]["bookings"]["Row"];
                return { error: null };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    getBooking() {
      return currentBooking;
    },
    getOffers() {
      return currentOffers;
    },
  };
}
