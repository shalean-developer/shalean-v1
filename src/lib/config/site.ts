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
