import { REGULAR_CLEANING_SLUG } from "@/lib/regular-cleaning/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export type CleanerRow = Database["public"]["Tables"]["cleaners"]["Row"];
export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
export type AddonRow = Database["public"]["Tables"]["service_addons"]["Row"];
export type EquipmentRow = Database["public"]["Tables"]["service_equipment_options"]["Row"];
export type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
export type PricingRuleRow = Database["public"]["Tables"]["pricing_rules"]["Row"];
export type RecurringPricingRuleRow = Database["public"]["Tables"]["recurring_pricing_rules"]["Row"];
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

export type AdminPaymentStatusFilter = "all" | "paid" | "pending" | "refunded";

export type AdminPayment = PaymentRow & {
  booking: BookingRow | null;
  customer: CustomerRow | null;
};

export type AdminBookingListItem = BookingRow & {
  customer: CustomerRow | null;
  payment: PaymentRow | null;
};

export type CleanerDirectoryRow = CleanerRow & {
  jobsCompleted: number;
  lastBookingDate: string | null;
};

export type AdminCleanerBooking = {
  id: string;
  bookingDate: string;
  bookingTime: string;
  suburb: string;
  status: string;
  offerStatus: string;
  finalTotalCents: number;
};

const COMPLETED_OFFER_STATUS = "completed";

export async function loadAdminCleanerDirectory(): Promise<{ cleaners: CleanerDirectoryRow[] }> {
  const supabase = createSupabaseAdminClient();
  const cleanersResult = await supabase.from("cleaners").select("*").order("display_name");
  if (cleanersResult.error) throw cleanersResult.error;

  const cleaners = cleanersResult.data ?? [];
  if (cleaners.length === 0) {
    return { cleaners: [] };
  }

  const cleanerIds = cleaners.map((cleaner) => cleaner.id);
  const offersResult = await supabase
    .from("booking_cleaners")
    .select("cleaner_id, booking_id, status")
    .in("cleaner_id", cleanerIds);
  if (offersResult.error) throw offersResult.error;

  const offers = offersResult.data ?? [];
  const bookingIds = compactUnique(offers.map((offer) => offer.booking_id));
  const bookingDates = bookingIds.length > 0 ? await loadBookingDatesByIds(bookingIds) : new Map<string, string>();

  const jobsCompletedByCleaner = new Map<string, number>();
  const lastBookingByCleaner = new Map<string, string>();

  for (const offer of offers) {
    if (!offer.cleaner_id) continue;

    if (offer.status === COMPLETED_OFFER_STATUS) {
      jobsCompletedByCleaner.set(offer.cleaner_id, (jobsCompletedByCleaner.get(offer.cleaner_id) ?? 0) + 1);
    }

    const bookingDate = bookingDates.get(offer.booking_id);
    if (bookingDate) {
      const current = lastBookingByCleaner.get(offer.cleaner_id);
      if (!current || bookingDate > current) {
        lastBookingByCleaner.set(offer.cleaner_id, bookingDate);
      }
    }
  }

  return {
    cleaners: cleaners.map((cleaner) => ({
      ...cleaner,
      jobsCompleted: jobsCompletedByCleaner.get(cleaner.id) ?? 0,
      lastBookingDate: lastBookingByCleaner.get(cleaner.id) ?? null,
    })),
  };
}

