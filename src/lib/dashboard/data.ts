import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type BookingAddonRow = Database["public"]["Tables"]["booking_addons"]["Row"];
type BookingEquipmentRow = Database["public"]["Tables"]["booking_equipment"]["Row"];
type BookingCleanerRow = Database["public"]["Tables"]["booking_cleaners"]["Row"];
type CleanerRow = Database["public"]["Tables"]["cleaners"]["Row"];
type RecurringSeriesRow = Database["public"]["Tables"]["booking_recurring_series"]["Row"];

export type DashboardBooking = BookingRow & {
  customer: CustomerRow | null;
  addons: BookingAddonRow[];
  equipment: BookingEquipmentRow | null;
  cleanerRequest: BookingCleanerRow | null;
  cleanerRequests: BookingCleanerRow[];
  selectedCleaner: CleanerRow | null;
  payment: PaymentRow | null;
  recurringSeries: RecurringSeriesRow | null;
};

export type CleanerDashboardJob = {
  booking: DashboardBooking;
  offer: BookingCleanerRow;
  cleaner: CleanerRow | null;
  safeAddress: string | null;
  safeNotes: string | null;
};

export type CustomerBookingListItem = {
  key: string;
  isRecurring: boolean;
  detailBooking: DashboardBooking;
  nextBooking: DashboardBooking;
  bookings: DashboardBooking[];
  recurringSeries: RecurringSeriesRow | null;
  payment: PaymentRow | null;
  visitCount: number;
  perVisitTotalCents: number;
  totalPaidCents: number;
  paymentStatus: string;
  bookingStatus: string;
};

export async function loadCustomerDashboard({
  bookingId,
  customerAuthUserId,
  customerEmail,
}: {
  bookingId?: string | null;
  customerAuthUserId?: string | null;
  customerEmail?: string | null;
}) {
  return loadCustomerBookingDetail({ bookingId, customerAuthUserId, customerEmail });
}

