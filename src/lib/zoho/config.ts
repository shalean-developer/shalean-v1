// Pure Zoho Books configuration helpers. This module intentionally contains NO
// network calls and NO secret usage beyond reading the server-only env vars, so
// the domain/URL helpers can be unit tested without credentials.

export type ZohoConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  organizationId: string;
  dc: string;
};

/**
 * Normalize a configured data-center value into a Zoho domain suffix.
 *
 * Accepts friendly aliases ("us", "europe"), region codes ("eu", "in") or a raw
 * suffix ("com", "com.au"). Defaults to "com" (US) when empty/unknown.
 */
export function normalizeZohoDc(dc: string | null | undefined): string {
  const value = (dc ?? "").trim().toLowerCase().replace(/^\./, "");

  if (!value) {
    return "com";
  }

  const aliases: Record<string, string> = {
    us: "com",
    usa: "com",
    com: "com",
    eu: "eu",
    europe: "eu",
    in: "in",
    india: "in",
    au: "com.au",
    australia: "com.au",
    "com.au": "com.au",
    jp: "jp",
    japan: "jp",
    ca: "ca",
    canada: "ca",
    sa: "sa",
    "com.sa": "sa",
  };

  return aliases[value] ?? value;
}

export function zohoAccountsBaseUrl(dc: string | null | undefined): string {
  return `https://accounts.zoho.${normalizeZohoDc(dc)}`;
}

export function zohoApiBaseUrl(dc: string | null | undefined): string {
  return `https://www.zohoapis.${normalizeZohoDc(dc)}/books/v3`;
}

export function zohoInvoiceAppUrl(input: {
  dc: string | null | undefined;
  organizationId: string;
  invoiceId: string;
}): string {
  const suffix = normalizeZohoDc(input.dc);
  return `https://books.zoho.${suffix}/app/${input.organizationId}#/invoices/${input.invoiceId}`;
}

/**
 * Read the Zoho Books configuration from the environment.
 *
 * Returns `null` when any required variable is missing so callers can safely
 * "skip" syncing instead of throwing when the integration is not yet wired up.
 * All variables are server-only (no NEXT_PUBLIC_ prefix) and must never be sent
 * to the browser.
 */
export function getZohoConfig(): ZohoConfig | null {
  const clientId = process.env.ZOHO_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN?.trim();
  const organizationId = process.env.ZOHO_ORGANIZATION_ID?.trim();
  const dc = process.env.ZOHO_DC?.trim();

  if (!clientId || !clientSecret || !refreshToken || !organizationId) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
    organizationId,
    dc: dc && dc.length > 0 ? dc : "com",
  };
}

export function isZohoConfigured(): boolean {
  return getZohoConfig() !== null;
}

/** Required Zoho env vars (ZOHO_DC is optional and defaults to "com"). */
export const REQUIRED_ZOHO_ENV_KEYS = [
  "ZOHO_CLIENT_ID",
  "ZOHO_CLIENT_SECRET",
  "ZOHO_REFRESH_TOKEN",
  "ZOHO_ORGANIZATION_ID",
] as const;

/**
 * Returns the names (never values) of required Zoho env vars that are
 * missing/empty in the current runtime. Used to produce actionable
 * "which key is missing" diagnostics without leaking secrets.
 */
export function getMissingZohoConfigKeys(): string[] {
  return REQUIRED_ZOHO_ENV_KEYS.filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });
}
