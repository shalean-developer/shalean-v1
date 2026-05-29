// Shalean email templates.
//
// Each template is a pure function that takes typed data and returns a subject +
// HTML + plain-text body. Templates never read environment or perform I/O, so
// they are trivially unit-testable and safe to render inside the outbox worker.

import { formatZar } from "@/lib/utils";
import {
  renderButton,
  renderDetailRows,
  renderEmailLayout,
  shaleanBrand,
  textDetailRows,
  type DetailRow,
  type EmailContent,
} from "./branding";

export type NotificationType =
  | "booking_confirmation"
  | "invoice_created"
  | "payment_link"
  | "payment_received"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "admin_new_booking"
  | "admin_invoice_created"
  | "admin_payment_received"
  | "admin_customer_registered"
  | "admin_payment_failed";

export type BookingConfirmationData = {
  customerName: string;
  bookingReference: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  suburb?: string | null;
  address?: string | null;
  amountCents?: number | null;
  manageUrl?: string | null;
};

export type InvoiceCreatedData = {
  customerName: string;
  invoiceNumber: string;
  serviceName: string;
  amountCents: number;
  invoiceUrl?: string | null;
  dueDate?: string | null;
};

export type PaymentReceivedData = {
  customerName: string;
  bookingReference: string;
  serviceName: string;
  amountCents: number;
  paymentReference?: string | null;
};

export type PaymentLinkData = {
  customerName: string;
  bookingReference: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  suburb?: string | null;
  address?: string | null;
  amountCents: number;
  paymentUrl: string;
  invoiceNumber?: string | null;
};

export type BookingCancelledData = {
  customerName: string;
  bookingReference: string;
  serviceName: string;
  bookingDate?: string | null;
  reason?: string | null;
};

export type BookingRescheduledData = {
  customerName: string;
  bookingReference: string;
  serviceName: string;
  newDate: string;
  newTime: string;
  previousDate?: string | null;
  previousTime?: string | null;
};

export type AdminNewBookingData = {
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  bookingReference: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  suburb?: string | null;
  amountCents?: number | null;
  adminUrl?: string | null;
};

export type AdminInvoiceCreatedData = {
  customerName: string;
  invoiceNumber: string;
  serviceName: string;
  amountCents: number;
  invoiceUrl?: string | null;
};

export type AdminPaymentReceivedData = {
  customerName: string;
  bookingReference: string;
  serviceName: string;
  amountCents: number;
  paymentReference?: string | null;
};

export type AdminCustomerRegisteredData = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
};

export type AdminPaymentFailedData = {
  customerName?: string | null;
  bookingReference: string;
  serviceName?: string | null;
  amountCents?: number | null;
  reason?: string | null;
};

function money(amountCents?: number | null): string {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) {
    return "";
  }
  return formatZar(amountCents);
}

function dateTime(date?: string | null, time?: string | null): string {
  return [date, time].filter((part) => Boolean(part)).join(" at ");
}

function section(rows: DetailRow[], extraHtml = ""): Pick<EmailContent, "html" | "text"> & { html: string; text: string } {
  return {
    html: `${renderDetailRows(rows)}${extraHtml}`,
    text: textDetailRows(rows),
  };
}

// ---------------------------------------------------------------------------
// Customer templates
// ---------------------------------------------------------------------------

export function BookingConfirmationEmail(data: BookingConfirmationData): EmailContent {
  const rows: DetailRow[] = [
    { label: "Booking reference", value: data.bookingReference },
    { label: "Service", value: data.serviceName },
    { label: "When", value: dateTime(data.bookingDate, data.bookingTime) },
    { label: "Where", value: [data.address, data.suburb].filter(Boolean).join(", ") },
    { label: "Total", value: money(data.amountCents) },
  ];
  const button = data.manageUrl ? renderButton("View my booking", data.manageUrl) : "";
  const body = section(rows, button);
  const layout = renderEmailLayout({
    heading: "Your booking is confirmed",
    intro: `Hi ${data.customerName}, thank you for booking with ${shaleanBrand.shortName}. Here are your booking details.`,
    bodyHtml: body.html,
    bodyText: body.text,
  });
  return { subject: `Booking confirmed - ${data.bookingReference}`, ...layout };
}

export function InvoiceCreatedEmail(data: InvoiceCreatedData): EmailContent {
  const rows: DetailRow[] = [
    { label: "Invoice number", value: data.invoiceNumber },
    { label: "Billed to", value: data.customerName },
    { label: "Service", value: data.serviceName },
    { label: "Amount", value: money(data.amountCents) },
    { label: "Due date", value: data.dueDate ?? "" },
  ];
  const callout = renderInvoiceCallout(data.invoiceNumber, money(data.amountCents));
  const button = data.invoiceUrl ? renderButton("View invoice", data.invoiceUrl) : "";
  const body = section(rows, button);
  const layout = renderEmailLayout({
    heading: "Your invoice is ready",
    intro: `Hi ${data.customerName}, invoice ${data.invoiceNumber} for ${data.serviceName} has been created. Your PDF invoice is attached.`,
    bodyHtml: `${callout}${body.html}`,
    bodyText: `Invoice number: ${data.invoiceNumber}\n${body.text}`,
  });
  return { subject: `Invoice ${data.invoiceNumber} from ${shaleanBrand.shortName}`, ...layout };
}

