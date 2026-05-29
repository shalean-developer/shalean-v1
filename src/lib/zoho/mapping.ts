// Pure mapping between Shalean booking data (Supabase as source of truth) and
// Zoho Books API request payloads. No network, no env access -> unit testable.

export type ZohoBookingLineItem = {
  label: string;
  priceCents: number;
};

export type ZohoBookingSnapshot = {
  bookingId: string;
  bookingReference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  address: string;
  suburb: string;
  basePriceCents: number;
  addOns: ZohoBookingLineItem[];
  equipment: ZohoBookingLineItem | null;
  extraCleanersTotalCents: number;
  finalTotalCents: number;
  paymentStatus: string;
  currencyCode: string;
};

export type ZohoContactPayload = {
  contact_name: string;
  contact_type: "customer";
  contact_persons: Array<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    is_primary_contact: boolean;
  }>;
};

export type ZohoInvoiceLineItemPayload = {
  name: string;
  description: string;
  rate: number;
  quantity: number;
};

export type ZohoInvoicePayload = {
  customer_id: string;
  reference_number: string;
  date?: string;
  notes: string;
  line_items: ZohoInvoiceLineItemPayload[];
  adjustment?: number;
  adjustment_description?: string;
};

export type ZohoPaymentPayload = {
  customer_id: string;
  payment_mode: string;
  amount: number;
  date: string;
  reference_number: string;
  invoices: Array<{ invoice_id: string; amount_applied: number }>;
  account_id?: string;
};

export function centsToMajor(cents: number): number {
  return Math.round(cents) / 100;
}

function splitName(fullName: string): { first: string; last: string } {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) {
    return { first: "Customer", last: "" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], last: "" };
  }
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function buildZohoContactPayload(snapshot: ZohoBookingSnapshot): ZohoContactPayload {
  const { first, last } = splitName(snapshot.customerName);

  return {
    contact_name: snapshot.customerName.trim() || snapshot.customerEmail,
    contact_type: "customer",
    contact_persons: [
      {
        first_name: first,
        last_name: last,
        email: snapshot.customerEmail.trim(),
        phone: snapshot.customerPhone.trim(),
        is_primary_contact: true,
      },
    ],
  };
}

export function buildZohoInvoicePayload(
  snapshot: ZohoBookingSnapshot,
  contactId: string,
  options?: { invoiceDate?: string },
): ZohoInvoicePayload {
  const scheduleDescription = `Scheduled ${snapshot.bookingDate} ${snapshot.bookingTime} • ${snapshot.address}, ${snapshot.suburb}`;

  const lineItems: ZohoInvoiceLineItemPayload[] = [
    {
      name: snapshot.serviceName,
      description: scheduleDescription,
      rate: centsToMajor(snapshot.basePriceCents),
      quantity: 1,
    },
  ];

  for (const addOn of snapshot.addOns) {
    lineItems.push({
      name: `Add-on: ${addOn.label}`,
      description: "Booking add-on",
      rate: centsToMajor(addOn.priceCents),
      quantity: 1,
    });
  }

  if (snapshot.equipment && snapshot.equipment.priceCents > 0) {
    lineItems.push({
      name: `Equipment: ${snapshot.equipment.label}`,
      description: "Cleaning equipment",
      rate: centsToMajor(snapshot.equipment.priceCents),
      quantity: 1,
    });
  }

  if (snapshot.extraCleanersTotalCents > 0) {
    lineItems.push({
      name: "Additional cleaners",
      description: "Extra cleaner allocation",
      rate: centsToMajor(snapshot.extraCleanersTotalCents),
      quantity: 1,
    });
  }

  const lineTotalCents = lineItems.reduce(
    (total, item) => total + Math.round(item.rate * 100) * item.quantity,
    0,
  );
  const adjustmentCents = snapshot.finalTotalCents - lineTotalCents;

  const payload: ZohoInvoicePayload = {
    customer_id: contactId,
    reference_number: snapshot.bookingReference,
    notes: buildInvoiceNotes(snapshot),
    line_items: lineItems,
  };

  if (options?.invoiceDate) {
    payload.date = options.invoiceDate;
  }

  if (adjustmentCents !== 0) {
    payload.adjustment = centsToMajor(adjustmentCents);
    payload.adjustment_description =
      adjustmentCents < 0 ? "Booking discount" : "Booking adjustment";
  }

  return payload;
}

/**
 * Build the Zoho Books "customer payment" payload used to mark an invoice as
 * fully paid. The amount is applied in full to the single invoice, mirroring the
 * upfront Paystack payment that gates the booking.
 */
export function buildZohoPaymentPayload(args: {
  contactId: string;
  invoiceId: string;
  amountCents: number;
  reference: string;
  date: string;
  paymentMode: string;
  accountId?: string | null;
}): ZohoPaymentPayload {
  const amount = centsToMajor(args.amountCents);

  const payload: ZohoPaymentPayload = {
    customer_id: args.contactId,
    payment_mode: args.paymentMode,
    amount,
    date: args.date,
    reference_number: args.reference,
    invoices: [{ invoice_id: args.invoiceId, amount_applied: amount }],
  };

  if (args.accountId) {
    payload.account_id = args.accountId;
  }

  return payload;
}

function buildInvoiceNotes(snapshot: ZohoBookingSnapshot): string {
  const addOnSummary =
    snapshot.addOns.length > 0
      ? snapshot.addOns.map((addOn) => addOn.label).join(", ")
      : "None";

  return [
    `Booking reference: ${snapshot.bookingReference}`,
    `Service: ${snapshot.serviceName}`,
    `Date/time: ${snapshot.bookingDate} ${snapshot.bookingTime}`,
    `Address: ${snapshot.address}, ${snapshot.suburb}`,
    `Add-ons: ${addOnSummary}`,
    `Payment status: ${snapshot.paymentStatus}`,
  ].join("\n");
}
