import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEmailAddresses, isResendConfigured, sendEmail } from "./client";

const EMAIL_ENV_KEYS = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "ADMIN_EMAIL",
  "BOOKINGS_EMAIL",
  "ACCOUNTS_EMAIL",
  "SUPPORT_EMAIL",
] as const;

describe("email client config", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of EMAIL_ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of EMAIL_ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it("falls back to @shalean.com defaults when env is unset", () => {
    const addresses = getEmailAddresses();
    expect(addresses.from).toContain("noreply@shalean.com");
    expect(addresses.admin).toBe("admin@shalean.com");
    expect(addresses.bookings).toBe("bookings@shalean.com");
    expect(addresses.accounts).toBe("accounts@shalean.com");
    expect(addresses.support).toBe("support@shalean.com");
  });

  it("uses configured env values when present", () => {
    process.env.EMAIL_FROM = "Shalean <hello@shalean.com>";
    process.env.ADMIN_EMAIL = "ops@shalean.com";
    const addresses = getEmailAddresses();
    expect(addresses.from).toBe("Shalean <hello@shalean.com>");
    expect(addresses.admin).toBe("ops@shalean.com");
  });

  it("reports Resend as unconfigured without an API key", () => {
    expect(isResendConfigured()).toBe(false);
  });

  it("sendEmail never throws and dry-runs when no API key is set", async () => {
    const result = await sendEmail({
      to: "customer@shalean.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("dry_run");
    expect("skipped" in result && result.skipped).toBe(true);
  });
});
