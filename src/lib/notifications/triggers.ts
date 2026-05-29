// High-level notification triggers for Shalean domain events.
//
// Each function maps a business event to one or more outbox rows (customer +
// admin). They are best-effort and never throw: a notification problem can never
// break booking creation, payment reconciliation, or invoice sync.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { appUrl, siteConfig } from "@/lib/config/site";
import { slugToTitle } from "@/lib/utils";
import { getEmailAddresses } from "@/lib/email/client";
import { enqueueNotification } from "./outbox";

type Supabase = SupabaseClient<Database>;

export type BookingLike = {
  id: string;
  service_slug: string;
  booking_date: string;
  booking_time: string;
  suburb?: string | null;
  address?: string | null;
  final_total_cents?: number | null;
};

export type CustomerLike = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

/** Stable customer-facing booking reference (mirrors the Zoho sync format). */
export function bookingReference(bookingId: string): string {
  return `SHL-${bookingId.slice(0, 8).toUpperCase()}`;
}

function customerName(customer: CustomerLike): string {
  return customer.full_name?.trim() || "there";
}

function manageUrl(): string {
  return `${siteConfig.url.replace(/\/$/, "")}/bookings`;
}

function adminBookingsUrl(): string {
  return `${siteConfig.url.replace(/\/$/, "")}/admin/bookings`;
}

/**
 * Customer-facing link to a specific booking on the Shalean dashboard, where the
 * customer can view their invoice. Customers must never be sent the raw Zoho
 * Books app URL (that is a staff-only back-office link).
 */
function customerBookingUrl(bookingId: string): string {
  return `${appUrl()}/dashboard?booking=${bookingId}`;
}

