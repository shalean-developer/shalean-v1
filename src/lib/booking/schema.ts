import { z } from "zod";

export const bookingDraftSchema = z.object({
  serviceSlug: z.string().min(1),
  frequency: z.enum(["once", "weekly", "fortnightly", "monthly"]),
  date: z.string().min(1),
  timeWindow: z.string().min(1),
  address: z.string().min(5),
  suburb: z.string().min(2),
  propertyType: z.enum(["apartment", "house", "office", "airbnb"]),
  bedrooms: z.number().int().min(0).max(12),
  bathrooms: z.number().int().min(0).max(12),
  extraRooms: z.number().int().min(0).max(12),
  squareMeters: z.number().int().min(20).max(2000),
  addOns: z.object({
    equipment: z.boolean(),
    insideFridge: z.boolean(),
    insideOven: z.boolean(),
    windows: z.boolean(),
    laundry: z.boolean(),
  }),
  assignmentMode: z.enum(["auto", "preferred_cleaner", "customer_team"]),
  preferredCleanerId: z.string().optional(),
  requestedCleaners: z.number().int().min(1).max(5),
  customer: z.object({
    name: z.string().min(2),
    email: z.email(),
    phone: z.string().min(8),
  }),
  notes: z.string().max(1000),
});

export const quoteRequestSchema = bookingDraftSchema;
