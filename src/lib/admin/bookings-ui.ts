import type { AdminBookingListItem } from "@/lib/admin/data";

export type BookingSource = "admin" | "online";

export type BookingsTab = "all" | "needs_action" | "upcoming" | "completed" | "cancelled";

export type BookingsOperationsMetrics = {
  todaysBookings: number;
  todaysBookingsDelta: number;
  pendingPaymentCount: number;
  pendingPaymentCents: number;
  pendingAssignmentCount: number;
  completedTodayCount: number;
  completedTodayDelta: number;
  overdueInvoicesCount: number;
  overdueInvoicesCents: number;
  revenueThisMonthCents: number;
  revenueMonthDeltaPercent: number | null;
};

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDateKey(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

export function paymentStatusForBooking(booking: AdminBookingListItem) {
  return booking.payment?.status ?? booking.payment_status;
}

export function bookingSourceFor(
  booking: AdminBookingListItem,
  adminCreatedBookingIds: ReadonlySet<string>,
): BookingSource {
  return adminCreatedBookingIds.has(booking.id) ? "admin" : "online";
}

export function formatBookingReference(booking: AdminBookingListItem) {
  if (booking.booking_reference) return booking.booking_reference;
  return `SHL-${booking.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function isPaymentOverdue(booking: AdminBookingListItem, todayIso: string) {
  const status = paymentStatusForBooking(booking);
  if (status === "paid" || status === "refunded") return false;
  if (booking.booking_status === "cancelled") return false;
  return booking.booking_date < todayIso;
}

export function bookingNeedsAction(
  booking: AdminBookingListItem,
  todayIso: string,
): boolean {
  const paymentStatus = paymentStatusForBooking(booking);
  const missingCleaner =
    !booking.selected_cleaner_id &&
    !["cancelled", "completed", "draft"].includes(booking.booking_status);
  const pendingPayment = paymentStatus !== "paid" && paymentStatus !== "refunded";
  const zohoFailed = booking.zoho_sync_status === "failed";
  const invoiceIssue =
    booking.invoice_status === "voided" ||
    (pendingPayment && booking.invoice_status === "created" && isPaymentOverdue(booking, todayIso));

  return (
    missingCleaner ||
    pendingPayment ||
    zohoFailed ||
    invoiceIssue ||
    isPaymentOverdue(booking, todayIso)
  );
}

export function matchesBookingsTab(
  booking: AdminBookingListItem,
  tab: BookingsTab,
  todayIso: string,
): boolean {
  if (tab === "all") return true;
  if (tab === "cancelled") return booking.booking_status === "cancelled";
  if (tab === "completed") return booking.booking_status === "completed";
  if (tab === "upcoming") {
    return booking.booking_date >= todayIso && !["cancelled", "completed"].includes(booking.booking_status);
  }
  if (tab === "needs_action") {
    return bookingNeedsAction(booking, todayIso);
  }
  return true;
}

export function countNeedsAction(bookings: AdminBookingListItem[], todayIso: string) {
  return bookings.filter((booking) => bookingNeedsAction(booking, todayIso)).length;
}

export function computeBookingsOperationsMetrics(
  bookings: AdminBookingListItem[],
): BookingsOperationsMetrics {
  const todayIso = formatDateKey(new Date());
  const yesterdayIso = shiftDateKey(todayIso, -1);
  const monthStartIso = `${todayIso.slice(0, 8)}01`;
  const lastMonthStart = shiftDateKey(monthStartIso, -1);
  const lastMonthEnd = shiftDateKey(monthStartIso, -1);

  const todayBookings = bookings.filter((booking) => booking.booking_date === todayIso);
  const yesterdayBookings = bookings.filter((booking) => booking.booking_date === yesterdayIso);
  const completedToday = bookings.filter(
    (booking) => booking.booking_status === "completed" && booking.booking_date === todayIso,
  );
  const completedYesterday = bookings.filter(
    (booking) => booking.booking_status === "completed" && booking.booking_date === yesterdayIso,
  );

  const pendingPaymentBookings = bookings.filter((booking) => {
    const status = paymentStatusForBooking(booking);
    return status !== "paid" && status !== "refunded" && booking.booking_status !== "cancelled";
  });

  const pendingAssignment = bookings.filter(
    (booking) =>
      !booking.selected_cleaner_id &&
      !["cancelled", "completed", "draft"].includes(booking.booking_status),
  );

  const overdueInvoices = bookings.filter((booking) => {
    const status = paymentStatusForBooking(booking);
    if (status === "paid" || status === "refunded") return false;
    if (booking.booking_status === "cancelled") return false;
    return (
      booking.invoice_status === "created" &&
      booking.booking_date < todayIso
    );
  });

  const thisMonthPaid = bookings.filter((booking) => {
    const status = paymentStatusForBooking(booking);
    return (
      status === "paid" &&
      booking.booking_date >= monthStartIso &&
      booking.booking_date <= todayIso
    );
  });

  const lastMonthPaid = bookings.filter((booking) => {
    const status = paymentStatusForBooking(booking);
    return (
      status === "paid" &&
      booking.booking_date >= lastMonthStart &&
      booking.booking_date <= lastMonthEnd
    );
  });

  const revenueThisMonthCents = thisMonthPaid.reduce((total, booking) => total + booking.final_total_cents, 0);
  const revenueLastMonthCents = lastMonthPaid.reduce((total, booking) => total + booking.final_total_cents, 0);
  const revenueMonthDeltaPercent =
    revenueLastMonthCents > 0
      ? Math.round(((revenueThisMonthCents - revenueLastMonthCents) / revenueLastMonthCents) * 100)
      : null;

  return {
    todaysBookings: todayBookings.length,
    todaysBookingsDelta: todayBookings.length - yesterdayBookings.length,
    pendingPaymentCount: pendingPaymentBookings.length,
    pendingPaymentCents: pendingPaymentBookings.reduce((total, booking) => total + booking.final_total_cents, 0),
    pendingAssignmentCount: pendingAssignment.length,
    completedTodayCount: completedToday.length,
    completedTodayDelta: completedToday.length - completedYesterday.length,
    overdueInvoicesCount: overdueInvoices.length,
    overdueInvoicesCents: overdueInvoices.reduce((total, booking) => total + booking.final_total_cents, 0),
    revenueThisMonthCents,
    revenueMonthDeltaPercent,
  };
}