export async function loadAdminCleanerProfile(cleanerId: string): Promise<{
  cleaner: CleanerDirectoryRow;
  bookings: AdminCleanerBooking[];
} | null> {
  const supabase = createSupabaseAdminClient();
  const cleanerResult = await supabase.from("cleaners").select("*").eq("id", cleanerId).maybeSingle();
  if (cleanerResult.error) throw cleanerResult.error;
  if (!cleanerResult.data) {
    return null;
  }

  const cleaner = cleanerResult.data;
  const offersResult = await supabase
    .from("booking_cleaners")
    .select("booking_id, status")
    .eq("cleaner_id", cleanerId);
  if (offersResult.error) throw offersResult.error;

  const offers = offersResult.data ?? [];
  const offerStatusByBooking = new Map<string, string>();
  for (const offer of offers) {
    if (!offerStatusByBooking.has(offer.booking_id)) {
      offerStatusByBooking.set(offer.booking_id, offer.status);
    }
  }

  const bookingIds = compactUnique(offers.map((offer) => offer.booking_id));
  const bookingRows = bookingIds.length > 0 ? await loadBookingsByIds(bookingIds) : [];
  const jobsCompleted = offers.filter((offer) => offer.status === COMPLETED_OFFER_STATUS).length;

  const bookings: AdminCleanerBooking[] = bookingRows
    .map((booking) => ({
      id: booking.id,
      bookingDate: booking.booking_date,
      bookingTime: booking.booking_time,
      suburb: booking.suburb,
      status: booking.booking_status,
      offerStatus: offerStatusByBooking.get(booking.id) ?? "—",
      finalTotalCents: booking.final_total_cents,
    }))
    .sort((left, right) => `${right.bookingDate} ${right.bookingTime}`.localeCompare(`${left.bookingDate} ${left.bookingTime}`));

  const lastBookingDate = bookings[0]?.bookingDate ?? null;

  return {
    cleaner: { ...cleaner, jobsCompleted, lastBookingDate },
    bookings,
  };
}

async function loadBookingDatesByIds(ids: string[]) {
  const supabase = createSupabaseAdminClient();
  const result = await supabase.from("bookings").select("id, booking_date").in("id", ids);
  if (result.error) throw result.error;

  const map = new Map<string, string>();
  for (const row of result.data ?? []) {
    map.set(row.id, row.booking_date);
  }
  return map;
}

export async function loadAdminManagementData() {
  const supabase = createSupabaseAdminClient();
  const [cleanersResult, customersResult, addonsResult, equipmentResult, pricingRulesResult] = await Promise.all([
    supabase.from("cleaners").select("*").order("display_name"),
    supabase.from("customers").select("*").order("full_name"),
    supabase.from("service_addons").select("*").eq("service_slug", REGULAR_CLEANING_SLUG).eq("active", true).order("sort_order"),
    supabase.from("service_equipment_options").select("*").eq("service_slug", REGULAR_CLEANING_SLUG).eq("active", true).order("sort_order"),
    supabase.from("regular_cleaning_pricing_rules").select("id", { count: "exact", head: true }).eq("active", true),
  ]);

  if (cleanersResult.error) throw cleanersResult.error;
  if (customersResult.error) throw customersResult.error;
  if (addonsResult.error) throw addonsResult.error;
  if (equipmentResult.error) throw equipmentResult.error;
  if (pricingRulesResult.error) throw pricingRulesResult.error;

  return {
    cleaners: cleanersResult.data ?? [],
    customers: customersResult.data ?? [],
    addons: addonsResult.data ?? [],
    equipmentOptions: equipmentResult.data ?? [],
    hasActivePricingRules: (pricingRulesResult.count ?? 0) > 0,
  };
}

