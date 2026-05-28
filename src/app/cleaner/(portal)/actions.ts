"use server";

import { redirect } from "next/navigation";
import { cleanerEmailFromPhone, validateCleanerPhone } from "@/lib/auth/cleaner";
import { requireCleanerSession } from "@/lib/auth/server";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  acceptCleanerOffer,
  completeCleanerJob,
  declineCleanerOffer,
  startCleanerJob,
} from "@/lib/regular-cleaning/offers";

type CleanerUpdate = Database["public"]["Tables"]["cleaners"]["Update"];

const cleanerProfileImageBucket = "cleaner-profile-images";

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

export async function updateCleanerProfileAction(formData: FormData) {
  let redirectTarget = buildProfileRedirect("success", "Profile details updated.");

  try {
    const { cleaner } = await requireCleanerSession();
    const admin = createSupabaseAdminClient();
    const phone = validateCleanerPhone(String(formData.get("phone") ?? ""));
    const serviceAreas = parseServiceAreas(String(formData.get("serviceAreas") ?? ""));
    const photoUrl = String(formData.get("photoUrl") ?? "").trim();
    const photoFile = formData.get("photoFile");
    const updates: CleanerUpdate = {
      phone,
      suburbs: serviceAreas,
      photo_url: photoUrl || cleaner.photo_url,
    };

    if (phone !== cleaner.phone && cleaner.auth_user_id) {
      const authEmail = cleanerEmailFromPhone(phone);
      const authUpdateResult = await admin.auth.admin.updateUserById(cleaner.auth_user_id, { email: authEmail });
      if (authUpdateResult.error) {
        throw authUpdateResult.error;
      }
      updates.auth_email = authEmail;
    }

    if (photoFile instanceof File && photoFile.size > 0) {
      if (!photoFile.type.startsWith("image/")) {
        throw new Error("Only image files are supported for profile photos.");
      }
      if (photoFile.size > 2 * 1024 * 1024) {
        throw new Error("Profile photo must be 2MB or smaller.");
      }
      updates.photo_url = await uploadCleanerProfileImage({
        cleanerId: cleaner.id,
        file: photoFile,
      });
    }

    const updateResult = await admin
      .from("cleaners")
      .update(updates)
      .eq("id", cleaner.id);

    if (updateResult.error) {
      throw updateResult.error;
    }
  } catch (error) {
    redirectTarget = buildProfileRedirect("error", toErrorMessage(error));
  }

  redirect(redirectTarget);
}

export async function updateCleanerAvailabilityAction(formData: FormData) {
  let redirectTarget = buildProfileRedirect("success", "Status updated.");

  try {
    const { cleaner } = await requireCleanerSession();
    const availabilityMode = String(formData.get("availability") ?? "");
    const availability = availabilityMode === "online" || availabilityMode === "available";
    const admin = createSupabaseAdminClient();
    const result = await admin
      .from("cleaners")
      .update({ available: availability })
      .eq("id", cleaner.id);

    if (result.error) {
      throw result.error;
    }

    const message = availability
      ? "Status updated to Online. You can receive new offers."
      : "Status updated to Offline. You are not receiving new offers.";
    redirectTarget = buildProfileRedirect("success", message);
  } catch (error) {
    redirectTarget = buildProfileRedirect("error", toErrorMessage(error));
  }

  redirect(redirectTarget);
}

export async function updateCleanerPasswordAction(formData: FormData) {
  let redirectTarget = buildProfileRedirect("success", "Password updated successfully.");

  try {
    const { cleaner } = await requireCleanerSession();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    if (password !== confirmPassword) {
      throw new Error("Password confirmation does not match.");
    }
    if (!cleaner.auth_user_id) {
      throw new Error("Cleaner account is missing an auth user.");
    }

    const admin = createSupabaseAdminClient();
    const updateResult = await admin.auth.admin.updateUserById(cleaner.auth_user_id, { password });
    if (updateResult.error) {
      throw updateResult.error;
    }
  } catch (error) {
    redirectTarget = buildProfileRedirect("error", toErrorMessage(error));
  }

  redirect(redirectTarget);
}

async function uploadCleanerProfileImage({
  cleanerId,
  file,
}: {
  cleanerId: string;
  file: File;
}) {
  const admin = createSupabaseAdminClient();
  const extension = resolveFileExtension(file);
  const path = `${cleanerId}/${Date.now()}.${extension}`;

  let uploadResult = await admin.storage
    .from(cleanerProfileImageBucket)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });

  if (uploadResult.error && /bucket/i.test(uploadResult.error.message) && /not found/i.test(uploadResult.error.message)) {
    const bucketResult = await admin.storage.createBucket(cleanerProfileImageBucket, { public: true });
    if (bucketResult.error && !/already exists/i.test(bucketResult.error.message)) {
      throw bucketResult.error;
    }

    uploadResult = await admin.storage
      .from(cleanerProfileImageBucket)
      .upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
        cacheControl: "3600",
      });
  }

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  return admin.storage.from(cleanerProfileImageBucket).getPublicUrl(path).data.publicUrl;
}

function parseServiceAreas(rawAreas: string) {
  return Array.from(
    new Set(
      rawAreas
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function resolveFileExtension(file: File) {
  const fromMime = file.type.split("/")[1];
  if (fromMime) {
    return fromMime;
  }
  return "jpg";
}

function buildProfileRedirect(status: "success" | "error", message: string) {
  const params = new URLSearchParams({ status, message });
  return `/cleaner/profile?${params.toString()}`;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to save changes right now. Please try again.";
}
