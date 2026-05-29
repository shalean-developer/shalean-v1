// Pure mapping between Shalean booking data (Supabase as source of truth) and
// Zoho Books API request payloads. No network, no env access -> unit testable.

export type ZohoBookingLineItem = {
  label: string;
  priceCents: number;
};

export type ZohoBreakdownLine = {
  label: string;
  amountCents: number;
  category?: string;
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
  // Booking selections (so the invoice reflects everything the customer chose).
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  extraRooms?: number | null;
  frequency?: string | null;
  occurrenceCount?: number | null;
  // Itemized pricing breakdown (base, per-bedroom/bathroom, add-ons, equipment,
  // extra cleaners, minimum). When present it is used verbatim for line items.
  breakdownLines?: ZohoBreakdownLine[];
  // The amount actually charged for this invoice/occurrence (after any recurring
  // frequency discount). Defaults to finalTotalCents when not set.
  invoiceTotalCents?: number;
};

export function humanizeFrequency(frequency?: string | null): string {
  switch ((frequency ?? "").toLowerCase()) {
    case "once":
    case "":
      return "Once-off";
    case "weekly":
      return "Weekly";
    case "fortnightly":
      return "Bi-weekly";
    case "monthly":
      return "Monthly";
    default:
      return frequency as string;
  }
}

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

  // Prefer the full itemized breakdown (base, per-bedroom/bathroom/extra-room,
  // add-ons, equipment, extra cleaners, minimum) so every booking selection is
  // recorded. Fall back to the coarse base/add-ons/equipment shape otherwise.
  const lineItems: ZohoInvoiceLineItemPayload[] =
    snapshot.breakdownLines && snapshot.breakdownLines.length > 0
      ? snapshot.breakdownLines.map((line, index) => ({
          name: line.label,
          description: index === 0 ? scheduleDescription : categoryDescription(line.category),
          rate: centsToMajor(line.amountCents),
          quantity: 1,
        }))
      : buildFallbackLineItems(snapshot, scheduleDescription);

  const lineTotalCents = lineItems.reduce(
    (total, item) => total + Math.round(item.rate * 100) * item.quantity,
    0,
  );
  // Charge the discounted amount when a recurring frequency discount applies.
  const targetTotalCents = snapshot.invoiceTotalCents ?? snapshot.finalTotalCents;
  const adjustmentCents = targetTotalCents - lineTotalCents;

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
    payload.adjustment_description = resolveAdjustmentDescription(snapshot, adjustmentCents);
  }

  return payload;
}

function buildFallbackLineItems(
  snapshot: ZohoBookingSnapshot,
  scheduleDescription: string,
): ZohoInvoiceLineItemPayload[] {
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

  return lineItems;
}

function categoryDescription(category?: string): string {
  switch (category) {
    case "rooms":
      return "Room allocation";
    case "addon":
      return "Booking add-on";
    case "equipment":
      return "Cleaning equipment";
    case "cleaners":
      return "Extra cleaner allocation";
    case "minimum":
      return "Minimum booking adjustment";
    default:
      return "";
  }
}

function frequencyDiscountCents(snapshot: ZohoBookingSnapshot): number {
  const target = snapshot.invoiceTotalCents ?? snapshot.finalTotalCents;
  return Math.max(0, snapshot.finalTotalCents - target);
}

function resolveAdjustmentDescription(
  snapshot: ZohoBookingSnapshot,
  adjustmentCents: number,
): string {
  if (frequencyDiscountCents(snapshot) > 0) {
    return `Frequency discount (${humanizeFrequency(snapshot.frequency)})`;
  }
  return adjustmentCents < 0 ? "Booking discount" : "Booking adjustment";
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

  const lines: string[] = [
    `Booking reference: ${snapshot.bookingReference}`,
    `Service: ${snapshot.serviceName}`,
    `Date/time: ${snapshot.bookingDate} ${snapshot.bookingTime}`,
    `Address: ${snapshot.address}, ${snapshot.suburb}`,
  ];

  if (snapshot.propertyType) {
    lines.push(`Property type: ${snapshot.propertyType}`);
  }
  if (typeof snapshot.bedrooms === "number") {
    lines.push(`Bedrooms: ${snapshot.bedrooms}`);
  }
  if (typeof snapshot.bathrooms === "number") {
    lines.push(`Bathrooms: ${snapshot.bathrooms}`);
  }
  if (typeof snapshot.extraRooms === "number" && snapshot.extraRooms > 0) {
    lines.push(`Extra rooms: ${snapshot.extraRooms}`);
  }

  lines.push(`Add-ons: ${addOnSummary}`);

  if (snapshot.frequency) {
    lines.push(`Frequency: ${humanizeFrequency(snapshot.frequency)}`);
  }
  const discountCents = frequencyDiscountCents(snapshot);
  if (discountCents > 0) {
    lines.push(`Frequency discount: -${centsToMajor(discountCents).toFixed(2)}`);
  }

  lines.push(`Payment status: ${snapshot.paymentStatus}`);

  return lines.join("\n");
}
