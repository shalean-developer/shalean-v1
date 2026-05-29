// Server-only Resend email client.
//
// SECURITY: reads RESEND_API_KEY and recipient addresses from the environment.
// None are NEXT_PUBLIC_*, so they are never bundled into the browser. Do not
// import this module from a Client Component.
//
// SAFETY: sendEmail never throws. When RESEND_API_KEY is missing it returns a
// "skipped" (dry-run) result so local/dev flows and the cron worker keep working
// without a live Resend account.

import { Resend } from "resend";
import { shaleanBrand } from "./branding";

const DEFAULT_DOMAIN = "shalean.com";

export type EmailAudience = "noreply" | "bookings" | "accounts" | "support" | "admin";

/**
 * Resolve configured email addresses from the environment, falling back to
 * sensible @shalean.com defaults so templates always have a valid sender.
 */
export function getEmailAddresses() {
  const from = process.env.EMAIL_FROM?.trim() || `${shaleanBrand.name} <noreply@${DEFAULT_DOMAIN}>`;
  return {
    from,
    admin: process.env.ADMIN_EMAIL?.trim() || `admin@${DEFAULT_DOMAIN}`,
    bookings: process.env.BOOKINGS_EMAIL?.trim() || `bookings@${DEFAULT_DOMAIN}`,
    accounts: process.env.ACCOUNTS_EMAIL?.trim() || `accounts@${DEFAULT_DOMAIN}`,
    support: process.env.SUPPORT_EMAIL?.trim() || `support@${DEFAULT_DOMAIN}`,
  };
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

let cachedClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }
  return cachedClient;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null; provider: "resend" }
  | { ok: true; skipped: true; provider: "dry_run" }
  | { ok: false; error: string; provider: "resend" };

/**
 * Send a single email via Resend. Never throws — all failures are returned as a
 * structured result so callers (and the outbox worker) can decide how to react.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getResendClient();

  // Dry-run when Resend isn't configured: report success-as-skipped so we never
  // crash a booking/payment flow just because email isn't set up yet.
  if (!client) {
    return { ok: true, skipped: true, provider: "dry_run" };
  }

  const from = input.from?.trim() || getEmailAddresses().from;

  try {
    const result = await client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });

    if (result.error) {
      return { ok: false, error: result.error.message ?? "Resend returned an error.", provider: "resend" };
    }

    return { ok: true, id: result.data?.id ?? null, provider: "resend" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Resend send error.",
      provider: "resend",
    };
  }
}
