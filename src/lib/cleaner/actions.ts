"use server";

import { redirect } from "next/navigation";
import { clearCleanerSession, requireCleanerSession } from "@/lib/auth/server";
import { updateCleanerAvailability } from "@/lib/cleaner/availability";
import {
  acceptCleanerOffer,
  completeCleanerJob,
  declineCleanerOffer,
  startCleanerJob,
} from "@/lib/regular-cleaning/offers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function acceptOfferAction(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "");
  const { cleaner } = await requireCleanerSession();
  await acceptCleanerOffer(createSupabaseAdminClient(), { offerId, cleanerId: cleaner.id });
  redirect("/cleaner");
}

export async function declineOfferAction(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "");
  const { cleaner } = await requireCleanerSession();
  await declineCleanerOffer(createSupabaseAdminClient(), { offerId, cleanerId: cleaner.id });
  redirect("/cleaner");
}

export async function startJobAction(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "");
  const { cleaner } = await requireCleanerSession();
  await startCleanerJob(createSupabaseAdminClient(), { offerId, cleanerId: cleaner.id });
  redirect("/cleaner");
}

export async function completeJobAction(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "");
  const { cleaner } = await requireCleanerSession();
  await completeCleanerJob(createSupabaseAdminClient(), { offerId, cleanerId: cleaner.id });
  redirect("/cleaner");
}

export async function toggleAvailabilityAction(formData: FormData) {
  const available = formData.get("available") === "true";
  const { cleaner } = await requireCleanerSession();
  await updateCleanerAvailability(createSupabaseAdminClient(), {
    cleanerId: cleaner.id,
    available,
  });
  redirect(formData.get("returnTo")?.toString() || "/cleaner");
}

export async function cleanerLogoutAction() {
  await clearCleanerSession();
  redirect("/cleaner/login");
}