function renderInvoiceCallout(invoiceNumber: string, amount: string): string {
  const { colors } = shaleanBrand;
  const safeNumber = invoiceNumber
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const safeAmount = amount
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:separate;">
      <tr>
        <td style="padding:16px 18px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;">
          <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:${colors.brandDark};font-weight:700;">Invoice number</p>
          <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:${colors.text};">${safeNumber}</p>
          ${safeAmount ? `<p style="margin:6px 0 0;font-size:14px;color:${colors.muted};">Amount due: <span style="color:${colors.text};font-weight:700;">${safeAmount}</span></p>` : ""}
        </td>
      </tr>
    </table>`;
}

export function PaymentReceivedEmail(data: PaymentReceivedData): EmailContent {
  const rows: DetailRow[] = [
    { label: "Booking reference", value: data.bookingReference },
    { label: "Service", value: data.serviceName },
    { label: "Amount paid", value: money(data.amountCents) },
    { label: "Payment reference", value: data.paymentReference ?? "" },
  ];
  const body = section(rows);
  const layout = renderEmailLayout({
    heading: "Payment received - thank you!",
    intro: `Hi ${data.customerName}, we've received your payment. Your booking is all set.`,
    bodyHtml: body.html,
    bodyText: body.text,
  });
  return { subject: `Payment received - ${data.bookingReference}`, ...layout };
}

export function PaymentLinkEmail(data: PaymentLinkData): EmailContent {
  const rows: DetailRow[] = [
    { label: "Booking reference", value: data.bookingReference },
    { label: "Invoice number", value: data.invoiceNumber ?? "" },
    { label: "Service", value: data.serviceName },
    { label: "When", value: dateTime(data.bookingDate, data.bookingTime) },
    { label: "Where", value: [data.address, data.suburb].filter(Boolean).join(", ") },
    { label: "Amount due", value: money(data.amountCents) },
  ];
  const button = renderButton("Log in to pay", data.paymentUrl);
  const body = section(rows, button);
  const layout = renderEmailLayout({
    heading: "Complete your payment",
    intro: `Hi ${data.customerName}, your ${data.serviceName} booking with ${shaleanBrand.shortName} is reserved. Log in to your Shalean dashboard to review the details and pay securely.`,
    bodyHtml: body.html,
    bodyText: `${body.text}\n\nLog in to your dashboard to pay: ${data.paymentUrl}`,
  });
  return { subject: `Payment link for your booking - ${data.bookingReference}`, ...layout };
}

export function BookingCancelledEmail(data: BookingCancelledData): EmailContent {
  const rows: DetailRow[] = [
    { label: "Booking reference", value: data.bookingReference },
    { label: "Service", value: data.serviceName },
    { label: "Was scheduled for", value: data.bookingDate ?? "" },
    { label: "Reason", value: data.reason ?? "" },
  ];
  const body = section(rows);
  const layout = renderEmailLayout({
    heading: "Your booking has been cancelled",
    intro: `Hi ${data.customerName}, your booking has been cancelled. If this wasn't expected, please get in touch and we'll help right away.`,
    bodyHtml: body.html,
    bodyText: body.text,
  });
  return { subject: `Booking cancelled - ${data.bookingReference}`, ...layout };
}

export function BookingRescheduledEmail(data: BookingRescheduledData): EmailContent {
  const rows: DetailRow[] = [
    { label: "Booking reference", value: data.bookingReference },
    { label: "Service", value: data.serviceName },
    { label: "New date & time", value: dateTime(data.newDate, data.newTime) },
    { label: "Previously", value: dateTime(data.previousDate, data.previousTime) },
  ];
  const body = section(rows);
  const layout = renderEmailLayout({
    heading: "Your booking has been rescheduled",
    intro: `Hi ${data.customerName}, your booking has a new date and time. Here are the updated details.`,
    bodyHtml: body.html,
    bodyText: body.text,
  });
  return { subject: `Booking rescheduled - ${data.bookingReference}`, ...layout };
}

// ---------------------------------------------------------------------------
// Admin templates
// ---------------------------------------------------------------------------

export function AdminNewBookingEmail(data: AdminNewBookingData): EmailContent {
  const rows: DetailRow[] = [
    { label: "Booking reference", value: data.bookingReference },
    { label: "Customer", value: data.customerName },
    { label: "Email", value: data.customerEmail ?? "" },
    { label: "Phone", value: data.customerPhone ?? "" },
    { label: "Service", value: data.serviceName },
    { label: "When", value: dateTime(data.bookingDate, data.bookingTime) },
    { label: "Suburb", value: data.suburb ?? "" },
    { label: "Total", value: money(data.amountCents) },
  ];
  const button = data.adminUrl ? renderButton("Open in admin", data.adminUrl) : "";
  const body = section(rows, button);
  const layout = renderEmailLayout({
    heading: "New booking received",
    intro: `A new booking was just created by ${data.customerName}.`,
    bodyHtml: body.html,
    bodyText: body.text,
  });
  return { subject: `New booking - ${data.bookingReference} (${data.customerName})`, ...layout };
}

