import { describe, expect, it } from "vitest";
import {
  bookingNeedsAction,
  computeBookingsOperationsMetrics,
  countNeedsAction,
  formatBookingReference,
} from "@/lib/admin/bookings-ui";
import type { AdminBookingListItem } from "@/lib/admin/data";

function booking(overrides: Partial<AdminBookingListItem> = {}): AdminBookingListItem {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: "00000000-0000-4000-8000-000000000001",
    booking_reference: "SHL-TEST001",
    booking_date: today,
    booking_time: "08:00-12:00",
    booking_status: "confirmed",
    payment_status: "pending",
    invoice_status: "pending",
    zoho_sync_status: "pending",
    final_total_cents: 10000,
    amount_paid_cents: 0,
    selected_cleaner_id: null,
    address: "1 Main Rd",
    suburb: "Sea Point",
    customer: { full_name: "Test User", email: "t@example.com", phone: "0820000000" } as AdminBookingListItem["customer"],
    payment: null,
    ...overrides,
  } as AdminBookingListItem;
}

describe("formatBookingReference", () => {
  it("uses booking_reference when present", () => {
    expect(formatBookingReference(booking())).toBe("SHL-TEST001");
  });
});

describe("bookingNeedsAction", () => {
  const today = new Date().toISOString().slice(0, 10);

  it("flags unassigned confirmed bookings", () => {
    expect(bookingNeedsAction(booking({ selected_cleaner_id: null }), today)).toBe(true);
  });

  it("flags failed zoho sync", () => {
    expect(
      bookingNeedsAction(
        booking({ zoho_sync_status: "failed", selected_cleaner_id: "cleaner-1" }),
        today,
      ),
    ).toBe(true);
  });
});

describe("computeBookingsOperationsMetrics", () => {
  it("counts today's bookings", () => {
    const today = new Date().toISOString().slice(0, 10);
    const metrics = computeBookingsOperationsMetrics([
      booking({ booking_date: today }),
      booking({ id: "2", booking_date: "2000-01-01" }),
    ]);
    expect(metrics.todaysBookings).toBe(1);
  });
});

describe("countNeedsAction", () => {
  it("counts bookings needing action", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(countNeedsAction([booking(), booking({ selected_cleaner_id: "c1", payment_status: "paid" })], today)).toBe(1);
  });
});
