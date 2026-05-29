import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncBookingToZohoBooks } from "./books";

type BookingState = {
  booking: Record<string, unknown> | null;
  customer: Record<string, unknown> | null;
  addons: Array<Record<string, unknown>>;
  equipment: Array<Record<string, unknown>>;
};

function makeSupabaseStub(state: BookingState) {
  const updates: Array<Record<string, unknown>> = [];

  function from(table: string) {
    let op: "select" | "update" = "select";
    let payload: Record<string, unknown> | null = null;

    function resolve() {
      if (op === "update") {
        updates.push(payload ?? {});
        if (table === "bookings" && state.booking) {
          Object.assign(state.booking, payload ?? {});
        }
        return { data: null, error: null };
      }
      switch (table) {
        case "bookings":
          return { data: state.booking, error: null };
        case "customers":
          return { data: state.customer, error: null };
        case "booking_addons":
          return { data: state.addons, error: null };
        case "booking_equipment":
          return { data: state.equipment, error: null };
        default:
          return { data: null, error: null };
      }
    }

    const builder: Record<string, unknown> = {
      select: () => builder,
      update: (value: Record<string, unknown>) => {
        op = "update";
        payload = value;
        return builder;
      },
      eq: () => builder,
      maybeSingle: () => Promise.resolve(resolve()),
      single: () => Promise.resolve(resolve()),
      then: (onF: (value: unknown) => unknown, onR?: (reason: unknown) => unknown) =>
        Promise.resolve(resolve()).then(onF, onR),
    };
    return builder;
  }

  return { client: { from } as never, updates };
}

function jsonResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload } as Response;
}

function paidBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "1111aaaa-2222-3333-4444-555566667777",
    customer_id: "cust-1",
    service_slug: "regular-cleaning",
    booking_date: "2026-06-01",
    booking_time: "08:00-12:00",
    address: "12 Main Road",
    suburb: "Sea Point",
    base_price_cents: 30000,
    extra_cleaners_total_cents: 0,
    final_total_cents: 50000,
    payment_status: "paid",
    booking_status: "confirmed",
    zoho_sync_status: "pending",
    zoho_sync_attempts: 0,
    zoho_contact_id: null,
    zoho_invoice_id: null,
    ...overrides,
  };
}

describe("syncBookingToZohoBooks", () => {
  beforeEach(() => {
    vi.stubEnv("ZOHO_CLIENT_ID", "client-id");
    vi.stubEnv("ZOHO_CLIENT_SECRET", "client-secret");
    vi.stubEnv("ZOHO_REFRESH_TOKEN", "refresh-token");
    vi.stubEnv("ZOHO_ORGANIZATION_ID", "org-123");
    vi.stubEnv("ZOHO_DC", "com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates a contact + invoice and persists synced status", async () => {
    const state: BookingState = {
      booking: paidBooking(),
      customer: { id: "cust-1", full_name: "Thandi Mokoena", email: "thandi@example.com", phone: "+27821234567" },
      addons: [{ label: "Inside Oven", price_cents: 15000 }],
      equipment: [{ label: "With Equipment", price_cents: 5000 }],
    };
    const { client, updates } = makeSupabaseStub(state);

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/oauth/v2/token")) return jsonResponse({ access_token: "tok", expires_in: 3600 });
      if (url.includes("/contacts") && !url.includes("/invoices")) {
        // GET lookup returns empty, POST create returns id. Distinguish by query param.
        if (url.includes("email=")) return jsonResponse({ code: 0, contacts: [] });
        return jsonResponse({ code: 0, contact: { contact_id: "contact-1" } });
      }
      if (url.includes("/status/sent")) return jsonResponse({ code: 0 });
      if (url.includes("/invoices")) return jsonResponse({ code: 0, invoice: { invoice_id: "inv-1", invoice_number: "INV-001" } });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncBookingToZohoBooks("1111aaaa-2222-3333-4444-555566667777", { supabase: client });

    expect(result.status).toBe("synced");
    expect(result.zohoContactId).toBe("contact-1");
    expect(result.zohoInvoiceId).toBe("inv-1");
    expect(result.zohoInvoiceUrl).toContain("books.zoho.com/app/org-123#/invoices/inv-1");

    const persisted = updates.at(-1) as Record<string, unknown>;
    expect(persisted.zoho_sync_status).toBe("synced");
    expect(persisted.zoho_invoice_id).toBe("inv-1");
    expect(persisted.zoho_invoice_number).toBe("INV-001");
    expect(persisted.zoho_sync_error).toBeNull();
    expect(persisted.zoho_sync_attempts).toBe(1);
  });

  it("records a failed status (and never throws) when Zoho returns an error", async () => {
    const state: BookingState = {
      booking: paidBooking(),
      customer: { id: "cust-1", full_name: "Thandi", email: "thandi@example.com", phone: "+27821234567" },
      addons: [],
      equipment: [],
    };
    const { client, updates } = makeSupabaseStub(state);

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/oauth/v2/token")) return jsonResponse({ access_token: "tok", expires_in: 3600 });
      return { ok: false, status: 500, json: async () => ({ code: 1, message: "Zoho down" }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncBookingToZohoBooks("1111aaaa-2222-3333-4444-555566667777", { supabase: client });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("Zoho down");
    const persisted = updates.at(-1) as Record<string, unknown>;
    expect(persisted.zoho_sync_status).toBe("failed");
    expect(persisted.zoho_sync_attempts).toBe(1);
  });

  it("skips syncing when the booking is not paid", async () => {
    const state: BookingState = {
      booking: paidBooking({ payment_status: "pending" }),
      customer: null,
      addons: [],
      equipment: [],
    };
    const { client, updates } = makeSupabaseStub(state);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncBookingToZohoBooks("1111aaaa-2222-3333-4444-555566667777", { supabase: client });

    expect(result.status).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
    expect((updates.at(-1) as Record<string, unknown>).zoho_sync_status).toBe("skipped");
  });

  it("skips syncing when Zoho is not configured", async () => {
    vi.stubEnv("ZOHO_CLIENT_ID", "");
    const state: BookingState = {
      booking: paidBooking(),
      customer: null,
      addons: [],
      equipment: [],
    };
    const { client, updates } = makeSupabaseStub(state);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncBookingToZohoBooks("1111aaaa-2222-3333-4444-555566667777", { supabase: client });

    expect(result.status).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
    expect((updates.at(-1) as Record<string, unknown>).zoho_sync_status).toBe("skipped");
  });

  it("is idempotent for an already-synced booking (no duplicate invoice)", async () => {
    const state: BookingState = {
      booking: paidBooking({ zoho_sync_status: "synced", zoho_invoice_id: "inv-existing", zoho_contact_id: "contact-x" }),
      customer: null,
      addons: [],
      equipment: [],
    };
    const { client, updates } = makeSupabaseStub(state);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncBookingToZohoBooks("1111aaaa-2222-3333-4444-555566667777", { supabase: client });

    expect(result.status).toBe("synced");
    expect(result.zohoInvoiceId).toBe("inv-existing");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});
