// Shalean email branding + shared, mobile-friendly HTML layout.
//
// All customer- and admin-facing email shares this layout so contact details and
// branding stay consistent and correct in one place.

export const shaleanBrand = {
  name: "Shalean Cleaning Services",
  shortName: "Shalean",
  website: "www.shalean.com",
  websiteUrl: "https://www.shalean.com",
  callNumber: "087 153 5250",
  whatsappNumber: "082 591 5525",
  // Brand colors (kept inline because most email clients strip <style> blocks).
  colors: {
    brand: "#047857",
    brandDark: "#065f46",
    text: "#0f172a",
    muted: "#475569",
    border: "#e2e8f0",
    surface: "#f8fafc",
  },
} as const;

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type DetailRow = { label: string; value: string };

/** Render a label/value detail table used inside email bodies. */
export function renderDetailRows(rows: DetailRow[]): string {
  const cells = rows
    .filter((row) => row.value !== "" && row.value != null)
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 0;color:${shaleanBrand.colors.muted};font-size:14px;vertical-align:top;width:42%;">${escapeHtml(row.label)}</td>
          <td style="padding:8px 0;color:${shaleanBrand.colors.text};font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${cells}</table>`;
}

export function renderButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:8px;background:${shaleanBrand.colors.brand};">
          <a href="${encodeURI(url)}" target="_blank" rel="noreferrer"
            style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

type LayoutInput = {
  heading: string;
  intro: string;
  bodyHtml: string;
  bodyText: string;
};

/**
 * Wrap email body content in the shared Shalean layout. Returns both HTML and a
 * plain-text fallback so every send includes a `text` part for deliverability.
 */
export function renderEmailLayout(input: LayoutInput): { html: string; text: string } {
  const { colors } = shaleanBrand;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(input.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${colors.surface};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.surface};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${colors.border};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:${colors.brand};padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.04em;">${escapeHtml(shaleanBrand.name)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${colors.text};">${escapeHtml(input.heading)}</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${colors.muted};">${escapeHtml(input.intro)}</p>
                ${input.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;background:${colors.surface};border-top:1px solid ${colors.border};">
                <p style="margin:0 0 6px;font-size:13px;color:${colors.muted};">Need a hand? We're here for you.</p>
                <p style="margin:0;font-size:13px;color:${colors.text};font-weight:600;">
                  Call ${escapeHtml(shaleanBrand.callNumber)} &nbsp;&bull;&nbsp; WhatsApp ${escapeHtml(shaleanBrand.whatsappNumber)}
                </p>
                <p style="margin:10px 0 0;font-size:13px;">
                  <a href="${shaleanBrand.websiteUrl}" target="_blank" rel="noreferrer" style="color:${colors.brand};font-weight:600;text-decoration:none;">${escapeHtml(shaleanBrand.website)}</a>
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:${colors.muted};max-width:560px;">
            &copy; ${new Date().getFullYear()} ${escapeHtml(shaleanBrand.name)}. Cape Town, South Africa.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    shaleanBrand.name,
    "",
    input.heading,
    "",
    input.intro,
    "",
    input.bodyText.trim(),
    "",
    "----",
    `Call ${shaleanBrand.callNumber}  |  WhatsApp ${shaleanBrand.whatsappNumber}`,
    shaleanBrand.website,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return { html, text };
}

/** Plain-text detail rows for the text/plain part. */
export function textDetailRows(rows: DetailRow[]): string {
  return rows
    .filter((row) => row.value !== "" && row.value != null)
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");
}
