import { z } from "zod";
import { REGULAR_CLEANING_SLUG } from "./types";

const bookingDateSchema = z.string().min(1).refine(isTodayOrFutureDate, {
  message: "Choose today or a future date",
});

export const regularCleaningBookingInputSchema = z.object({
  checkoutId: z.string().uuid(),
  serviceSlug: z.literal(REGULAR_CLEANING_SLUG),
  frequency: z.enum(["once", "weekly", "fortnightly", "monthly"]).default("once"),
  recurrenceWeekdays: z.array(z.number().int().min(1).max(7)).default([]),
  bookingDate: bookingDateSchema,
  bookingTime: z.string().min(1),
  address: z.string().min(5),
  suburb: z.string().min(2),
  propertyType: z.string().min(1).default("house"),
  bedrooms: z.number().int().min(0).max(12),
  bathrooms: z.number().int().min(0).max(12),
  extraRooms: z.number().int().min(0).max(12).default(0),
  selectedAddonKeys: z.array(z.string()).default([]),
  equipmentOptionKey: z.enum(["without_equipment", "with_equipment"]),
  cleanerCount: z.number().int().min(1).max(4),
  selectedCleanerId: z.string().uuid().nullable().optional(),
  accessNotes: z.string().max(1000).nullable().optional(),
  customer: z.object({
    fullName: z.string().min(2),
    email: z.email(),
    phone: z.string().min(8),
  }),
});

export type RegularCleaningBookingInputSchema = z.infer<typeof regularCleaningBookingInputSchema>;

function isTodayOrFutureDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return value >= new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
