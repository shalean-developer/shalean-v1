export type ServiceCategory =
  | "regular"
  | "deep"
  | "airbnb"
  | "move"
  | "carpet"
  | "office";

export type AssignmentMode = "auto" | "preferred_cleaner" | "customer_team";
export type Frequency = "once" | "weekly" | "fortnightly" | "monthly";

export type BookingLifecycleStatus =
  | "draft"
  | "quote_ready"
  | "payment_pending"
  | "paid"
  | "assignment_pending"
  | "offered"
  | "assigned"
  | "in_progress"
  | "completed"
  | "payout_ready"
  | "paid_out"
  | "cancelled"
  | "refunded";

export type ServiceDefinition = {
  slug: string;
  title: string;
  category: ServiceCategory;
  summary: string;
  description: string;
  baseCents: number;
  minHours: number;
  requiresTeam: boolean;
  allowMultipleCleaners: boolean;
  allowEquipmentAddon: boolean;
  seoKeywords: string[];
};

export type BookingDraft = {
  serviceSlug: string;
  frequency: Frequency;
  date: string;
  timeWindow: string;
  address: string;
  suburb: string;
  propertyType: "apartment" | "house" | "office" | "airbnb";
  bedrooms: number;
  bathrooms: number;
  extraRooms: number;
  squareMeters: number;
  addOns: {
    equipment: boolean;
    insideFridge: boolean;
    insideOven: boolean;
    windows: boolean;
    laundry: boolean;
  };
  assignmentMode: AssignmentMode;
  preferredCleanerId?: string;
  requestedCleaners: number;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  notes: string;
};

export type QuoteLineItem = {
  label: string;
  amountCents: number;
};

export type BookingQuote = {
  serviceSlug: string;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  cleanerCount: number;
  recommendedTeamSize: number;
  estimatedHours: number;
  requiresTeam: boolean;
  lineItems: QuoteLineItem[];
  payout: {
    cleanerTotalCents: number;
    perCleanerCents: number;
    rule: string;
  };
};
