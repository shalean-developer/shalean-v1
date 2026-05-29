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
import { notifyInvoiceCreated } from "@/lib/notifications/triggers";
import { slugToTitle } from "@/lib/utils";
import {
  getMissingZohoConfigKeys,
  getZohoConfig,
  type ZohoConfig,
  zohoAccountsBaseUrl,
  zohoApiBaseUrl,
  zohoInvoiceAppUrl,
} from "./config";
import {
  buildZohoContactPayload,
  buildZohoInvoicePayload,
  buildZohoPaymentPayload,
  centsToMajor,
  type ZohoBookingLineItem,
  type ZohoBookingSnapshot,
  type ZohoBreakdownLine,
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

// In-memory cache for the resolved "deposit to" account used for payments.
// undefined = not resolved yet, null = resolved but none found.
let cachedDepositAccountId: string | null | undefined;

/**
 * Resolve the Zoho "deposit to" account for recording payments. Uses
 * ZOHO_PAYMENT_ACCOUNT_ID when set, otherwise discovers the first active bank
 * account. Best-effort: returns undefined when none can be resolved.
 */
async function resolveZohoDepositAccountId(
  config: ZohoConfig,
  token: string,
): Promise<string | undefined> {
  const override = process.env.ZOHO_PAYMENT_ACCOUNT_ID?.trim();
  if (override) {
    return override;
  }
  if (cachedDepositAccountId !== undefined) {
    return cachedDepositAccountId ?? undefined;
  }
  try {
    const result = await zohoApiRequest<{
      chartofaccounts?: Array<{ account_id: string; is_active?: boolean }>;
    }>(config, token, "/chartofaccounts", {
      method: "GET",
      searchParams: { filter_by: "AccountType.Bank" },
    });
    const account =
      result.chartofaccounts?.find((row) => row.is_active !== false) ?? result.chartofaccounts?.[0];
    cachedDepositAccountId = account?.account_id ?? null;
  } catch (error) {
    console.error("ZOHO_DEPOSIT_ACCOUNT_LOOKUP_FAILED", {
      message: error instanceof Error ? error.message : String(error),
    });
    cachedDepositAccountId = null;
  }
  return cachedDepositAccountId ?? undefined;
}

/**
 * Record a full payment against a Zoho invoice so it shows as Paid. The booking
 * is already paid upfront via Paystack, so the whole amount is applied to the
 * invoice. Best-effort: returns false instead of throwing so it never blocks a
 * sync — the invoice still exists, just not marked paid.
 */
export async function recordZohoInvoicePayment(
  input: { invoiceId: string; contactId: string; amountCents: number; reference: string },
  config?: ZohoConfig,
  token?: string,
): Promise<boolean> {
  const resolved = config ?? getZohoConfig();
  if (!resolved) {
    return false;
  }
  const amount = centsToMajor(input.amountCents);
  if (!(amount > 0)) {
    return false;
  }

  try {
    const accessToken = token ?? (await getZohoAccessToken(resolved));
    const accountId = await resolveZohoDepositAccountId(resolved, accessToken);
    const payload = buildZohoPaymentPayload({
      contactId: input.contactId,
      invoiceId: input.invoiceId,
      amountCents: input.amountCents,
      reference: input.reference,
      date: new Date().toISOString().slice(0, 10),
      paymentMode: process.env.ZOHO_PAYMENT_MODE?.trim() || "banktransfer",
      accountId,
    });

    await zohoApiRequest(resolved, accessToken, "/customerpayments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return true;
  } catch (error) {
    console.error("ZOHO_INVOICE_PAYMENT_FAILED", {
      invoiceId: input.invoiceId,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
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
 * Fetch the Zoho invoice as a PDF and return it base64-encoded. Best-effort:
 * returns null (never throws) so a PDF fetch failure can't break invoice sync or
 * the notification flow — the email is simply sent without an attachment.
 */
export async function fetchZohoInvoicePdf(
  invoiceId: string,
  config: ZohoConfig,
  token: string,
): Promise<Buffer | null> {
  try {
    const url = new URL(`${zohoApiBaseUrl(config.dc)}/invoices/${invoiceId}`);
    url.searchParams.set("organization_id", config.organizationId);
    url.searchParams.set("accept", "pdf");

    const response = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });

    if (!response.ok) {
      console.error("ZOHO_INVOICE_PDF_FETCH_FAILED", { invoiceId, status: response.status });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length > 0 ? buffer : null;
  } catch (error) {
    console.error("ZOHO_INVOICE_PDF_FETCH_UNEXPECTED", {
      invoiceId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function fetchZohoInvoicePdfBase64(
  invoiceId: string,
  config: ZohoConfig,
  token: string,
): Promise<string | null> {
  const buffer = await fetchZohoInvoicePdf(invoiceId, config, token);
  return buffer ? buffer.toString("base64") : null;
}

/**
 * Fetch the PDF for a booking's synced Zoho invoice. Returns null when the
 * booking has no invoice or Zoho is unavailable. Used by the dashboard download
 * route; authorization is handled by the caller.
 */
export async function getZohoInvoicePdfForBooking(
  invoiceId: string,
): Promise<{ pdf: Buffer; filename: string } | null> {
  const config = getZohoConfig();
  if (!config || !invoiceId) {
    return null;
  }
  try {
    const token = await getZohoAccessToken(config);
    const pdf = await fetchZohoInvoicePdf(invoiceId, config, token);
    if (!pdf) {
      return null;
    }
    return { pdf, filename: `Invoice-${invoiceId}.pdf` };
  } catch (error) {
    console.error("ZOHO_INVOICE_PDF_FOR_BOOKING_FAILED", {
      invoiceId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
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

  const occurrenceCount = Math.max(1, booking.occurrence_count ?? 1);
  const seriesTotalCents = booking.series_total_cents ?? booking.final_total_cents;
  // The amount charged for this occurrence after any recurring frequency
  // discount (series total spread across the prepaid occurrences).
  const invoiceTotalCents = Math.round(seriesTotalCents / occurrenceCount);

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
    propertyType: booking.property_type ?? null,
    bedrooms: typeof booking.bedrooms === "number" ? booking.bedrooms : null,
    bathrooms: typeof booking.bathrooms === "number" ? booking.bathrooms : null,
    extraRooms: typeof booking.extra_rooms === "number" ? booking.extra_rooms : null,
    frequency: booking.recurrence_frequency ?? "once",
    occurrenceCount,
    invoiceTotalCents,
    breakdownLines: extractBreakdownLines(booking.pricing_snapshot),
  };
}

/**
 * Extract itemized pricing lines (base, per-bedroom/bathroom, add-ons, etc.)
 * from the stored pricing snapshot so the invoice records every booking choice.
 * Returns [] for missing/legacy snapshots so the caller falls back gracefully.
 */
function extractBreakdownLines(pricingSnapshot: unknown): ZohoBreakdownLine[] {
  if (!pricingSnapshot || typeof pricingSnapshot !== "object") {
    return [];
  }
  const breakdown = (pricingSnapshot as { breakdown?: unknown }).breakdown;
  if (!Array.isArray(breakdown)) {
    return [];
  }
  return breakdown.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { label?: unknown; amountCents?: unknown; category?: unknown };
    if (typeof record.label !== "string" || typeof record.amountCents !== "number") return [];
    if (record.amountCents <= 0) return [];
    return [
      {
        label: record.label,
        amountCents: record.amountCents,
        category: typeof record.category === "string" ? record.category : undefined,
      },
    ];
  });
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
    const missing = getMissingZohoConfigKeys();
    const message = missing.length > 0
      ? `Zoho Books is not configured. Missing/empty env vars: ${missing.join(", ")}.`
      : "Zoho Books is not configured.";
    await persistSyncOutcome(supabase, bookingId, {
      zoho_sync_status: "skipped",
      zoho_sync_error: message,
    });
    return { bookingId, status: "skipped", error: message };
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

    // The booking is paid upfront via Paystack — record a full payment so the
    // Zoho invoice is marked Paid. Use the discounted invoice total so the
    // payment exactly clears the (possibly frequency-discounted) balance.
    const chargedAmountCents = snapshot.invoiceTotalCents ?? snapshot.finalTotalCents;
    const markedPaid = await recordZohoInvoicePayment(
      {
        invoiceId: invoice.invoiceId,
        contactId,
        amountCents: chargedAmountCents,
        reference: snapshot.bookingReference,
      },
      config,
      token,
    );
    if (!markedPaid) {
      await markZohoInvoiceAsSent(invoice.invoiceId, config, token);
    }

    // Best-effort: fetch the invoice PDF so it can be attached to the email.
    const invoicePdfBase64 = await fetchZohoInvoicePdfBase64(invoice.invoiceId, config, token);

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

    // Best-effort: notify the customer + accounts team that the invoice exists.
    await notifyInvoiceCreated(supabase, {
      customerEmail: snapshot.customerEmail,
      customerName: snapshot.customerName,
      invoiceNumber: invoice.invoiceNumber ?? snapshot.bookingReference,
      serviceName: snapshot.serviceName,
      amountCents: chargedAmountCents,
      invoiceUrl,
      pdfBase64: invoicePdfBase64,
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
