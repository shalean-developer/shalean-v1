import type { AdminBookingListItem } from "@/lib/admin/data";

export type BookingSource = "admin" | "online";

export type BookingsTab = "all" | "needs_action" | "upcoming" | "completed" | "cancelled";

/** Quick filters applied when an operations action card is clicked. */
export type BookingsActionFilter =
  | "needs_action"
  | "unassigned"
  | "pending_payment"
  | "invoice_issues"
  | "zoho_failed"
  | "todays_jobs";

export type BookingsActionMetrics = {
  needsActionCount: number;
  unassignedCount: number;
  pendingPaymentCount: number;
  invoiceIssuesCount: number;
  zohoSyncErrorsCount: number;
  todaysJobsCount: number;
};

const MANUAL_PAYMENT_METHODS = new Set(["eft", "cash", "card", "corporate", "other"]);

const INACTIVE_BOOKING_STATUSES = new Set(["cancelled", "completed", "draft"]);

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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

export function bookingIsUnassigned(booking: AdminBookingListItem) {
  return !booking.selected_cleaner_id && !INACTIVE_BOOKING_STATUSES.has(booking.booking_status);
}

/** Bookings with payment_status pending (used for the Pending Payments action card). */
export function bookingPaymentStatusPending(booking: AdminBookingListItem) {
  return paymentStatusForBooking(booking) === "pending" && booking.booking_status !== "cancelled";
}

/** Any unpaid booking (broader — used inside Needs Action). */
export function bookingHasPendingPayment(booking: AdminBookingListItem) {
  const status = paymentStatusForBooking(booking);
  return status !== "paid" && status !== "refunded" && booking.booking_status !== "cancelled";
}

export function bookingHasZohoSyncError(booking: AdminBookingListItem) {
  return booking.zoho_sync_status === "failed";
}

export function bookingHasInvoiceIssue(booking: AdminBookingListItem, todayIso: string) {
  if (INACTIVE_BOOKING_STATUSES.has(booking.booking_status)) return false;

  const invoiceStatus = booking.invoice_status ?? "pending";
  if (invoiceStatus === "voided") return true;

  const paymentStatus = paymentStatusForBooking(booking);
  const unpaid = paymentStatus !== "paid" && paymentStatus !== "refunded";

  if (invoiceStatus === "pending" && unpaid) return true;
  if (invoiceStatus === "created" && isPaymentOverdue(booking, todayIso)) return true;

  return false;
}

export function bookingNeedsManualPaymentReview(booking: AdminBookingListItem) {
  const method = booking.payment_method?.toLowerCase();
  if (!method || method === "paystack" || !MANUAL_PAYMENT_METHODS.has(method)) return false;

  const paymentStatus = paymentStatusForBooking(booking);
  if (paymentStatus === "paid" || paymentStatus === "refunded") return false;
  if (booking.booking_status === "cancelled") return false;

  return paymentStatus === "pending" || paymentStatus === "partially_paid" || booking.amount_paid_cents > 0;
}

export function bookingIsTodaysJob(booking: AdminBookingListItem, todayIso: string) {
  return booking.booking_date === todayIso && booking.booking_status !== "cancelled";
}

export function bookingNeedsAction(
  booking: AdminBookingListItem,
  todayIso: string,
): boolean {
  return (
    bookingIsUnassigned(booking) ||
    bookingHasPendingPayment(booking) ||
    bookingHasInvoiceIssue(booking, todayIso) ||
    bookingHasZohoSyncError(booking) ||
    bookingNeedsManualPaymentReview(booking) ||
    isPaymentOverdue(booking, todayIso)
  );
}

export function matchesBookingsActionFilter(
  booking: AdminBookingListItem,
  filter: BookingsActionFilter,
  todayIso: string,
): boolean {
  switch (filter) {
    case "needs_action":
      return bookingNeedsAction(booking, todayIso);
    case "unassigned":
      return bookingIsUnassigned(booking);
    case "pending_payment":
      return bookingPaymentStatusPending(booking);
    case "invoice_issues":
      return bookingHasInvoiceIssue(booking, todayIso);
    case "zoho_failed":
      return bookingHasZohoSyncError(booking);
    case "todays_jobs":
      return bookingIsTodaysJob(booking, todayIso);
    default:
      return true;
  }
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

export function computeBookingsActionMetrics(
  bookings: AdminBookingListItem[],
): BookingsActionMetrics {
  const todayIso = formatDateKey(new Date());

  return {
    needsActionCount: countNeedsAction(bookings, todayIso),
    unassignedCount: bookings.filter(bookingIsUnassigned).length,
    pendingPaymentCount: bookings.filter(bookingPaymentStatusPending).length,
    invoiceIssuesCount: bookings.filter((booking) => bookingHasInvoiceIssue(booking, todayIso)).length,
    zohoSyncErrorsCount: bookings.filter(bookingHasZohoSyncError).length,
    todaysJobsCount: bookings.filter((booking) => bookingIsTodaysJob(booking, todayIso)).length,
  };
}

/** @deprecated Use computeBookingsActionMetrics — kept for gradual migration if imported elsewhere. */
export type BookingsOperationsMetrics = BookingsActionMetrics;

export function computeBookingsOperationsMetrics(bookings: AdminBookingListItem[]): BookingsActionMetrics {
  return computeBookingsActionMetrics(bookings);
}
