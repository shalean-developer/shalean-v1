import { describe, expect, it } from "vitest";
import { formatZar } from "@/lib/utils";
import { shaleanBrand } from "./branding";
import {
  AdminCustomerRegisteredEmail,
  AdminInvoiceCreatedEmail,
  AdminNewBookingEmail,
  AdminPaymentReceivedEmail,
  BookingConfirmationEmail,
  BookingCancelledEmail,
  BookingRescheduledEmail,
  InvoiceCreatedEmail,
  PaymentLinkEmail,
  PaymentReceivedEmail,
  isNotificationType,
  renderNotification,
} from "./templates";

describe("email templates - Shalean branding", () => {
  const samples = [
    BookingConfirmationEmail({
      customerName: "Thandi",
      bookingReference: "SHL-ABC12345",
      serviceName: "Regular Cleaning",
      bookingDate: "2026-06-01",
      bookingTime: "09:00",
      amountCents: 45000,
    }),
    PaymentReceivedEmail({
      customerName: "Thandi",
      bookingReference: "SHL-ABC12345",
      serviceName: "Regular Cleaning",
      amountCents: 45000,
    }),
    BookingCancelledEmail({
      customerName: "Thandi",
      bookingReference: "SHL-ABC12345",
      serviceName: "Regular Cleaning",
    }),
    AdminNewBookingEmail({
      customerName: "Thandi",
      bookingReference: "SHL-ABC12345",
      serviceName: "Regular Cleaning",
      bookingDate: "2026-06-01",
      bookingTime: "09:00",
    }),
  ];

  it("includes the brand name, both phone numbers and website in every template", () => {
    for (const email of samples) {
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.html).toContain(shaleanBrand.name);
      expect(email.html).toContain("087 153 5250");
      expect(email.html).toContain("082 591 5525");
      expect(email.html).toContain("www.shalean.com");
      // Plain-text part is always present for deliverability.
      expect(email.text).toContain("Shalean");
      expect(email.text).toContain("087 153 5250");
    }
  });

  it("contains no leftover test/placeholder data", () => {
    for (const email of samples) {
      expect(email.html.toLowerCase()).not.toContain("example.com");
      expect(email.html.toLowerCase()).not.toContain("lorem ipsum");
      expect(email.html).not.toContain("undefined");
      expect(email.html).not.toContain("NaN");
    }
  });
});

describe("invoice emails", () => {
  it("renders invoice number, customer name, service, amount and Zoho URL", () => {
    const email = InvoiceCreatedEmail({
      customerName: "Sipho Dlamini",
      invoiceNumber: "INV-000123",
      serviceName: "Deep Clean",
      amountCents: 120000,
      invoiceUrl: "https://books.zoho.com/app/999#/invoices/inv-1",
    });
    expect(email.subject).toContain("INV-000123");
    expect(email.html).toContain("INV-000123");
    expect(email.html).toContain("Sipho Dlamini");
    expect(email.html).toContain("Deep Clean");
    expect(email.html).toContain(formatZar(120000));
    expect(email.html).toContain("https://books.zoho.com/app/999#/invoices/inv-1");
    // Invoice number appears in the prominent callout and the intro mentions the attachment.
    expect(email.html).toContain("Invoice number");
    expect(email.html).toContain("attached");
    expect(email.text).toContain("Invoice number: INV-000123");
  });

  it("admin invoice email mirrors the same invoice fields", () => {
    const email = AdminInvoiceCreatedEmail({
      customerName: "Sipho Dlamini",
      invoiceNumber: "INV-000123",
      serviceName: "Deep Clean",
      amountCents: 120000,
      invoiceUrl: "https://books.zoho.com/app/999#/invoices/inv-1",
    });
    expect(email.html).toContain("INV-000123");
    expect(email.html).toContain("https://books.zoho.com/app/999#/invoices/inv-1");
  });
});

describe("payment link email", () => {
  it("renders the booking details, amount and a Pay now link", () => {
    const email = PaymentLinkEmail({
      customerName: "Naledi",
      bookingReference: "SHL-PAYLINK1",
      serviceName: "Regular Cleaning",
      bookingDate: "2026-06-10",
      bookingTime: "08:00-12:00",
      suburb: "Sea Point",
      address: "5 Beach Road",
      amountCents: 65000,
      paymentUrl: "https://checkout.paystack.com/abc123",
      invoiceNumber: "INV-000777",
    });
    expect(email.subject).toContain("SHL-PAYLINK1");
    expect(email.html).toContain("SHL-PAYLINK1");
    expect(email.html).toContain("Regular Cleaning");
    expect(email.html).toContain("2026-06-10");
    expect(email.html).toContain("Sea Point");
    expect(email.html).toContain(formatZar(65000));
    expect(email.html).toContain("https://checkout.paystack.com/abc123");
    expect(email.html).toContain("Pay now");
    // Branding + support details are present.
    expect(email.html).toContain(shaleanBrand.name);
    expect(email.html).toContain("087 153 5250");
    // Plain-text part includes the raw link for clients that strip the button.
    expect(email.text).toContain("https://checkout.paystack.com/abc123");
  });

  it("renders the payment link via the registry by type", () => {
    expect(isNotificationType("payment_link")).toBe(true);
    const email = renderNotification("payment_link", {
      customerName: "Naledi",
      bookingReference: "SHL-REG00001",
      serviceName: "Regular Cleaning",
      bookingDate: "2026-06-10",
      bookingTime: "08:00-12:00",
      amountCents: 65000,
      paymentUrl: "https://checkout.paystack.com/xyz",
    });
    expect(email.html).toContain("SHL-REG00001");
    expect(email.html).toContain("https://checkout.paystack.com/xyz");
  });
});

describe("template registry", () => {
  it("recognizes valid notification types", () => {
    expect(isNotificationType("booking_confirmation")).toBe(true);
    expect(isNotificationType("admin_payment_received")).toBe(true);
    expect(isNotificationType("not_a_type")).toBe(false);
    expect(isNotificationType(42)).toBe(false);
  });

  it("renders via the registry by type + data", () => {
    const email = renderNotification("booking_rescheduled", {
      customerName: "Lerato",
      bookingReference: "SHL-DEAD0001",
      serviceName: "Regular Cleaning",
      newDate: "2026-07-01",
      newTime: "11:00",
      previousDate: "2026-06-20",
      previousTime: "08:00",
    });
    expect(email.subject).toContain("SHL-DEAD0001");
    expect(email.html).toContain("2026-07-01");
  });

  it("escapes HTML in user-supplied values", () => {
    const email = BookingRescheduledEmail({
      customerName: "<script>alert(1)</script>",
      bookingReference: "SHL-XSS00001",
      serviceName: "Regular Cleaning",
      newDate: "2026-07-01",
      newTime: "11:00",
    });
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("renders admin customer registration + payment received", () => {
    const reg = AdminCustomerRegisteredEmail({
      customerName: "New Person",
      customerEmail: "new@person.co.za",
    });
    expect(reg.html).toContain("New Person");
    const pay = AdminPaymentReceivedEmail({
      customerName: "New Person",
      bookingReference: "SHL-PAY00001",
      serviceName: "Regular Cleaning",
      amountCents: 30000,
    });
    expect(pay.html).toContain("SHL-PAY00001");
  });
});
