import { getMissingZohoConfigKeys, isZohoConfigured } from "@/lib/zoho/config";

// TEMPORARY diagnostic endpoint. Reports ONLY which Zoho env var NAMES are
// present/missing in the running runtime — never any secret values. Used to
// pinpoint a misconfiguration in production, then removed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    configured: isZohoConfigured(),
    missing: getMissingZohoConfigKeys(),
    present: {
      ZOHO_CLIENT_ID: Boolean(process.env.ZOHO_CLIENT_ID?.trim()),
      ZOHO_CLIENT_SECRET: Boolean(process.env.ZOHO_CLIENT_SECRET?.trim()),
      ZOHO_REFRESH_TOKEN: Boolean(process.env.ZOHO_REFRESH_TOKEN?.trim()),
      ZOHO_ORGANIZATION_ID: Boolean(process.env.ZOHO_ORGANIZATION_ID?.trim()),
      ZOHO_DC: Boolean(process.env.ZOHO_DC?.trim()),
    },
    zohoDcValue: process.env.ZOHO_DC?.trim() || null,
  });
}