export async function loadAdminPricingData() {
  const supabase = createSupabaseAdminClient();
  const [servicesResult, houseRulesResult, addonsResult, equipmentResult, quantityRulesResult, recurringRulesResult] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .eq("slug", REGULAR_CLEANING_SLUG)
      .order("title"),
    supabase
      .from("pricing_rules")
      .select("*")
      .eq("service_slug", REGULAR_CLEANING_SLUG)
      .order("sort_order"),
    supabase
      .from("service_addons")
      .select("*")
      .eq("service_slug", REGULAR_CLEANING_SLUG)
      .order("sort_order"),
    supabase
      .from("service_equipment_options")
      .select("*")
      .eq("service_slug", REGULAR_CLEANING_SLUG)
      .order("sort_order"),
    supabase
      .from("cleaner_quantity_rules")
      .select("*")
      .eq("service_slug", REGULAR_CLEANING_SLUG)
      .order("created_at"),
    supabase
      .from("recurring_pricing_rules")
      .select("*")
      .eq("service_slug", REGULAR_CLEANING_SLUG)
      .order("sort_order"),
  ]);

  if (servicesResult.error) throw servicesResult.error;
  if (houseRulesResult.error) throw houseRulesResult.error;
  if (addonsResult.error) throw addonsResult.error;
  if (equipmentResult.error) throw equipmentResult.error;
  if (quantityRulesResult.error) throw quantityRulesResult.error;
  if (recurringRulesResult.error) throw recurringRulesResult.error;

  return {
    services: servicesResult.data ?? [],
    houseRules: houseRulesResult.data ?? [],
    addons: addonsResult.data ?? [],
    equipmentOptions: equipmentResult.data ?? [],
    cleanerQuantityRules: quantityRulesResult.data ?? [],
    recurringRules: recurringRulesResult.data ?? [],
  };
}

export async function loadAdminPayments(status: AdminPaymentStatusFilter = "all") {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const paymentsResult = await query;
  if (paymentsResult.error) throw paymentsResult.error;

  const payments = paymentsResult.data ?? [];
  const bookingIds = compactUnique(payments.map((payment) => payment.booking_id));
  const bookings = bookingIds.length > 0 ? await loadBookingsByIds(bookingIds) : [];
  const customerIds = compactUnique(bookings.map((booking) => booking.customer_id));
  const customers = customerIds.length > 0 ? await loadCustomersByIds(customerIds) : [];

  return payments.map((payment) => {
    const booking = bookings.find((item) => item.id === payment.booking_id) ?? null;
    const customer = booking?.customer_id
      ? customers.find((item) => item.id === booking.customer_id) ?? null
      : null;

    return {
      ...payment,
      booking,
      customer,
    } satisfies AdminPayment;
  });
}

export async function loadAdminBookings(limit = 100) {
  const supabase = createSupabaseAdminClient();
  const bookingsResult = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (bookingsResult.error) throw bookingsResult.error;

  const bookings = bookingsResult.data ?? [];
  const customerIds = compactUnique(bookings.map((booking) => booking.customer_id));
  const bookingIds = bookings.map((booking) => booking.id);
  const [customers, payments] = await Promise.all([
    customerIds.length > 0 ? loadCustomersByIds(customerIds) : Promise.resolve([]),
    bookingIds.length > 0 ? loadPaymentsByBookingIds(bookingIds) : Promise.resolve([]),
  ]);

  return bookings.map((booking) => ({
    ...booking,
    customer: booking.customer_id
      ? customers.find((customer) => customer.id === booking.customer_id) ?? null
      : null,
    payment: payments.find((payment) => payment.booking_id === booking.id) ?? null,
  } satisfies AdminBookingListItem));
}

async function loadBookingsByIds(ids: string[]) {
  const supabase = createSupabaseAdminClient();
  const result = await supabase.from("bookings").select("*").in("id", ids);
  if (result.error) throw result.error;
  return result.data ?? [];
}

async function loadCustomersByIds(ids: string[]) {
  const supabase = createSupabaseAdminClient();
  const result = await supabase.from("customers").select("*").in("id", ids);
  if (result.error) throw result.error;
  return result.data ?? [];
}

async function loadPaymentsByBookingIds(bookingIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("payments")
    .select("*")
    .in("booking_id", bookingIds)
    .order("created_at", { ascending: false });
  if (result.error) throw result.error;

  const latestByBooking = new Map<string, PaymentRow>();
  for (const payment of result.data ?? []) {
    if (!latestByBooking.has(payment.booking_id)) {
      latestByBooking.set(payment.booking_id, payment);
    }
  }
  return Array.from(latestByBooking.values());
}

function compactUnique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}
