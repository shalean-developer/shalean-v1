import { REGULAR_CLEANING_SLUG } from "@/lib/regular-cleaning/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export type CleanerRow = Database["public"]["Tables"]["cleaners"]["Row"];
export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
export type AddonRow = Database["public"]["Tables"]["service_addons"]["Row"];
export type EquipmentRow = Database["public"]["Tables"]["service_equipment_options"]["Row"];
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

export async function loadAdminManagementData() {
  const supabase = createSupabaseAdminClient();
  const [cleanersResult, customersResult, addonsResult, equipmentResult] = await Promise.all([
    supabase.from("cleaners").select("*").order("display_name"),
    supabase.from("customers").select("*").order("full_name"),
    supabase.from("service_addons").select("*").eq("service_slug", REGULAR_CLEANING_SLUG).eq("active", true).order("sort_order"),
    supabase.from("service_equipment_options").select("*").eq("service_slug", REGULAR_CLEANING_SLUG).eq("active", true).order("sort_order"),
  ]);

  if (cleanersResult.error) throw cleanersResult.error;
  if (customersResult.error) throw customersResult.error;
  if (addonsResult.error) throw addonsResult.error;
  if (equipmentResult.error) throw equipmentResult.error;

  return {
    cleaners: cleanersResult.data ?? [],
    customers: customersResult.data ?? [],
    addons: addonsResult.data ?? [],
    equipmentOptions: equipmentResult.data ?? [],
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
