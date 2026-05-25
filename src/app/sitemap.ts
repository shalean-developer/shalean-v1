import type { MetadataRoute } from "next";
import { serviceCatalog } from "@/lib/booking/services";
import { siteConfig, suburbSlugs } from "@/lib/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;

  return [
    "",
    "/book",
    "/dashboard",
    "/cleaner",
    "/admin",
    ...serviceCatalog.map((service) => `/services/${service.slug}`),
    ...suburbSlugs.map((suburb) => `/locations/${suburb}`),
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
