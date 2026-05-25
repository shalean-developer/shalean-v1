import type { ServiceDefinition } from "./types";

export const serviceCatalog: ServiceDefinition[] = [
  {
    slug: "regular-cleaning",
    title: "Regular Cleaning",
    category: "regular",
    summary: "Recurring or once-off home cleaning with flexible cleaner selection.",
    description:
      "Reliable maintenance cleaning for apartments and houses, with optional equipment and preferred cleaner support.",
    baseCents: 42000,
    minHours: 3,
    requiresTeam: false,
    allowMultipleCleaners: true,
    allowEquipmentAddon: true,
    seoKeywords: ["regular cleaning Cape Town", "home cleaner", "weekly cleaning"],
  },
  {
    slug: "deep-cleaning",
    title: "Deep Cleaning",
    category: "deep",
    summary: "Team-based intensive cleaning for detailed top-to-bottom resets.",
    description:
      "A structured deep clean for kitchens, bathrooms, living areas, detailed dusting, and high-touch surfaces.",
    baseCents: 110000,
    minHours: 5,
    requiresTeam: true,
    allowMultipleCleaners: false,
    allowEquipmentAddon: true,
    seoKeywords: ["deep cleaning Cape Town", "spring cleaning", "team cleaning"],
  },
  {
    slug: "airbnb-cleaning",
    title: "Airbnb Cleaning",
    category: "airbnb",
    summary: "Turnover cleaning for short-stay hosts with quality checks.",
    description:
      "Fast, checklist-led Airbnb turnover cleaning with linen, reset notes, and host-ready handover support.",
    baseCents: 48000,
    minHours: 3,
    requiresTeam: false,
    allowMultipleCleaners: true,
    allowEquipmentAddon: true,
    seoKeywords: ["Airbnb cleaning Cape Town", "turnover cleaning", "short stay cleaning"],
  },
  {
    slug: "move-in-out-cleaning",
    title: "Move In/Out Cleaning",
    category: "move",
    summary: "Team dispatch for vacant homes, inspections, and handovers.",
    description:
      "A move-ready clean for empty homes, rental handovers, estate agents, and pre-occupation preparation.",
    baseCents: 130000,
    minHours: 6,
    requiresTeam: true,
    allowMultipleCleaners: false,
    allowEquipmentAddon: true,
    seoKeywords: ["move out cleaning Cape Town", "end of lease cleaning", "move in cleaning"],
  },
  {
    slug: "carpet-cleaning",
    title: "Carpet Cleaning",
    category: "carpet",
    summary: "Room-based carpet refresh with operational capacity planning.",
    description:
      "Professional carpet cleaning priced by room count and floor area, with dispatch notes for equipment needs.",
    baseCents: 35000,
    minHours: 2,
    requiresTeam: false,
    allowMultipleCleaners: false,
    allowEquipmentAddon: false,
    seoKeywords: ["carpet cleaning Cape Town", "rug cleaning", "upholstery refresh"],
  },
  {
    slug: "office-cleaning",
    title: "Office Cleaning",
    category: "office",
    summary: "Commercial cleaning for workspaces with recurring scheduling.",
    description:
      "Office cleaning for small teams and growing workplaces, including recurring scheduling and admin oversight.",
    baseCents: 65000,
    minHours: 3,
    requiresTeam: false,
    allowMultipleCleaners: true,
    allowEquipmentAddon: true,
    seoKeywords: ["office cleaning Cape Town", "commercial cleaner", "workspace cleaning"],
  },
];

export function getService(slug: string) {
  return serviceCatalog.find((service) => service.slug === slug);
}