async function safe(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error("NOTIFICATION_TRIGGER_FAILED", {
      label,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyBookingCreated(
  supabase: Supabase,
  args: { booking: BookingLike; customer: CustomerLike },
): Promise<void> {
  const addresses = getEmailAddresses();
  const ref = bookingReference(args.booking.id);
  const serviceName = slugToTitle(args.booking.service_slug);

  await safe("booking_created", async () => {
    if (args.customer.email) {
      await enqueueNotification(supabase, {
        type: "booking_confirmation",
        to: args.customer.email,
        replyTo: addresses.bookings,
        data: {
          customerName: customerName(args.customer),
          bookingReference: ref,
          serviceName,
          bookingDate: args.booking.booking_date,
          bookingTime: args.booking.booking_time,
          suburb: args.booking.suburb ?? null,
          address: args.booking.address ?? null,
          amountCents: args.booking.final_total_cents ?? null,
          manageUrl: manageUrl(),
        },
      });
    }

    await enqueueNotification(supabase, {
      type: "admin_new_booking",
      to: addresses.bookings,
      data: {
        customerName: customerName(args.customer),
        customerEmail: args.customer.email ?? null,
        customerPhone: args.customer.phone ?? null,
        bookingReference: ref,
        serviceName,
        bookingDate: args.booking.booking_date,
        bookingTime: args.booking.booking_time,
        suburb: args.booking.suburb ?? null,
        amountCents: args.booking.final_total_cents ?? null,
        adminUrl: adminBookingsUrl(),
      },
    });
  });
}

export async function notifyPaymentReceived(
  supabase: Supabase,
  args: { booking: BookingLike; customer: CustomerLike; amountCents: number; paymentReference?: string | null },
): Promise<void> {
  const addresses = getEmailAddresses();
  const ref = bookingReference(args.booking.id);
  const serviceName = slugToTitle(args.booking.service_slug);

  await safe("payment_received", async () => {
    if (args.customer.email) {
      await enqueueNotification(supabase, {
        type: "payment_received",
        to: args.customer.email,
        replyTo: addresses.accounts,
        data: {
          customerName: customerName(args.customer),
          bookingReference: ref,
          serviceName,
          amountCents: args.amountCents,
          paymentReference: args.paymentReference ?? null,
        },
      });
    }

    await enqueueNotification(supabase, {
      type: "admin_payment_received",
      to: addresses.accounts,
      data: {
        customerName: customerName(args.customer),
        bookingReference: ref,
        serviceName,
        amountCents: args.amountCents,
        paymentReference: args.paymentReference ?? null,
      },
    });
  });
}

export async function notifyPaymentFailed(
  supabase: Supabase,
  args: { booking: BookingLike; customer?: CustomerLike; amountCents?: number | null; reason?: string | null },
): Promise<void> {
  const addresses = getEmailAddresses();
  const ref = bookingReference(args.booking.id);

  await safe("payment_failed", async () => {
    await enqueueNotification(supabase, {
      type: "admin_payment_failed",
      to: addresses.accounts,
      data: {
        customerName: args.customer ? customerName(args.customer) : null,
        bookingReference: ref,
        serviceName: slugToTitle(args.booking.service_slug),
        amountCents: args.amountCents ?? null,
        reason: args.reason ?? null,
      },
    });
  });
}

export async function notifyBookingCancelled(
  supabase: Supabase,
  args: { booking: BookingLike; customer: CustomerLike; reason?: string | null },
): Promise<void> {
  const addresses = getEmailAddresses();
  if (!args.customer.email) return;
  const ref = bookingReference(args.booking.id);

  await safe("booking_cancelled", async () => {
    await enqueueNotification(supabase, {
      type: "booking_cancelled",
      to: args.customer.email as string,
      replyTo: addresses.support,
      data: {
        customerName: customerName(args.customer),
        bookingReference: ref,
        serviceName: slugToTitle(args.booking.service_slug),
        bookingDate: args.booking.booking_date,
        reason: args.reason ?? null,
      },
    });
  });
}

export async function notifyBookingRescheduled(
  supabase: Supabase,
  args: {
    booking: BookingLike;
    customer: CustomerLike;
    newDate: string;
    newTime: string;
    previousDate?: string | null;
    previousTime?: string | null;
  },
): Promise<void> {
  const addresses = getEmailAddresses();
  if (!args.customer.email) return;
  const ref = bookingReference(args.booking.id);

  await safe("booking_rescheduled", async () => {
    await enqueueNotification(supabase, {
      type: "booking_rescheduled",
      to: args.customer.email as string,
      replyTo: addresses.support,
      data: {
        customerName: customerName(args.customer),
        bookingReference: ref,
        serviceName: slugToTitle(args.booking.service_slug),
        newDate: args.newDate,
        newTime: args.newTime,
        previousDate: args.previousDate ?? null,
        previousTime: args.previousTime ?? null,
      },
    });
  });
}

export async function notifyInvoiceCreated(
  supabase: Supabase,
  args: {
    /**
     * Booking the invoice belongs to. Used to build the customer's "View invoice"
     * link into the Shalean dashboard (never the Zoho Books app URL).
     */
    bookingId: string;
    customerEmail?: string | null;
    customerName: string;
    invoiceNumber: string;
    serviceName: string;
    amountCents: number;
    /** Zoho Books app URL — staff-only. Used for the admin copy, never the customer. */
    invoiceUrl?: string | null;
    dueDate?: string | null;
    /** Base64-encoded invoice PDF, attached to the email when present. */
    pdfBase64?: string | null;
    /**
     * Whether to email the customer. Defaults to true. Set false for unpaid
     * admin-issued invoices — the customer is instead sent a Shalean payment-link
     * email that points to their dashboard, not the Zoho invoice.
     */
    notifyCustomer?: boolean;
  },
): Promise<void> {
  const addresses = getEmailAddresses();
  const notifyCustomer = args.notifyCustomer ?? true;
  const attachments = args.pdfBase64
    ? [
        {
          filename: `Invoice-${args.invoiceNumber}.pdf`.replace(/[^A-Za-z0-9._-]/g, "_"),
          content: args.pdfBase64,
          contentType: "application/pdf",
        },
      ]
    : undefined;

  await safe("invoice_created", async () => {
    if (notifyCustomer && args.customerEmail) {
      await enqueueNotification(supabase, {
        type: "invoice_created",
        to: args.customerEmail,
        replyTo: addresses.accounts,
        attachments,
        data: {
          customerName: args.customerName,
          invoiceNumber: args.invoiceNumber,
          serviceName: args.serviceName,
          amountCents: args.amountCents,
          // Customer link points to the Shalean dashboard, NOT the Zoho app URL.
          invoiceUrl: customerBookingUrl(args.bookingId),
          dueDate: args.dueDate ?? null,
        },
      });
    }

    await enqueueNotification(supabase, {
      type: "admin_invoice_created",
      to: addresses.accounts,
      attachments,
      data: {
        customerName: args.customerName,
        invoiceNumber: args.invoiceNumber,
        serviceName: args.serviceName,
        amountCents: args.amountCents,
        invoiceUrl: args.invoiceUrl ?? null,
      },
    });
  });
}

export async function notifyPaymentLink(
  supabase: Supabase,
  args: {
    booking: BookingLike;
    customer: CustomerLike;
    amountCents: number;
    paymentUrl: string;
    invoiceNumber?: string | null;
  },
): Promise<void> {
  const addresses = getEmailAddresses();
  if (!args.customer.email) return;
  const ref = bookingReference(args.booking.id);

  await safe("payment_link", async () => {
    await enqueueNotification(supabase, {
      type: "payment_link",
      to: args.customer.email as string,
      replyTo: addresses.accounts,
      data: {
        customerName: customerName(args.customer),
        bookingReference: ref,
        serviceName: slugToTitle(args.booking.service_slug),
        bookingDate: args.booking.booking_date,
        bookingTime: args.booking.booking_time,
        suburb: args.booking.suburb ?? null,
        address: args.booking.address ?? null,
        amountCents: args.amountCents,
        paymentUrl: args.paymentUrl,
        invoiceNumber: args.invoiceNumber ?? null,
      },
    });
  });
}

export async function notifyCustomerRegistered(
  supabase: Supabase,
  args: { fullName: string; email: string; phone?: string | null },
): Promise<void> {
  const addresses = getEmailAddresses();

  await safe("customer_registered", async () => {
    await enqueueNotification(supabase, {
      type: "admin_customer_registered",
      to: addresses.admin,
      data: {
        customerName: args.fullName,
        customerEmail: args.email,
        customerPhone: args.phone ?? null,
      },
    });
  });
}