export function AdminInvoiceCreatedEmail(data: AdminInvoiceCreatedData): EmailContent {
  const rows: DetailRow[] = [
    { label: "Invoice number", value: data.invoiceNumber },
    { label: "Customer", value: data.customerName },
    { label: "Service", value: data.serviceName },
    { label: "Amount", value: money(data.amountCents) },
  ];
  const button = data.invoiceUrl ? renderButton("View in Zoho Books", data.invoiceUrl) : "";
  const body = section(rows, button);
  const layout = renderEmailLayout({
    heading: "Invoice created",
    intro: `A Zoho Books invoice was created for ${data.customerName}.`,
    bodyHtml: body.html,
    bodyText: body.text,
  });
  return { subject: `Invoice created - ${data.invoiceNumber} (${data.customerName})`, ...layout };
}

export function AdminPaymentReceivedEmail(data: AdminPaymentReceivedData): EmailContent {
  const rows: DetailRow[] = [
    { label: "Booking reference", value: data.bookingReference },
    { label: "Customer", value: data.customerName },
    { label: "Service", value: data.serviceName },
    { label: "Amount paid", value: money(data.amountCents) },
    { label: "Payment reference", value: data.paymentReference ?? "" },
  ];
  const body = section(rows);
  const layout = renderEmailLayout({
    heading: "Payment received",
    intro: `A payment was successfully reconciled for ${data.customerName}.`,
    bodyHtml: body.html,
    bodyText: body.text,
  });
  return { subject: `Payment received - ${data.bookingReference} (${data.customerName})`, ...layout };
}

export function AdminCustomerRegisteredEmail(data: AdminCustomerRegisteredData): EmailContent {
  const rows: DetailRow[] = [
    { label: "Customer", value: data.customerName },
    { label: "Email", value: data.customerEmail },
    { label: "Phone", value: data.customerPhone ?? "" },
  ];
  const body = section(rows);
  const layout = renderEmailLayout({
    heading: "New customer registered",
    intro: `${data.customerName} just registered with ${shaleanBrand.shortName}.`,
    bodyHtml: body.html,
    bodyText: body.text,
  });
  return { subject: `New customer - ${data.customerName}`, ...layout };
}

export function AdminPaymentFailedEmail(data: AdminPaymentFailedData): EmailContent {
  const rows: DetailRow[] = [
    { label: "Booking reference", value: data.bookingReference },
    { label: "Customer", value: data.customerName ?? "" },
    { label: "Service", value: data.serviceName ?? "" },
    { label: "Amount", value: money(data.amountCents) },
    { label: "Reason", value: data.reason ?? "" },
  ];
  const body = section(rows);
  const layout = renderEmailLayout({
    heading: "Payment failed",
    intro: `A payment attempt failed for booking ${data.bookingReference}. It may need follow-up.`,
    bodyHtml: body.html,
    bodyText: body.text,
  });
  return { subject: `Payment failed - ${data.bookingReference}`, ...layout };
}

// ---------------------------------------------------------------------------
// Registry: render a notification from its type + JSON payload data.
// Defensive coercion keeps the worker crash-free even if a payload is malformed.
// ---------------------------------------------------------------------------

type TemplateDataMap = {
  booking_confirmation: BookingConfirmationData;
  invoice_created: InvoiceCreatedData;
  payment_link: PaymentLinkData;
  payment_received: PaymentReceivedData;
  booking_cancelled: BookingCancelledData;
  booking_rescheduled: BookingRescheduledData;
  admin_new_booking: AdminNewBookingData;
  admin_invoice_created: AdminInvoiceCreatedData;
  admin_payment_received: AdminPaymentReceivedData;
  admin_customer_registered: AdminCustomerRegisteredData;
  admin_payment_failed: AdminPaymentFailedData;
};

const registry: { [K in NotificationType]: (data: TemplateDataMap[K]) => EmailContent } = {
  booking_confirmation: BookingConfirmationEmail,
  invoice_created: InvoiceCreatedEmail,
  payment_link: PaymentLinkEmail,
  payment_received: PaymentReceivedEmail,
  booking_cancelled: BookingCancelledEmail,
  booking_rescheduled: BookingRescheduledEmail,
  admin_new_booking: AdminNewBookingEmail,
  admin_invoice_created: AdminInvoiceCreatedEmail,
  admin_payment_received: AdminPaymentReceivedEmail,
  admin_customer_registered: AdminCustomerRegisteredEmail,
  admin_payment_failed: AdminPaymentFailedEmail,
};

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && value in registry;
}

/**
 * Render any notification by type using a loosely-typed data record (as stored
 * in notification_outbox.payload). Throws only for unknown types so the worker
 * can mark such a row failed without retrying forever.
 */
export function renderNotification(type: NotificationType, data: Record<string, unknown>): EmailContent {
  const builder = registry[type] as (data: Record<string, unknown>) => EmailContent;
  return builder(data);
}
