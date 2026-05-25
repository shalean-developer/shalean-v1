import type { BookingLifecycleStatus } from "./types";

export const bookingTransitions: Record<BookingLifecycleStatus, BookingLifecycleStatus[]> = {
  draft: ["quote_ready", "cancelled"],
  quote_ready: ["payment_pending", "draft", "cancelled"],
  payment_pending: ["paid", "cancelled"],
  paid: ["assignment_pending", "refunded"],
  assignment_pending: ["offered", "assigned", "cancelled"],
  offered: ["assigned", "assignment_pending", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: ["payout_ready", "refunded"],
  payout_ready: ["paid_out"],
  paid_out: [],
  cancelled: ["refunded"],
  refunded: [],
};

export function canTransitionBooking(from: BookingLifecycleStatus, to: BookingLifecycleStatus) {
  return bookingTransitions[from].includes(to);
}

export function assertBookingTransition(from: BookingLifecycleStatus, to: BookingLifecycleStatus) {
  if (!canTransitionBooking(from, to)) {
    throw new Error(`Invalid booking transition from ${from} to ${to}`);
  }
}
