export type ServiceCategory =
  | "regular"
  | "deep"
  | "airbnb"
  | "move"
  | "carpet"
  | "office";

export type AssignmentMode = "auto" | "preferred_cleaner" | "customer_team";
export type Frequency = "once" | "weekly" | "fortnightly" | "monthly";
export type EquipmentMode = "with_equipment" | "without_equipment";

export type PremiumAddOnKey =
  | "insideCabinets"
  | "insideOven"
  | "insideFridge"
  | "interiorWalls"
  | "laundryIroning"
  | "interiorWindows";

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
  checkoutId: string;
  serviceSlug: string;
  frequency: Frequency;
  recurrence: {
    weekdays: number[];
  };
  date: string;
  timeWindow: string;
  address: string;
  suburb: string;
  propertyType: "apartment" | "house" | "office" | "airbnb";
  bedrooms: number;
  bathrooms: number;
  extraRooms: number;
  squareMeters: number;
  addOns: Record<PremiumAddOnKey, boolean>;
  equipment: {
    mode: EquipmentMode;
    items: string[];
  };
  assignmentMode: AssignmentMode;
  preferredCleanerId?: string;
  selectedCleanerIds: string[];
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
  durationHours?: number;
  category?: "base" | "rooms" | "addon" | "equipment" | "cleaners" | "team";
};

export type BookingQuote = {
  serviceSlug: string;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  cleanerCount: number;
  recommendedCleanerCount: number;
  recommendedTeamSize: number;
  estimatedHours: number;
  workloadHours: number;
  requiresTeam: boolean;
  lineItems: QuoteLineItem[];
  addOnTotalCents: number;
  equipmentCents: number;
  payout: {
    cleanerTotalCents: number;
    perCleanerCents: number;
    rule: string;
  };
};
