// Server-side Zoho Books integration.
//
// SECURITY: This module reads server-only Zoho credentials (ZOHO_CLIENT_ID,
// ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORGANIZATION_ID, ZOHO_DC). None
// of these are NEXT_PUBLIC_*, so they are never bundled into the browser. Do not
// import this module from a Client Component.
//
// SAFETY: syncBookingToZohoBooks never throws — it records the outcome on the
// booking row (zoho_sync_status / zoho_sync_error) so a Zoho outage can never
// break the booking or payment flow. Failed syncs are retryable from the admin.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { slugToTitle } from "@/lib/utils";
import {
  getZohoConfig,
  type ZohoConfig,
  zohoAccountsBaseUrl,
  zohoApiBaseUrl,
  zohoInvoiceAppUrl,
} from "./config";
import {
  buildZohoContactPayload,
  buildZohoInvoicePayload,
  type ZohoBookingLineItem,
  type ZohoBookingSnapshot,
} from "./mapping";

type Supabase = SupabaseClient<Database>;

export type ZohoSyncStatus = "synced" | "failed" | "skipped";

export type ZohoSyncResult = {
  bookingId: string;
  status: ZohoSyncStatus;
  zohoContactId?: string | null;
  zohoInvoiceId?: string | null;
  zohoInvoiceNumber?: string | null;
  zohoInvoiceUrl?: string | null;
  error?: string | null;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

/**
 * Exchange the long-lived refresh token for a short-lived access token.
 * Tokens are cached in-memory until ~60s before expiry to avoid hammering the
 * Zoho OAuth endpoint on every sync.
 */
export async function getZohoAccessToken(config?: ZohoConfig): Promise<string> {
  const resolved = config ?? getZohoConfig();
  if (!resolved) {
    throw new Error("Zoho Books is not configured.");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const url = new URL(`${zohoAccountsBaseUrl(resolved.dc)}/oauth/v2/token`);
  url.searchParams.set("refresh_token", resolved.refreshToken);
  url.searchParams.set("client_id", resolved.clientId);
  url.searchParams.set("client_secret", resolved.clientSecret);
  url.searchParams.set("grant_type", "refresh_token");

  const response = await fetch(url, { method: "POST" });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      `Zoho token refresh failed (${response.status}): ${payload.error ?? "no access_token returned"}`,
    );
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };

  return cachedToken.accessToken;
}