export async function loadCustomerBookingDetail({
  bookingId,
  customerAuthUserId,
  customerEmail,
}: {
  bookingId?: string | null;
  customerAuthUserId?: string | null;
  customerEmail?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const customerId = customerAuthUserId
    ? await loadCustomerIdForSession(supabase, customerAuthUserId, customerEmail)
    : null;
  if (customerAuthUserId && !customerId) {
    return { booking: null };
  }

  const booking = bookingId
    ? await loadBookingById(supabase, bookingId, customerId)
    : await loadLatestBooking(supabase, customerId);

  if (!booking) {
    return { booking: null };
  }

  const [hydrated] = await hydrateBookings(supabase, [booking]);

  return { booking: hydrated ?? null };
}

export async function loadCustomerBookingsList({
  customerAuthUserId,
  customerEmail,
}: {
  customerAuthUserId?: string | null;
  customerEmail?: string | null;
} = {}) {
  const supabase = createSupabaseAdminClient();
  const customerId = customerAuthUserId
    ? await loadCustomerIdForSession(supabase, customerAuthUserId, customerEmail)
    : null;
  if (customerAuthUserId && !customerId) {
    return { items: [] };
  }

  const bookings = await loadRecentRegularBookings(supabase, 200, customerId);
  const hydrated = await hydrateBookings(supabase, bookings);

  return {
    items: groupCustomerBookings(hydrated),
  };
}

export async function loadCleanerDashboard({ cleanerId }: { cleanerId?: string | null } = {}) {
  const supabase = createSupabaseAdminClient();
  const normalizedCleanerId = cleanerId && isUuid(cleanerId) ? cleanerId : null;
  const cleanersResult = await supabase
    .from("cleaners")
    .select("*")
    .contains("service_slugs", ["regular-cleaning"])
    .eq("active", true)
    .order("display_name");

  if (cleanersResult.error) throw cleanersResult.error;

  const allCleaners = cleanersResult.data ?? [];
  const requestedCleaner = normalizedCleanerId
    ? allCleaners.find((cleaner) => cleaner.id === normalizedCleanerId) ?? null
    : null;
  const selectedCleaner = requestedCleaner ?? (!cleanerId ? await resolveAutoSelectedCleaner(supabase, allCleaners) : null);
  const validCleanerId = selectedCleaner?.id ?? null;
  logCleanerDashboardDebug("CLEANER_DASHBOARD_CONTEXT", {
    requestedCleanerId: cleanerId ?? null,
    normalizedCleanerId,
    resolvedCleanerId: validCleanerId,
  });
  const offerRows = await loadCleanerOfferRows(supabase, validCleanerId);
  const bookings = offerRows.length > 0
    ? await loadBookingsByIds(supabase, compactUnique(offerRows.map((offer) => offer.booking_id)))
    : [];
  const hydrated = await hydrateBookings(supabase, bookings);
  logCleanerDashboardDebug("CLEANER_DASHBOARD_BOOKINGS", {
    resolvedCleanerId: validCleanerId,
    offerRows: offerRows.map((offer) => ({
      id: offer.id,
      booking_id: offer.booking_id,
      cleaner_id: offer.cleaner_id,
      status: offer.status,
      is_preferred: offer.is_preferred,
    })),
    bookingIds: hydrated.map((booking) => booking.id),
  });
  const offerCleaners = await selectCleanersByIds(supabase, compactUnique(offerRows.map((offer) => offer.cleaner_id)));
  const jobs = offerRows
    .map((offer) => {
      const booking = hydrated.find((item) => item.id === offer.booking_id);
      if (!booking) {
        return null;
      }

      const addressVisible = ["accepted", "in_progress", "completed"].includes(offer.status);

      return {
        booking,
        offer,
        cleaner: offerCleaners.find((cleaner) => cleaner.id === offer.cleaner_id) ?? null,
        safeAddress: addressVisible ? booking.address : null,
        safeNotes: addressVisible ? booking.access_notes : null,
      } satisfies CleanerDashboardJob;
    })
    .filter((job): job is CleanerDashboardJob => Boolean(job));

  const offers = jobs.filter((job) => job.offer.status === "offered");
  const upcomingJobs = jobs.filter((job) => isUpcomingCleanerJob(job));
  const inProgressJobs = jobs.filter((job) => job.offer.status === "in_progress");
  const completedJobs = jobs.filter((job) => job.offer.status === "completed");
  const activeJobs = [...upcomingJobs, ...inProgressJobs];
  const today = new Date().toISOString().slice(0, 10);
  const todaysEarningsCents = jobs
    .filter((job) => job.booking.booking_date === today && ["accepted", "in_progress", "completed"].includes(job.offer.status))
    .reduce((total, job) => total + (job.offer.earning_cents ?? 0), 0);
  const verification = selectedCleaner
    ? [
      {
        label: "Availability status",
        value: !selectedCleaner.active ? "Offline" : selectedCleaner.available ? "Online" : "Offline",
      },
      { label: "Equipment eligible", value: selectedCleaner.equipment_eligible ? "Yes" : "No" },
      { label: "Service areas", value: `${selectedCleaner.suburbs.length}` },
      { label: "Rating", value: selectedCleaner.rating > 0 ? `${selectedCleaner.rating.toFixed(1)} / 5` : "New cleaner" },
      { label: "Tenure", value: `${selectedCleaner.tenure_months} month${selectedCleaner.tenure_months === 1 ? "" : "s"}` },
      { label: "Payout verification", value: selectedCleaner.auth_user_id && selectedCleaner.auth_email ? "Verified" : "Action needed" },
    ]
    : [];

  return {
    cleanerId: validCleanerId,
    requestedCleanerId: cleanerId ?? null,
    selectedCleaner,
    allCleaners,
    offers,
    upcomingJobs,
    inProgressJobs,
    completedJobs,
    activeJobs,
    todaysEarningsCents,
    verification,
  };
}

async function resolveAutoSelectedCleaner(supabase: Supabase, cleaners: CleanerRow[]) {
  if (cleaners.length === 0) {
    return null;
  }

  const urgentRowsResult = await supabase
    .from("booking_cleaners")
    .select("*")
    .in("cleaner_id", cleaners.map((cleaner) => cleaner.id))
    .in("status", ["in_progress", "offered", "accepted"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (urgentRowsResult.error) throw urgentRowsResult.error;

  const priority = new Map([
    ["in_progress", 0],
    ["accepted", 1],
    ["offered", 2],
  ]);
  const urgentRow = (urgentRowsResult.data ?? [])
    .toSorted((left, right) => (priority.get(left.status) ?? 99) - (priority.get(right.status) ?? 99))
    .find((row) => row.cleaner_id);
  const urgentCleaner = cleaners.find((cleaner) => cleaner.id === urgentRow?.cleaner_id);

  return urgentCleaner ?? cleaners.find((cleaner) => cleaner.available) ?? cleaners[0] ?? null;
}

export async function loadAdminDashboard() {
  const supabase = createSupabaseAdminClient();
  const bookings = await loadRecentRegularBookings(supabase, 100);
  const hydrated = await hydrateBookings(supabase, bookings);
  const paymentsResult = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (paymentsResult.error) throw paymentsResult.error;

  const payments = paymentsResult.data ?? [];
  const openBookings = hydrated.filter((booking) => !["completed", "cancelled"].includes(booking.booking_status));
  const assignmentReady = hydrated.filter((booking) => booking.payment_status === "paid" && booking.booking_status === "confirmed" && needsAssignment(booking));
  const paidBookings = hydrated.filter((booking) => booking.payment_status === "paid");
  const payoutReadyCents = paidBookings.reduce(
    (total, booking) => total + booking.cleanerRequests.reduce((sum, request) => sum + (request.earning_cents ?? 0), 0),
    0,
  );
  const addonRevenueCents = hydrated.flatMap((booking) => booking.addons).reduce((total, addOn) => total + addOn.price_cents, 0);
  const equipmentRequests = hydrated.filter((booking) => booking.equipment?.equipment_key === "with_equipment").length;
  const preferredCleaners = hydrated.filter((booking) => booking.selected_cleaner_id || booking.cleanerRequest?.is_preferred).length;
  const autoAssignments = hydrated.filter((booking) => !booking.selected_cleaner_id && !booking.cleanerRequest?.cleaner_id).length;

  return {
    stats: {
      openBookings: openBookings.length,
      needsAssignment: assignmentReady.length,
      payoutReadyCents,
      paymentEvents: payments.length,
    },
    metrics: {
      addonRevenueCents,
      topAddons: summarizeLabels(hydrated.flatMap((booking) => booking.addons.map((addOn) => addOn.label))),
      equipmentRequests,
      preferredCleaners,
      autoAssignments,
    },
    bookings: hydrated,
    recentBookings: hydrated.slice(0, 6),
    recentPayments: payments.slice(0, 6),
    declinedOffers: hydrated.flatMap((booking) => booking.cleanerRequests.filter((request) => request.status === "declined")),
    acceptedOffers: hydrated.flatMap((booking) => booking.cleanerRequests.filter((request) => request.status === "accepted")),
  };
}

async function loadBookingById(supabase: Supabase, bookingId: string, customerId?: string | null) {
  let query = supabase.from("bookings").select("*").eq("id", bookingId);
  if (customerId) {
    query = query.eq("customer_id", customerId);
  }

  const result = await query.maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

async function loadLatestBooking(supabase: Supabase, customerId?: string | null) {
  let query = supabase
    .from("bookings")
    .select("*")
    .eq("service_slug", "regular-cleaning")
    .order("created_at", { ascending: false })
    .limit(1);

  if (customerId) {
    query = query.eq("customer_id", customerId);
  }

  const result = await query.maybeSingle();

  if (result.error) throw result.error;
  return result.data;
}

async function loadRecentRegularBookings(supabase: Supabase, limit: number, customerId?: string | null) {
  let query = supabase
    .from("bookings")
    .select("*")
    .eq("service_slug", "regular-cleaning")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (customerId) {
    query = query.eq("customer_id", customerId);
  }

  const result = await query;

  if (result.error) throw result.error;
  return result.data ?? [];
}

async function loadCustomerIdForSession(
  supabase: Supabase,
  authUserId: string,
  customerEmail?: string | null,
) {
  const byAuthUserResult = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (byAuthUserResult.error) throw byAuthUserResult.error;
  if (byAuthUserResult.data?.id) {
    return byAuthUserResult.data.id;
  }

  const normalizedEmail = customerEmail?.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const byEmailResult = await supabase
    .from("customers")
    .select("id, auth_user_id")
    .eq("email_normalized", normalizedEmail)
    .maybeSingle();
  if (byEmailResult.error) throw byEmailResult.error;

  if (!byEmailResult.data?.id) {
    return null;
  }

  if (!byEmailResult.data.auth_user_id) {
    const attachAuthResult = await supabase
      .from("customers")
      .update({ auth_user_id: authUserId })
      .eq("id", byEmailResult.data.id);
    if (attachAuthResult.error) throw attachAuthResult.error;
  }

  return byEmailResult.data.id;
}

async function loadBookingsByIds(supabase: Supabase, bookingIds: string[]) {
  if (bookingIds.length === 0) {
    return [];
  }

  const result = await supabase
    .from("bookings")
    .select("*")
    .in("id", bookingIds)
    .eq("service_slug", "regular-cleaning");

  if (result.error) throw result.error;
  return result.data ?? [];
}

async function loadCleanerOfferRows(supabase: Supabase, cleanerId?: string | null) {
  if (cleanerId === null) {
    return [];
  }

  let query = supabase
    .from("booking_cleaners")
    .select("*")
    .in("status", ["pending_payment", "offered", "accepted", "in_progress", "completed"])
    .order("created_at", { ascending: false })
    .limit(80);

  if (cleanerId) {
    query = query.eq("cleaner_id", cleanerId);
  } else {
    query = query.not("cleaner_id", "is", null);
  }

  const result = await query;
  if (result.error) throw result.error;

  return result.data ?? [];
}

async function hydrateBookings(supabase: Supabase, bookings: BookingRow[]): Promise<DashboardBooking[]> {
  if (bookings.length === 0) {
    return [];
  }

  const bookingIds = bookings.map((booking) => booking.id);
  const customerIds = compactUnique(bookings.map((booking) => booking.customer_id));
  const selectedCleanerIds = compactUnique(bookings.map((booking) => booking.selected_cleaner_id));
  const recurringSeriesIds = compactUnique(bookings.map((booking) => booking.recurring_series_id));

  const [customers, addons, equipment, cleanerRequests, payments] = await Promise.all([
    selectCustomersByIds(supabase, customerIds),
    selectBookingAddons(supabase, bookingIds),
    selectBookingEquipment(supabase, bookingIds),
    selectBookingCleaners(supabase, bookingIds),
    selectPayments(supabase, bookingIds),
  ]);
  const recurringSeries = await selectRecurringSeriesByIds(supabase, recurringSeriesIds);

  const cleanerIds = compactUnique([
    ...selectedCleanerIds,
    ...cleanerRequests.map((request) => request.cleaner_id),
  ]);
  const cleaners = await selectCleanersByIds(supabase, cleanerIds);

  return bookings.map((booking) => {
    const bookingCleanerRequests = cleanerRequests.filter((request) => request.booking_id === booking.id);
    const cleanerRequest = bookingCleanerRequests.find((request) => request.status === "accepted") ??
      bookingCleanerRequests.find((request) => request.status === "offered" && request.is_preferred) ??
      bookingCleanerRequests.find((request) => request.is_preferred) ??
      bookingCleanerRequests[0] ??
      null;
    const cleanerId = booking.selected_cleaner_id ?? cleanerRequest?.cleaner_id ?? null;

    return {
      ...booking,
      customer: customers.find((customer) => customer.id === booking.customer_id) ?? null,
      addons: addons.filter((addon) => addon.booking_id === booking.id),
      equipment: equipment.find((item) => item.booking_id === booking.id) ?? null,
      cleanerRequest,
      cleanerRequests: bookingCleanerRequests,
      selectedCleaner: cleaners.find((cleaner) => cleaner.id === cleanerId) ?? null,
      payment: payments.find((payment) => payment.booking_id === booking.id) ?? null,
      recurringSeries: recurringSeries.find((series) => series.id === booking.recurring_series_id) ?? null,
    };
  });
}

async function selectCustomersByIds(supabase: Supabase, ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const result = await supabase.from("customers").select("*").in("id", ids);
  if (result.error) throw result.error;

  return result.data ?? [];
}

async function selectCleanersByIds(supabase: Supabase, ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const result = await supabase.from("cleaners").select("*").in("id", ids);
  if (result.error) throw result.error;

  return result.data ?? [];
}

async function selectBookingAddons(supabase: Supabase, bookingIds: string[]) {
  if (bookingIds.length === 0) {
    return [];
  }

  const result = await supabase.from("booking_addons").select("*").in("booking_id", bookingIds);
  if (result.error) throw result.error;

  return result.data ?? [];
}

async function selectBookingEquipment(supabase: Supabase, bookingIds: string[]) {
  if (bookingIds.length === 0) {
    return [];
  }

  const result = await supabase.from("booking_equipment").select("*").in("booking_id", bookingIds);
  if (result.error) throw result.error;

  return result.data ?? [];
}

async function selectBookingCleaners(supabase: Supabase, bookingIds: string[]) {
  if (bookingIds.length === 0) {
    return [];
  }

  const result = await supabase
    .from("booking_cleaners")
    .select("*")
    .in("booking_id", bookingIds)
    .order("created_at", { ascending: true });
  if (result.error) throw result.error;

  return result.data ?? [];
}

async function selectPayments(supabase: Supabase, bookingIds: string[]) {
  if (bookingIds.length === 0) {
    return [];
  }

  const result = await supabase.from("payments").select("*").in("booking_id", bookingIds);
  if (result.error) throw result.error;

  return result.data ?? [];
}

async function selectRecurringSeriesByIds(supabase: Supabase, ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const result = await supabase.from("booking_recurring_series").select("*").in("id", ids);
  if (result.error) throw result.error;

  return result.data ?? [];
}

function compactUnique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function summarizeLabels(labels: string[]) {
  const counts = new Map<string, number>();

  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label]) => label);
}

function needsAssignment(booking: DashboardBooking) {
  const acceptedCount = booking.cleanerRequests.filter((request) => request.status === "accepted").length;
  const offeredCount = booking.cleanerRequests.filter((request) => request.status === "offered").length;
  const adminReassignment = booking.cleanerRequests.some((request) => request.status === "admin_reassignment");

  return acceptedCount < booking.cleaner_count && (offeredCount === 0 || adminReassignment);
}

function groupCustomerBookings(bookings: DashboardBooking[]): CustomerBookingListItem[] {
  const groups = new Map<string, DashboardBooking[]>();

  for (const booking of bookings) {
    const key = booking.recurring_series_id ?? booking.id;
    groups.set(key, [...(groups.get(key) ?? []), booking]);
  }

  return Array.from(groups.entries())
    .map(([key, groupBookings]) => {
      const sortedBookings = groupBookings.toSorted(compareBookingsByDate);
      const detailBooking =
        sortedBookings.find((booking) => Boolean(booking.payment)) ??
        sortedBookings.find((booking) => booking.occurrence_index === 1) ??
        sortedBookings[0];
      const nextBooking = resolveNextBooking(sortedBookings);
      const recurringSeries = detailBooking.recurringSeries;
      const payment = sortedBookings.find((booking) => Boolean(booking.payment))?.payment ?? detailBooking.payment;
      const isRecurring = Boolean(detailBooking.recurring_series_id);

      return {
        key,
        isRecurring,
        detailBooking,
        nextBooking,
        bookings: sortedBookings,
        recurringSeries,
        payment,
        visitCount: recurringSeries?.occurrence_count ?? sortedBookings.length,
        perVisitTotalCents: recurringSeries?.per_occurrence_total_cents ?? detailBooking.final_total_cents,
        totalPaidCents:
          payment?.amount_cents ??
          recurringSeries?.series_total_cents ??
          detailBooking.series_total_cents ??
          detailBooking.final_total_cents,
        paymentStatus: payment?.status ?? detailBooking.payment_status,
        bookingStatus: detailBooking.booking_status,
      } satisfies CustomerBookingListItem;
    })
    .toSorted((left, right) => compareBookingsByDate(right.nextBooking, left.nextBooking));
}

function resolveNextBooking(bookings: DashboardBooking[]) {
  const today = new Date().toISOString().slice(0, 10);
  return bookings.find((booking) => booking.booking_date >= today) ?? bookings.at(-1) ?? bookings[0];
}

function compareBookingsByDate(left: BookingRow, right: BookingRow) {
  const leftKey = `${left.booking_date} ${left.booking_time}`;
  const rightKey = `${right.booking_date} ${right.booking_time}`;

  return leftKey.localeCompare(rightKey);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isUpcomingCleanerJob(job: CleanerDashboardJob) {
  if (job.offer.status === "accepted") {
    return true;
  }

  return job.offer.status === "pending_payment" &&
    job.booking.payment_status === "paid" &&
    job.booking.selected_cleaner_id === job.offer.cleaner_id;
}

function logCleanerDashboardDebug(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info(event, payload);
}
