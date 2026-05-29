import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensurePaystackPaymentLink,
  recordManualBookingPayment,
} from "./billing";

const dispatchCleanersForPaidBooking = vi.fn(async () => undefined);

vi.mock("@/lib/regular-cleaning/dispatch", () => ({
  dispatchCleanersForPaidBooking: (...args: unknown[]) => dispatchCleanersForPaidBooking(...args),
}));

vi.mock("@/lib/admin/audit", () => ({
  ADMIN_BOOKING_ASSIST_ACTIONS: {
    paymentRecorded: "payment_recorded",
    cleanerDispatched: "cleaner_dispatched",
  },
  logAdminBookingAssistAudit: vi.fn(async () => undefined),
}));

// A small in-memory Supabase stub covering just the query shapes used by the
// admin billing orchestration. Records inserts/updates per table for assertions.
type Store = {
  booking: Record<string, unknown>;
  customer: Record<string, unknown> | null;
  payments: Array<Record<string, unknown>>;
  paymentRecords: Array<Record<string, unknown>>;
  existingPayment: Record<string, unknown> | null;
  recordKeys: Set<string>;
};

function makeSupabaseStub(store: Store) {
  function from(table: string) {
    let op: "select" | "insert" | "update" = "select";
    let payload: Record<string, unknown> | null = null;

    function resolve(): { data: unknown; error: unknown } {
      if (op === "insert") {
        if (table === "payments") {
          store.payments.push(payload ?? {});
          return { data: null, error: null };
        }
        if (table === "admin_booking_payment_records") {
          const key = String((payload ?? {}).idempotency_key ?? "");
          if (store.recordKeys.has(key)) {
            return { data: null, error: { code: "23505", message: "duplicate key" } };
          }
          store.recordKeys.add(key);
          store.paymentRecords.push(payload ?? {});
          return { data: null, error: null };
        }
        return { data: null, error: null };
      }
      if (op === "update") {
        if (table === "bookings") {
          Object.assign(store.booking, payload ?? {});
        }
        return { data: null, error: null };
      }
      // select
      switch (table) {
        case "bookings":
          return { data: store.booking, error: null };
        case "customers":
          return { data: store.customer, error: null };
        case "payments":
          return { data: store.existingPayment, error: null };
        case "booking_addons":
        case "booking_equipment":
          return { data: [], error: null };
        default:
          return { data: null, error: null };
      }
    }

    const builder: Record<string, unknown> = {
      select: () => builder,
      insert: (value: Record<string, unknown>) => {
        op = "insert";
        payload = value;
        return builder;
      },
      update: (value: Record<string, unknown>) => {
        op = "update";
        payload = value;
        return builder;
      },
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve(resolve()),
      single: () => Promise.resolve(resolve()),
      then: (onF: (value: unknown) => unknown, onR?: (reason: unknown) => unknown) =>
        Promise.resolve(resolve()).then(onF, onR),
    };
    return builder;
  }

  return { client: { from } as never };
}

function jsonResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload } as Response;
}

function baseBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "1111aaaa-2222-3333-4444-555566667777",
    customer_id: "cust-1",
    checkout_session_id: "chk-1",
    idempotency_key: "idem-1",
    service_slug: "regular-cleaning",
    booking_date: "2026-06-01",
    booking_time: "08:00-12:00",
    address: "12 Main Road",
    suburb: "Sea Point",
    base_price_cents: 30000,
    extra_cleaners_total_cents: 0,
    final_total_cents: 50000,
    series_total_cents: null,
    amount_due_cents: null,
    amount_paid_cents: 0,
    payment_status: "pending",
    booking_status: "payment_pending",
    invoice_status: "pending",
    booking_reference: "SHL-1111AAAA",
    zoho_sync_status: "pending",
    zoho_sync_attempts: 0,
    zoho_contact_id: null,
    zoho_invoice_id: null,
    paystack_reference: null,
    paystack_authorization_url: null,
    paid_at: null,
    payment_method: null,
    payment_reference: null,
    ...overrides,
  };
}

