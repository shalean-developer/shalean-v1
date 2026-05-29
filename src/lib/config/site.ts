export const siteConfig = {
  name: "Shalean Cleaning Services",
  shortName: "Shalean",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://shalean.co.za",
  description:
    "Premium cleaning services marketplace for homes, offices, Airbnb turnovers, deep cleans, move in/out cleaning, and carpet cleaning in Cape Town.",
  phone: "+27 21 000 0000",
  email: "ops@shalean.co.za",
  serviceArea: "Cape Town, South Africa",
};

/**
 * Absolute base URL for building customer-facing links from server code (e.g.
 * Paystack callback + payment links sent by email). Prefers an explicit app URL,
 * then the public site URL, then a safe production default. Trailing slash is
 * always stripped so callers can append paths directly.
 */
export function appUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    siteConfig.url;
  return fromEnv.replace(/\/$/, "");
}

export const supportContact = {
  callNumber: "087 153 5250",
  callHref: "tel:+27871535250",
  whatsappNumber: "082 591 5525",
  whatsappHref: "https://wa.me/27825915525",
};

export function buildWhatsappLink(href: string, message?: string) {
  if (!message) {
    return href;
  }

  return `${href}?text=${encodeURIComponent(message)}`;
}

export const capeTownSuburbs = [
  "Sea Point",
  "Green Point",
  "Camps Bay",
  "Claremont",
  "Rondebosch",
  "Newlands",
  "Woodstock",
  "Observatory",
  "Century City",
  "Bloubergstrand",
  "Durbanville",
  "Bellville",
];

export const suburbSlugs = capeTownSuburbs.map((suburb) =>
  suburb.toLowerCase().replaceAll(" ", "-"),
);
