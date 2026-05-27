import { z } from "zod";

const checkoutIdSchema = z.string().uuid();
const bookingDateSchema = z.string().min(1).refine(isTodayOrFutureDate, {
  message: "Choose today or a future date",
});
const quoteDateSchema = z.string().default("").refine((value) => !value || isTodayOrFutureDate(value), {
  message: "Choose today or a future date",
});

export const bookingDraftSchema = z.object({
  checkoutId: checkoutIdSchema,
  serviceSlug: z.string().min(1),
  frequency: z.enum(["once", "weekly", "fortnightly", "monthly"]),
  recurrence: z.object({
    weekdays: z.array(z.number().int().min(1).max(7)).default([]),
  }).default({ weekdays: [] }),
  date: bookingDateSchema,
  timeWindow: z.string().min(1),
  address: z.string().min(5),
  suburb: z.string().min(2),
  propertyType: z.enum(["apartment", "house", "office", "airbnb"]),
  bedrooms: z.number().int().min(0).max(12),
  bathrooms: z.number().int().min(0).max(12),
  extraRooms: z.number().int().min(0).max(12),
  squareMeters: z.preprocess(
    (value) => (typeof value === "number" && value >= 20 ? value : 80),
    z.number().int().min(20).max(2000),
  ),
  addOns: z.object({
    insideCabinets: z.boolean(),
    insideOven: z.boolean(),
    insideFridge: z.boolean(),
    interiorWalls: z.boolean(),
    ironing: z.boolean(),
    laundry: z.boolean(),
    interiorWindows: z.boolean(),
  }),
  equipment: z.object({
    mode: z.enum(["with_equipment", "without_equipment"]),
    items: z.array(z.string()),
  }),
  assignmentMode: z.enum(["auto", "preferred_cleaner", "customer_team"]),
  preferredCleanerId: z.string().uuid().optional(),
  selectedCleanerIds: z.array(z.string()),
  requestedCleaners: z.number().int().min(1).max(4),
  customer: z.object({
    name: z.string().min(2),
    email: z.email(),
    phone: z.string().min(8),
  }),
  notes: z.string().max(1000),
});

export const quoteRequestSchema = bookingDraftSchema.extend({
  date: quoteDateSchema,
  address: z.string().default(""),
  customer: z.object({
    name: z.string().default(""),
    email: z.string().default("customer@example.com"),
    phone: z.string().default("00000000"),
  }),
  notes: z.string().max(1000).default(""),
});

function isTodayOrFutureDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return value >= todayInJohannesburg();
}

function todayInJohannesburg() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
