"use server";

import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth/server";
import { ensurePaystackPaymentLink } from "@/lib/admin/billing";
import { loadCustomerBookingDetail } from "@/lib/dashboard/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Customer-initiated payment for an unpaid booking from their own dashboard.
 *
 * SECURITY: requires a logged-in customer and verifies the booking belongs to
 * them (loadCustomerBookingDetail scopes by the session's customer id) before
 * creating/reusing the Paystack payment link and redirecting to checkout.
 */
export async function payBookingAction(formData: FormData) {
  const { user } = await requireCustomer();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  if (!bookingId) {
    redirect("/bookings?pay=notfound");
  }

  // Ownership check: only returns the booking if it belongs to this customer.
  const { booking } = await loadCustomerBookingDetail({
    bookingId,
    customerAuthUserId: user.id,
    customerEmail: user.email,
  });
  if (!booking) {
    redirect("/bookings?pay=notfound");
  }
  if (booking.payment_status === "paid") {
    redirect(`/dashboard?booking=${booking.id}&pay=already`);
  }

  const link = await ensurePaystackPaymentLink(createSupabaseAdminClient(), booking.id);
  if (link.ok && "authorizationUrl" in link && link.authorizationUrl) {
    redirect(link.authorizationUrl);
  }
  if (link.ok && "alreadyPaid" in link && link.alreadyPaid) {
    redirect(`/dashboard?booking=${booking.id}&pay=already`);
  }

  redirect(`/dashboard?booking=${booking.id}&pay=error`);
}