describe("ensurePaystackPaymentLink", () => {
  beforeEach(() => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_x");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.shalean.test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("initializes a Paystack transaction and persists the link on the booking", async () => {
    const store: Store = {
      booking: baseBooking(),
      customer: { id: "cust-1", full_name: "Thandi", email: "thandi@shalean.test", phone: "+27821234567" },
      payments: [],
      paymentRecords: [],
      existingPayment: null,
      recordKeys: new Set(),
    };
    const { client } = makeSupabaseStub(store);

    const fetchMock = vi.fn(async () =>
      jsonResponse({
        status: true,
        data: { authorization_url: "https://checkout.paystack.com/pay-1", access_code: "ac_1", reference: "ref-1" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensurePaystackPaymentLink(client, "1111aaaa-2222-3333-4444-555566667777");

    expect(result.ok).toBe(true);
    if (result.ok && !("alreadyPaid" in result)) {
      expect(result.authorizationUrl).toBe("https://checkout.paystack.com/pay-1");
      expect(result.reference).toBe("ref-1");
    }
    // A pending payments row was written for reconciliation to settle later.
    expect(store.payments).toHaveLength(1);
    expect(store.payments[0]).toMatchObject({
      booking_id: "1111aaaa-2222-3333-4444-555566667777",
      provider: "paystack",
      provider_reference: "ref-1",
      amount_cents: 50000,
      status: "pending",
    });
    // The link is denormalized onto the booking.
    expect(store.booking.paystack_reference).toBe("ref-1");
    expect(store.booking.paystack_authorization_url).toBe("https://checkout.paystack.com/pay-1");
  });

  it("reuses an existing link without re-initializing Paystack", async () => {
    const store: Store = {
      booking: baseBooking({ paystack_reference: "ref-existing", paystack_authorization_url: "https://checkout.paystack.com/existing" }),
      customer: { id: "cust-1", full_name: "Thandi", email: "thandi@shalean.test", phone: "+27821234567" },
      payments: [],
      paymentRecords: [],
      existingPayment: null,
      recordKeys: new Set(),
    };
    const { client } = makeSupabaseStub(store);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensurePaystackPaymentLink(client, "1111aaaa-2222-3333-4444-555566667777");
    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns alreadyPaid for a paid booking", async () => {
    const store: Store = {
      booking: baseBooking({ payment_status: "paid" }),
      customer: { id: "cust-1", full_name: "Thandi", email: "thandi@shalean.test", phone: "+27821234567" },
      payments: [],
      paymentRecords: [],
      existingPayment: null,
      recordKeys: new Set(),
    };
    const { client } = makeSupabaseStub(store);
    const result = await ensurePaystackPaymentLink(client, "1111aaaa-2222-3333-4444-555566667777");
    expect(result).toEqual({ ok: true, alreadyPaid: true });
  });
});

describe("recordManualBookingPayment", () => {
  beforeEach(() => {
    dispatchCleanersForPaidBooking.mockClear();
    vi.stubEnv("ZOHO_CLIENT_ID", "client-id");
    vi.stubEnv("ZOHO_CLIENT_SECRET", "client-secret");
    vi.stubEnv("ZOHO_REFRESH_TOKEN", "refresh-token");
    vi.stubEnv("ZOHO_ORGANIZATION_ID", "org-123");
    vi.stubEnv("ZOHO_DC", "com");
    // Pin the deposit account so payment recording doesn't hit /chartofaccounts.
    vi.stubEnv("ZOHO_PAYMENT_ACCOUNT_ID", "deposit-1");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("settles a booking and records the payment against the existing Zoho invoice", async () => {
    const store: Store = {
      booking: baseBooking({
        zoho_sync_status: "synced",
        zoho_invoice_id: "inv-1",
        zoho_invoice_number: "INV-1",
        zoho_contact_id: "contact-1",
        invoice_status: "created",
        amount_due_cents: 50000,
      }),
      customer: { id: "cust-1", full_name: "Thandi", email: "thandi@shalean.test", phone: "+27821234567" },
      payments: [],
      paymentRecords: [],
      existingPayment: null,
      recordKeys: new Set(),
    };
    const { client } = makeSupabaseStub(store);

    const customerPaymentBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/oauth/v2/token")) return jsonResponse({ access_token: "tok", expires_in: 3600 });
      if (url.includes("/customerpayments")) {
        customerPaymentBodies.push(JSON.parse(String(init?.body ?? "{}")));
        return jsonResponse({ code: 0, payment: { payment_id: "pay-1" } });
      }
      if (url.includes("/status/sent")) return jsonResponse({ code: 0 });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await recordManualBookingPayment(client, {
      bookingId: "1111aaaa-2222-3333-4444-555566667777",
      adminProfileId: "admin-1",
      adminName: "Admin User",
      amountCents: 50000,
      method: "eft",
      paymentDate: "2026-06-02",
      reference: "EFT-REF-123",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fullyPaid).toBe(true);
      expect(result.zohoRecorded).toBe(true);
    }
    // Booking is now fully paid via EFT.
    expect(store.booking.payment_status).toBe("paid");
    expect(store.booking.booking_status).toBe("confirmed");
    expect(store.booking.payment_method).toBe("eft");
    expect(store.booking.amount_paid_cents).toBe(50000);
    expect(store.booking.balance_remaining_cents).toBe(0);
    expect(store.booking.invoice_status).toBe("paid");
    expect(dispatchCleanersForPaidBooking).toHaveBeenCalledTimes(1);
    // An audit/payment record was written, and the Zoho payment used EFT.
    expect(store.paymentRecords).toHaveLength(1);
    expect(customerPaymentBodies).toHaveLength(1);
    expect(customerPaymentBodies[0]).toMatchObject({ payment_mode: "banktransfer", amount: 500 });
  });

  it("is idempotent: a duplicate recording does not double-update the booking", async () => {
    const store: Store = {
      booking: baseBooking({ invoice_status: "created", zoho_invoice_id: "inv-1", zoho_contact_id: "contact-1" }),
      customer: { id: "cust-1", full_name: "Thandi", email: "thandi@shalean.test", phone: "+27821234567" },
      payments: [],
      paymentRecords: [],
      existingPayment: null,
      recordKeys: new Set(["manual:1111aaaa-2222-3333-4444-555566667777:2026-06-02:50000:eft:eft-ref-123"]),
    };
    const { client } = makeSupabaseStub(store);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await recordManualBookingPayment(client, {
      bookingId: "1111aaaa-2222-3333-4444-555566667777",
      adminProfileId: "admin-1",
      adminName: "Admin User",
      amountCents: 50000,
      method: "eft",
      paymentDate: "2026-06-02",
      reference: "EFT-REF-123",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.duplicate).toBe(true);
    }
    // No booking mutation and no Zoho calls happened on the duplicate.
    expect(store.booking.payment_status).toBe("pending");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dispatchCleanersForPaidBooking).not.toHaveBeenCalled();
  });

  it("rejects a non-positive amount", async () => {
    const store: Store = {
      booking: baseBooking(),
      customer: { id: "cust-1", full_name: "Thandi", email: "thandi@shalean.test", phone: "+27821234567" },
      payments: [],
      paymentRecords: [],
      existingPayment: null,
      recordKeys: new Set(),
    };
    const { client } = makeSupabaseStub(store);
    const result = await recordManualBookingPayment(client, {
      bookingId: "1111aaaa-2222-3333-4444-555566667777",
      adminProfileId: "admin-1",
      adminName: "Admin User",
      amountCents: 0,
      method: "cash",
      paymentDate: "2026-06-02",
    });
    expect(result.ok).toBe(false);
  });
});
