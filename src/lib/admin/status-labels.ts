export type StatusBadgeKind = "booking" | "payment" | "invoice" | "zoho";

const BOOKING_STATUS: Record<string, { label: string; tooltip: string }> = {
  draft: {
    label: "Draft",
    tooltip: "Booking saved but not yet submitted for payment or scheduling.",
  },
  payment_pending: {
    label: "Payment Pending",
    tooltip: "Awaiting customer or admin payment before the job is confirmed.",
  },
  confirmed: {
    label: "Confirmed",
    tooltip: "Paid and confirmed; cleaner dispatch can proceed.",
  },
  assigned: {
    label: "Assigned",
    tooltip: "Required cleaner slots are filled or offers are outstanding.",
  },
  in_progress: {
    label: "In Progress",
    tooltip: "A cleaner has started the job.",
  },
  completed: {
    label: "Completed",
    tooltip: "The service visit is finished.",
  },
  cancelled: {
    label: "Cancelled",
    tooltip: "This booking was cancelled and should not be serviced.",
  },
};

const PAYMENT_STATUS: Record<string, { label: string; tooltip: string }> = {
  pending: {
    label: "Pending",
    tooltip: "No successful payment recorded yet.",
  },
  initialized: {
    label: "Initialized",
    tooltip: "A Paystack checkout session was started but not completed.",
  },
  paid: {
    label: "Paid",
    tooltip: "Payment settled in full for this booking.",
  },
  failed: {
    label: "Failed",
    tooltip: "The last payment attempt failed or was abandoned.",
  },
  refunded: {
    label: "Refunded",
    tooltip: "Payment was refunded to the customer.",
  },
  partially_paid: {
    label: "Partially Paid",
    tooltip: "Some payment was recorded but a balance remains (legacy path).",
  },
};

const INVOICE_STATUS: Record<string, { label: string; tooltip: string }> = {
  pending: {
    label: "Pending",
    tooltip: "No Zoho invoice has been created for this booking yet.",
  },
  created: {
    label: "Created",
    tooltip: "An unpaid invoice exists in Zoho Books.",
  },
  paid: {
    label: "Paid",
    tooltip: "The Zoho invoice is marked paid.",
  },
  voided: {
    label: "Voided",
    tooltip: "The invoice was voided and should not be collected.",
  },
};

const ZOHO_STATUS: Record<string, { label: string; tooltip: string }> = {
  pending: {
    label: "Pending",
    tooltip: "Zoho sync has not completed yet.",
  },
  synced: {
    label: "Synced",
    tooltip: "Contact and invoice data are synced with Zoho Books.",
  },
  failed: {
    label: "Failed",
    tooltip: "The last Zoho sync attempt failed; use Retry Zoho sync.",
  },
  skipped: {
    label: "Skipped",
    tooltip: "Zoho sync was skipped (e.g. not configured or booking not billable).",
  },
};

const STATUS_MAP: Record<StatusBadgeKind, Record<string, { label: string; tooltip: string }>> = {
  booking: BOOKING_STATUS,
  payment: PAYMENT_STATUS,
  invoice: INVOICE_STATUS,
  zoho: ZOHO_STATUS,
};

export function describeAdminStatus(kind: StatusBadgeKind, rawValue: string | null | undefined) {
  const value = (rawValue ?? "pending").trim().toLowerCase() || "pending";
  const known = STATUS_MAP[kind][value];
  if (known) {
    return known;
  }

  const label = value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    label,
    tooltip: `${label} status.`,
  };
}
