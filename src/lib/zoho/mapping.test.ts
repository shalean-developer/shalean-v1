import { describe, expect, it } from "vitest";
import {
  buildZohoContactPayload,
  buildZohoInvoicePayload,
  buildZohoPaymentPayload,
  centsToMajor,
  type ZohoBookingSnapshot,
} from "./mapping";

function baseSnapshot(overrides: Partial<ZohoBookingSnapshot> = {}): ZohoBookingSnapshot {
  return {
    bookingId: "1111aaaa-2222-3333-4444-555566667777",
    bookingReference: "SHL-1111AAAA",
    customerName: "Thandi Mokoena",
    customerEmail: "thandi@example.com",
    customerPhone: "+27821234567",
    serviceName: "Regular Cleaning",
    bookingDate: "2026-06-01",
    bookingTime: "08:00-12:00",
    address: "12 Main Road",
    suburb: "Sea Point",
    basePriceCents: 30000,
    addOns: [{ label: "Inside Oven", priceCents: 15000 }],
    equipment: { label: "With Equipment", priceCents: 5000 },
    extraCleanersTotalCents: 0,
    finalTotalCents: 50000,
    paymentStatus: "paid",
    currencyCode: "ZAR",
    ...overrides,
  };
}

describe("centsToMajor", () => {
  it("converts cents to two-decimal major units", () => {
    expect(centsToMajor(50000)).toBe(500);
    expect(centsToMajor(12345)).toBe(123.45);
  });
});

describe("buildZohoContactPayload", () => {
  it("splits the customer name and sets the primary contact person", () => {
    const payload = buildZohoContactPayload(baseSnapshot());
    expect(payload.contact_name).toBe("Thandi Mokoena");
    expect(payload.contact_type).toBe("customer");
    expect(payload.contact_persons[0]).toMatchObject({
      first_name: "Thandi",
      last_name: "Mokoena",
      email: "thandi@example.com",
      phone: "+27821234567",
      is_primary_contact: true,
    });
  });

  it("falls back to email when the name is blank", () => {
    const payload = buildZohoContactPayload(baseSnapshot({ customerName: "  " }));
    expect(payload.contact_name).toBe("thandi@example.com");
    expect(payload.contact_persons[0].first_name).toBe("Customer");
  });
});

describe("buildZohoInvoicePayload", () => {
  it("itemizes base, add-ons and equipment with matching total", () => {
    const payload = buildZohoInvoicePayload(baseSnapshot(), "contact-1", {
      invoiceDate: "2026-06-02",
    });

    expect(payload.customer_id).toBe("contact-1");
    expect(payload.reference_number).toBe("SHL-1111AAAA");
    expect(payload.date).toBe("2026-06-02");
    expect(payload.line_items).toHaveLength(3);
    expect(payload.line_items[0]).toMatchObject({ name: "Regular Cleaning", rate: 300, quantity: 1 });
    expect(payload.line_items[1]).toMatchObject({ name: "Add-on: Inside Oven", rate: 150 });
    expect(payload.line_items[2]).toMatchObject({ name: "Equipment: With Equipment", rate: 50 });
    // 30000 + 15000 + 5000 === 50000 final total -> no adjustment needed.
    expect(payload.adjustment).toBeUndefined();
  });

  it("adds a negative adjustment when the booking total reflects a discount", () => {
    const payload = buildZohoInvoicePayload(
      baseSnapshot({ finalTotalCents: 45000 }),
      "contact-1",
    );
    // Lines sum to 50000, final is 45000 -> -5000 cents discount.
    expect(payload.adjustment).toBe(-50);
    expect(payload.adjustment_description).toBe("Booking discount");
  });

  it("includes an extra cleaners line item when present", () => {
    const payload = buildZohoInvoicePayload(
      baseSnapshot({ extraCleanersTotalCents: 8000, finalTotalCents: 58000 }),
      "contact-1",
    );
    const extra = payload.line_items.find((item) => item.name === "Additional cleaners");
    expect(extra).toMatchObject({ rate: 80, quantity: 1 });
    expect(payload.adjustment).toBeUndefined();
  });

  it("omits zero-priced equipment", () => {
    const payload = buildZohoInvoicePayload(
      baseSnapshot({ equipment: { label: "No Equipment", priceCents: 0 }, finalTotalCents: 45000 }),
      "contact-1",
    );
    expect(payload.line_items.some((item) => item.name.startsWith("Equipment"))).toBe(false);
  });
});

describe("buildZohoInvoicePayload with full breakdown", () => {
  it("itemizes bedrooms, bathrooms and every breakdown line", () => {
    const payload = buildZohoInvoicePayload(
      baseSnapshot({
        bedrooms: 2,
        bathrooms: 1,
        propertyType: "house",
        frequency: "once",
        finalTotalCents: 50000,
        invoiceTotalCents: 50000,
        breakdownLines: [
          { label: "Regular Cleaning", amountCents: 30000, category: "base" },
          { label: "2 bedroom allocation", amountCents: 12000, category: "rooms" },
          { label: "1 bathroom allocation", amountCents: 8000, category: "rooms" },
        ],
      }),
      "contact-1",
      { invoiceDate: "2026-06-02" },
    );

    expect(payload.line_items).toHaveLength(3);
    expect(payload.line_items[1]).toMatchObject({ name: "2 bedroom allocation", rate: 120 });
    expect(payload.line_items[2]).toMatchObject({ name: "1 bathroom allocation", rate: 80 });
    // Line sum equals the charged total -> no adjustment.
    expect(payload.adjustment).toBeUndefined();
    expect(payload.notes).toContain("Bedrooms: 2");
    expect(payload.notes).toContain("Bathrooms: 1");
    expect(payload.notes).toContain("Property type: house");
  });

  it("records the frequency discount as a negative adjustment for recurring bookings", () => {
    const payload = buildZohoInvoicePayload(
      baseSnapshot({
        frequency: "weekly",
        finalTotalCents: 50000,
        invoiceTotalCents: 45000,
        breakdownLines: [{ label: "Regular Cleaning", amountCents: 50000, category: "base" }],
      }),
      "contact-1",
    );

    // 45000 charged - 50000 line total => -5000 cents (-50.00) discount.
    expect(payload.adjustment).toBe(-50);
    expect(payload.adjustment_description).toBe("Frequency discount (Weekly)");
    expect(payload.notes).toContain("Frequency: Weekly");
    expect(payload.notes).toContain("Frequency discount: -50.00");
  });
});

describe("buildZohoPaymentPayload", () => {
  it("applies the full amount to the invoice to mark it paid", () => {
    const payload = buildZohoPaymentPayload({
      contactId: "contact-1",
      invoiceId: "inv-1",
      amountCents: 50000,
      reference: "SHL-1111AAAA",
      date: "2026-06-02",
      paymentMode: "banktransfer",
      accountId: "deposit-1",
    });

    expect(payload).toMatchObject({
      customer_id: "contact-1",
      payment_mode: "banktransfer",
      amount: 500,
      date: "2026-06-02",
      reference_number: "SHL-1111AAAA",
      account_id: "deposit-1",
    });
    expect(payload.invoices).toEqual([{ invoice_id: "inv-1", amount_applied: 500 }]);
  });

  it("omits account_id when none is provided", () => {
    const payload = buildZohoPaymentPayload({
      contactId: "contact-1",
      invoiceId: "inv-1",
      amountCents: 12345,
      reference: "SHL-2",
      date: "2026-06-02",
      paymentMode: "creditcard",
    });
    expect(payload.amount).toBe(123.45);
    expect("account_id" in payload).toBe(false);
  });
});