async function zohoApiRequest<T>(
  config: ZohoConfig,
  token: string,
  path: string,
  init: RequestInit & { searchParams?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(`${zohoApiBaseUrl(config.dc)}${path}`);
  url.searchParams.set("organization_id", config.organizationId);
  for (const [key, value] of Object.entries(init.searchParams ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    code?: number;
    message?: string;
  };

  if (!response.ok || (typeof payload.code === "number" && payload.code !== 0)) {
    throw new Error(
      `Zoho API ${path} failed (${response.status}/${payload.code ?? "?"}): ${payload.message ?? "unknown error"}`,
    );
  }

  return payload;
}

/**
 * Find an existing Zoho contact by email, otherwise create one. Returns the
 * Zoho contact id.
 */
export async function createOrFindZohoCustomer(
  snapshot: ZohoBookingSnapshot,
  config?: ZohoConfig,
  token?: string,
): Promise<string> {
  const resolved = config ?? getZohoConfig();
  if (!resolved) {
    throw new Error("Zoho Books is not configured.");
  }
  const accessToken = token ?? (await getZohoAccessToken(resolved));

  if (snapshot.customerEmail) {
    const lookup = await zohoApiRequest<{ contacts?: Array<{ contact_id: string }> }>(
      resolved,
      accessToken,
      "/contacts",
      { method: "GET", searchParams: { email: snapshot.customerEmail } },
    );
    const existing = lookup.contacts?.[0]?.contact_id;
    if (existing) {
      return existing;
    }
  }

  const created = await zohoApiRequest<{ contact?: { contact_id: string } }>(
    resolved,
    accessToken,
    "/contacts",
    { method: "POST", body: JSON.stringify(buildZohoContactPayload(snapshot)) },
  );

  const contactId = created.contact?.contact_id;
  if (!contactId) {
    throw new Error("Zoho contact creation did not return a contact_id.");
  }
  return contactId;
}

/**
 * Create a Zoho invoice for the booking. Returns the invoice id + number.
 */
export async function createZohoInvoice(
  snapshot: ZohoBookingSnapshot,
  contactId: string,
  config?: ZohoConfig,
  token?: string,
): Promise<{ invoiceId: string; invoiceNumber: string | null }> {
  const resolved = config ?? getZohoConfig();
  if (!resolved) {
    throw new Error("Zoho Books is not configured.");
  }
  const accessToken = token ?? (await getZohoAccessToken(resolved));

  const payload = buildZohoInvoicePayload(snapshot, contactId, {
    invoiceDate: new Date().toISOString().slice(0, 10),
  });

  const created = await zohoApiRequest<{
    invoice?: { invoice_id: string; invoice_number?: string };
  }>(resolved, accessToken, "/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const invoiceId = created.invoice?.invoice_id;
  if (!invoiceId) {
    throw new Error("Zoho invoice creation did not return an invoice_id.");
  }

  return { invoiceId, invoiceNumber: created.invoice?.invoice_number ?? null };
}

/**
 * Mark a Zoho invoice as "sent". Best-effort: returns false instead of throwing
 * when the operation is unsupported/unavailable so it never blocks a sync.
 */
export async function markZohoInvoiceAsSent(
  invoiceId: string,
  config?: ZohoConfig,
  token?: string,
): Promise<boolean> {
  const resolved = config ?? getZohoConfig();
  if (!resolved) {
    return false;
  }

  try {
    const accessToken = token ?? (await getZohoAccessToken(resolved));
    await zohoApiRequest(resolved, accessToken, `/invoices/${invoiceId}/status/sent`, {
      method: "POST",
    });
    return true;
  } catch {
    return false;
  }
}

function bookingReferenceFor(bookingId: string): string {
  return `SHL-${bookingId.slice(0, 8).toUpperCase()}`;
}

/**
 * Load the booking + related rows from Supabase (the source of truth) and map
 * them into the normalized snapshot used to build Zoho payloads.
 */
export async function loadZohoBookingSnapshot(
  supabase: Supabase,
  bookingId: string,
): Promise<ZohoBookingSnapshot> {
  const bookingResult = await supabase.from("bookings").select("*").eq("id", bookingId).single();
  if (bookingResult.error) throw bookingResult.error;
  const booking = bookingResult.data;

  const [customerResult, addonsResult, equipmentResult] = await Promise.all([
    booking.customer_id
      ? supabase.from("customers").select("*").eq("id", booking.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("booking_addons").select("*").eq("booking_id", bookingId),
    supabase.from("booking_equipment").select("*").eq("booking_id", bookingId),
  ]);

  if (addonsResult.error) throw addonsResult.error;
  if (equipmentResult.error) throw equipmentResult.error;

  const customer = customerResult.data;
  const addOns: ZohoBookingLineItem[] = (addonsResult.data ?? []).map((addon) => ({
    label: addon.label,
    priceCents: addon.price_cents,
  }));
  const equipmentRow = (equipmentResult.data ?? []).find((row) => row.price_cents > 0) ?? null;

  return {
    bookingId: booking.id,
    bookingReference: bookingReferenceFor(booking.id),
    customerName: customer?.full_name ?? "Shalean Customer",
    customerEmail: customer?.email ?? "",
    customerPhone: customer?.phone ?? "",
    serviceName: slugToTitle(booking.service_slug),
    bookingDate: booking.booking_date,
    bookingTime: booking.booking_time,
    address: booking.address,
    suburb: booking.suburb,
    basePriceCents: booking.base_price_cents,
    addOns,
    equipment: equipmentRow ? { label: equipmentRow.label, priceCents: equipmentRow.price_cents } : null,
    extraCleanersTotalCents: booking.extra_cleaners_total_cents,
    finalTotalCents: booking.final_total_cents,
    paymentStatus: booking.payment_status,
    currencyCode: "ZAR",
  };
}

/**
 * Sync a single paid booking's customer + invoice to Zoho Books and persist the
 * resulting identifiers/status onto the booking. Never throws.
 */
export async function syncBookingToZohoBooks(
  bookingId: string,
  options?: { supabase?: Supabase; force?: boolean },
): Promise<ZohoSyncResult> {
  const supabase = options?.supabase ?? createSupabaseAdminClient();

  let bookingRow:
    | Database["public"]["Tables"]["bookings"]["Row"]
    | null = null;

  try {
    const bookingResult = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();
    if (bookingResult.error) throw bookingResult.error;
    bookingRow = bookingResult.data;
  } catch (error) {
    return {
      bookingId,
      status: "failed",
      error: error instanceof Error ? error.message : "Unable to load booking for Zoho sync.",
    };
  }

  if (!bookingRow) {
    return { bookingId, status: "failed", error: "Booking not found for Zoho sync." };
  }

  // Idempotency: never create a duplicate invoice for an already-synced booking.
  if (!options?.force && bookingRow.zoho_sync_status === "synced" && bookingRow.zoho_invoice_id) {
    return {
      bookingId,
      status: "synced",
      zohoContactId: bookingRow.zoho_contact_id,
      zohoInvoiceId: bookingRow.zoho_invoice_id,
      zohoInvoiceNumber: bookingRow.zoho_invoice_number,
      zohoInvoiceUrl: bookingRow.zoho_invoice_url,
    };
  }

  const config = getZohoConfig();
  if (!config) {
    await persistSyncOutcome(supabase, bookingId, {
      zoho_sync_status: "skipped",
      zoho_sync_error: "Zoho Books is not configured.",
    });
    return { bookingId, status: "skipped", error: "Zoho Books is not configured." };
  }

  if (bookingRow.payment_status !== "paid") {
    await persistSyncOutcome(supabase, bookingId, {
      zoho_sync_status: "skipped",
      zoho_sync_error: "Booking is not paid; Zoho sync skipped.",
    });
    return { bookingId, status: "skipped", error: "Booking is not paid; Zoho sync skipped." };
  }

  const attempts = (bookingRow.zoho_sync_attempts ?? 0) + 1;

  try {
    const token = await getZohoAccessToken(config);
    const snapshot = await loadZohoBookingSnapshot(supabase, bookingId);
    const contactId =
      bookingRow.zoho_contact_id ?? (await createOrFindZohoCustomer(snapshot, config, token));
    const invoice = await createZohoInvoice(snapshot, contactId, config, token);
    await markZohoInvoiceAsSent(invoice.invoiceId, config, token);

    const invoiceUrl = zohoInvoiceAppUrl({
      dc: config.dc,
      organizationId: config.organizationId,
      invoiceId: invoice.invoiceId,
    });

    await persistSyncOutcome(supabase, bookingId, {
      zoho_contact_id: contactId,
      zoho_invoice_id: invoice.invoiceId,
      zoho_invoice_number: invoice.invoiceNumber,
      zoho_invoice_url: invoiceUrl,
      zoho_sync_status: "synced",
      zoho_sync_error: null,
      zoho_sync_attempts: attempts,
      zoho_synced_at: new Date().toISOString(),
    });

    return {
      bookingId,
      status: "synced",
      zohoContactId: contactId,
      zohoInvoiceId: invoice.invoiceId,
      zohoInvoiceNumber: invoice.invoiceNumber,
      zohoInvoiceUrl: invoiceUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Zoho sync error.";
    console.error("ZOHO_SYNC_FAILED", { bookingId, message });
    await persistSyncOutcome(supabase, bookingId, {
      zoho_sync_status: "failed",
      zoho_sync_error: message,
      zoho_sync_attempts: attempts,
    });
    return { bookingId, status: "failed", error: message };
  }
}

/**
 * Best-effort sync for a batch of bookings. Used by the payment reconciliation
 * flow so a Zoho failure can never fail the webhook/callback.
 */
export async function syncBookingsToZohoBooksSafe(
  supabase: Supabase,
  bookingIds: string[],
): Promise<void> {
  for (const bookingId of bookingIds) {
    try {
      await syncBookingToZohoBooks(bookingId, { supabase });
    } catch (error) {
      console.error("ZOHO_SYNC_UNEXPECTED", {
        bookingId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function persistSyncOutcome(
  supabase: Supabase,
  bookingId: string,
  update: Database["public"]["Tables"]["bookings"]["Update"],
): Promise<void> {
  const result = await supabase.from("bookings").update(update).eq("id", bookingId);
  if (result.error) {
    console.error("ZOHO_SYNC_PERSIST_FAILED", { bookingId, message: result.error.message });
  }
}
