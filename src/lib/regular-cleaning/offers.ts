import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

export async function acceptCleanerOffer(
  supabase: Supabase,
  input: { offerId: string; cleanerId: string },
) {
  const offer = await loadOfferForCleaner(supabase, input.offerId, input.cleanerId);

  if (offer.status === "accepted") {
    return offer;
  }

  if (offer.status !== "offered") {
    throw new Error("Only open cleaner offers can be accepted.");
  }

  const acceptedAt = new Date().toISOString();
  const updateResult = await supabase
    .from("booking_cleaners")
    .update({
      status: "accepted",
      accepted_at: acceptedAt,
      declined_at: null,
      decline_reason: null,
    })
    .eq("id", offer.id)
    .select("*")
    .single();

  if (updateResult.error) throw updateResult.error;

  await syncBookingAssignmentAfterAccept(supabase, offer.booking_id, input.cleanerId);
  return updateResult.data;
}

export async function declineCleanerOffer(
  supabase: Supabase,
  input: { offerId: string; cleanerId: string; reason?: string | null },
) {
  const offer = await loadOfferForCleaner(supabase, input.offerId, input.cleanerId);

  if (offer.status === "declined") {
    return offer;
  }

  if (offer.status !== "offered") {
    throw new Error("Only open cleaner offers can be declined.");
  }

  const declinedAt = new Date().toISOString();
  const updateResult = await supabase
    .from("booking_cleaners")
    .update({
      status: "declined",
      declined_at: declinedAt,
      decline_reason: input.reason?.trim() || null,
    })
    .eq("id", offer.id)
    .select("*")
    .single();

  if (updateResult.error) throw updateResult.error;

  await markBookingForAdminReassignment(supabase, offer.booking_id);
  return updateResult.data;
}

export async function startCleanerJob(
  supabase: Supabase,
  input: { offerId: string; cleanerId: string },
) {
  const offer = await loadOfferForCleaner(supabase, input.offerId, input.cleanerId);

  if (offer.status === "in_progress") {
    return offer;
  }

  if (offer.status !== "accepted") {
    throw new Error("Only accepted cleaner jobs can be started.");
  }

  const startedAt = new Date().toISOString();
  const updateResult = await supabase
    .from("booking_cleaners")
    .update({
      status: "in_progress",
      started_at: startedAt,
    })
    .eq("id", offer.id)
    .select("*")
    .single();

  if (updateResult.error) throw updateResult.error;

  await syncBookingJobProgress(supabase, offer.booking_id, "in_progress");
  return updateResult.data;
}

export async function completeCleanerJob(
  supabase: Supabase,
  input: { offerId: string; cleanerId: string },
) {
  const offer = await loadOfferForCleaner(supabase, input.offerId, input.cleanerId);

  if (offer.status === "completed") {
    return offer;
  }

  if (offer.status !== "in_progress") {
    throw new Error("Only in-progress cleaner jobs can be completed.");
  }

  const completedAt = new Date().toISOString();
  const updateResult = await supabase
    .from("booking_cleaners")
    .update({
      status: "completed",
      completed_at: completedAt,
    })
    .eq("id", offer.id)
    .select("*")
    .single();

  if (updateResult.error) throw updateResult.error;

  await syncBookingCompletionAfterCleanerComplete(supabase, offer.booking_id);
  return updateResult.data;
}

async function loadOfferForCleaner(supabase: Supabase, offerId: string, cleanerId: string) {
  const result = await supabase
    .from("booking_cleaners")
    .select("*")
    .eq("id", offerId)
    .single();

  if (result.error) throw result.error;
  if (result.data.cleaner_id !== cleanerId) {
    throw new Error("This offer does not belong to the selected cleaner.");
  }

  return result.data;
}

async function syncBookingAssignmentAfterAccept(supabase: Supabase, bookingId: string, cleanerId: string) {
  const [bookingResult, acceptedResult] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", bookingId).single(),
    supabase.from("booking_cleaners").select("*").eq("booking_id", bookingId).eq("status", "accepted"),
  ]);

  if (bookingResult.error) throw bookingResult.error;
  if (acceptedResult.error) throw acceptedResult.error;

  const acceptedCount = acceptedResult.data?.length ?? 0;
  const bookingStatus = acceptedCount >= bookingResult.data.cleaner_count ? "assigned" : bookingResult.data.booking_status;
  const updateResult = await supabase
    .from("bookings")
    .update({
      selected_cleaner_id: bookingResult.data.selected_cleaner_id ?? cleanerId,
      booking_status: bookingStatus,
    })
    .eq("id", bookingId);

  if (updateResult.error) throw updateResult.error;
}

async function syncBookingJobProgress(supabase: Supabase, bookingId: string, bookingStatus: string) {
  const updateResult = await supabase
    .from("bookings")
    .update({ booking_status: bookingStatus })
    .eq("id", bookingId)
    .in("booking_status", ["assigned", "in_progress"]);

  if (updateResult.error) throw updateResult.error;
}

async function syncBookingCompletionAfterCleanerComplete(supabase: Supabase, bookingId: string) {
  const [bookingResult, completedResult] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", bookingId).single(),
    supabase.from("booking_cleaners").select("*").eq("booking_id", bookingId).eq("status", "completed"),
  ]);

  if (bookingResult.error) throw bookingResult.error;
  if (completedResult.error) throw completedResult.error;

  const completedCount = completedResult.data?.length ?? 0;
  if (completedCount < bookingResult.data.cleaner_count) {
    return;
  }

  const updateResult = await supabase
    .from("bookings")
    .update({ booking_status: "completed" })
    .eq("id", bookingId);

  if (updateResult.error) throw updateResult.error;
}

async function markBookingForAdminReassignment(supabase: Supabase, bookingId: string) {
  const [bookingResult, activeOffersResult, adminRowsResult] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", bookingId).single(),
    supabase
      .from("booking_cleaners")
      .select("*")
      .eq("booking_id", bookingId)
      .in("status", ["offered", "accepted"]),
    supabase
      .from("booking_cleaners")
      .select("*")
      .eq("booking_id", bookingId)
      .eq("status", "admin_reassignment"),
  ]);

  if (bookingResult.error) throw bookingResult.error;
  if (activeOffersResult.error) throw activeOffersResult.error;
  if (adminRowsResult.error) throw adminRowsResult.error;

  const acceptedCount = (activeOffersResult.data ?? []).filter((offer) => offer.status === "accepted").length;
  const needsAdmin = acceptedCount < bookingResult.data.cleaner_count;

  if (!needsAdmin || (adminRowsResult.data?.length ?? 0) > 0) {
    return;
  }

  const insertResult = await supabase.from("booking_cleaners").insert({
    booking_id: bookingId,
    cleaner_id: null,
    cleaner_count: bookingResult.data.cleaner_count,
    is_preferred: Boolean(bookingResult.data.selected_cleaner_id),
    status: "admin_reassignment",
  });

  if (insertResult.error) throw insertResult.error;
}
