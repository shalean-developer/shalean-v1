"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/server";
import { cleanerStatusToFlags } from "@/lib/admin/cleaner-status";
import {
  boolValue,
  cleanerEmailFromPhone,
  csvList,
  intValue,
  normalizeAdminCleanerPhone,
  optionalString,
  requiredString,
  validateEmail,
  validatePhone,
  weekdayList,
  weekdayFromDate,
} from "@/lib/admin/utils";
import { upsertCustomerIdentity } from "@/lib/customers/identity";
import { notifyCustomerRegistered } from "@/lib/notifications/triggers";
import { createRegularCleaningBooking, PreferredCleanerUnavailableError } from "@/lib/regular-cleaning/repository";
import type { RegularCleaningBookingInput } from "@/lib/regular-cleaning/types";
import { REGULAR_CLEANING_SLUG } from "@/lib/regular-cleaning/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { syncBookingToZohoBooks } from "@/lib/zoho/books";
import {
  checkBookingPaymentStatus,
  createUnpaidInvoiceForBooking,
  ensurePaystackPaymentLink,
  isAdminPaymentMethod,
  markBookingPaidManually,
  markBookingUnpaid,
  provisionAdminBookingBilling,
  recordManualBookingPayment,
  sendPaymentLinkToCustomer,
  voidBookingInvoice,
  type AdminPaymentMethod,
} from "@/lib/admin/billing";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;
type AdminRole = "customer" | "cleaner" | "admin";
const AUTO_ASSIGN_SENTINEL = "__auto_assign__";

export type PricingUpdateState = {
  ok?: boolean;
  message?: string;
};

type PricingTable =
  | "services"
  | "pricing_rules"
  | "service_addons"
  | "service_equipment_options"
  | "cleaner_quantity_rules"
  | "recurring_pricing_rules";

export async function updatePricingAction(
  _prevState: PricingUpdateState,
  formData: FormData,
): Promise<PricingUpdateState> {
  await requireAdmin();

  try {
    const table = requiredString(formData, "table") as PricingTable;
    const id = requiredString(formData, "id");
    const active = formData.get("active") === "on";
    const supabase = createSupabaseAdminClient();

    if (table === "services") {
      const basePriceCents = randToCents(formData, "basePrice", "Base price");
      const result = await supabase
        .from("services")
        .update({
          title: requiredString(formData, "title"),
          name: requiredString(formData, "title"),
          description: optionalString(formData, "description"),
          base_price_cents: basePriceCents,
          active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (result.error) throw result.error;
    } else if (table === "pricing_rules") {
      const result = await supabase
        .from("pricing_rules")
        .update({
          name: requiredString(formData, "name"),
          description: optionalString(formData, "description"),
          price_cents: randToCents(formData, "price", "Price"),
          estimated_minutes: nonnegativeInt(formData, "estimatedMinutes", "Estimated minutes"),
          active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (result.error) throw result.error;
    } else if (table === "service_addons") {
      const result = await supabase
        .from("service_addons")
        .update({
          label: requiredString(formData, "label"),
          description: optionalString(formData, "description"),
          price_cents: randToCents(formData, "price", "Price"),
          duration_minutes: nonnegativeInt(formData, "durationMinutes", "Estimated minutes"),
          active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (result.error) throw result.error;
    } else if (table === "service_equipment_options") {
      const result = await supabase
        .from("service_equipment_options")
        .update({
          label: requiredString(formData, "label"),
          description: optionalString(formData, "description"),
          price_cents: randToCents(formData, "price", "Price"),
          active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (result.error) throw result.error;
    } else if (table === "cleaner_quantity_rules") {
      const result = await supabase
        .from("cleaner_quantity_rules")
        .update({
          extra_cleaner_price_cents: randToCents(formData, "extraCleanerPrice", "Extra cleaner price"),
          recommended_workload_minutes_per_cleaner: positiveInt(formData, "recommendedMinutes", "Recommended cleaner minutes"),
          active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (result.error) throw result.error;
    } else if (table === "recurring_pricing_rules") {
      const multiplier = nonnegativeNumber(formData, "multiplier", "Multiplier");
      const result = await supabase
        .from("recurring_pricing_rules")
        .update({
          name: requiredString(formData, "name"),
          description: optionalString(formData, "description"),
          multiplier,
          prepaid_visits: positiveInt(formData, "prepaidVisits", "Prepaid visits"),
          active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (result.error) throw result.error;
    } else {
      throw new Error("Unsupported pricing record.");
    }

    revalidatePricing();
    return { ok: true, message: "Pricing saved." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to save pricing.",
    };
  }
}

export async function createCleanerAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const supabase = createSupabaseAdminClient();
  // Support the simplified create form (first/last name) while staying
  // backward compatible with any caller that still posts fullName/displayName.
  const firstName = optionalString(formData, "firstName");
  const lastName = optionalString(formData, "lastName");
  const composedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const fullName = composedName || requiredString(formData, "fullName");
  const displayName = optionalString(formData, "displayName") ?? firstName ?? fullName;
  const phone = normalizeAdminCleanerPhone(requiredString(formData, "phone"));
  const password = requiredString(formData, "password");
  const authEmail = cleanerEmailFromPhone(phone);
  const authUserId = await ensureAuthUser(supabase, { email: authEmail, password, fullName, phone, role: "cleaner" });

  const cleanerResult = await supabase
    .from("cleaners")
    .insert({
      auth_user_id: authUserId,
      auth_email: authEmail,
      full_name: fullName,
      display_name: displayName,
      phone,
      active: true,
      available: true,
      equipment_eligible: formData.get("equipmentEligible") === "on",
      service_slugs: [REGULAR_CLEANING_SLUG],
      suburbs: csvList(formData, "suburbs"),
      created_by_admin_id: profile.id,
      password_set_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (cleanerResult.error) throw cleanerResult.error;

  revalidateAdmin();

  if (formData.get("redirectToList") === "true") {
    redirect("/admin/cleaners?success=cleaner-created");
  }
}

export async function setCleanerStatusAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const cleanerId = requiredString(formData, "cleanerId");
  const status = requiredString(formData, "status");

  if (status !== "active" && status !== "inactive" && status !== "suspended") {
    throw new Error("Unsupported cleaner status.");
  }

  const flags = cleanerStatusToFlags(status);
  const updateResult = await supabase
    .from("cleaners")
    .update({ active: flags.active, available: flags.available })
    .eq("id", cleanerId);

  if (updateResult.error) throw updateResult.error;
  revalidateAdmin();
}

export async function updateCleanerAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const cleanerId = requiredString(formData, "cleanerId");
  const fullName = requiredString(formData, "fullName");
  const displayName = requiredString(formData, "displayName");
  const phone = normalizeAdminCleanerPhone(requiredString(formData, "phone"));
  const authEmail = cleanerEmailFromPhone(phone);
  const existingResult = await supabase.from("cleaners").select("*").eq("id", cleanerId).single();

  if (existingResult.error) throw existingResult.error;

  if (existingResult.data.auth_user_id) {
    await updateAuthUser(supabase, existingResult.data.auth_user_id, { email: authEmail, fullName, phone, role: "cleaner" });
  }

  const updateResult = await supabase
    .from("cleaners")
    .update({
      auth_email: authEmail,
      full_name: fullName,
      display_name: displayName,
      phone,
      active: boolValue(formData, "active"),
      available: boolValue(formData, "available"),
      equipment_eligible: boolValue(formData, "equipmentEligible"),
      suburbs: csvList(formData, "suburbs"),
    })
    .eq("id", cleanerId);

  if (updateResult.error) throw updateResult.error;
  revalidateAdmin();
}

export async function resetCleanerPasswordAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const cleanerId = requiredString(formData, "cleanerId");
  const password = requiredString(formData, "password");
  const cleanerResult = await supabase.from("cleaners").select("*").eq("id", cleanerId).single();

  if (cleanerResult.error) throw cleanerResult.error;

  const fullName = cleanerResult.data.full_name ?? cleanerResult.data.display_name ?? "Shalean Cleaner";
  const phone = normalizeAdminCleanerPhone(requiredStringFromValue(cleanerResult.data.phone, "Cleaner phone"));
  const authEmail = cleanerEmailFromPhone(phone);
  const authUserId = cleanerResult.data.auth_user_id
    ? cleanerResult.data.auth_user_id
    : await ensureAuthUser(supabase, { email: authEmail, password, fullName, phone, role: "cleaner" });

  await updateAuthUser(supabase, authUserId, { email: authEmail, password, fullName, phone, role: "cleaner" });

  const updateResult = await supabase
    .from("cleaners")
    .update({
      auth_user_id: authUserId,
      auth_email: authEmail,
      phone,
      password_set_at: new Date().toISOString(),
    })
    .eq("id", cleanerId);

  if (updateResult.error) throw updateResult.error;
  revalidateAdmin();
}

export async function createCustomerAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const fullName = requiredString(formData, "fullName");
  const email = validateEmail(requiredString(formData, "email"));
  const phone = validatePhone(requiredString(formData, "phone"), "Customer phone");
  const password = optionalString(formData, "password");
  const authUserId = password
    ? await ensureAuthUser(supabase, { email, password, fullName, phone, role: "customer" })
    : null;

  await upsertCustomerIdentity(supabase, { authUserId, fullName, email, phone });
  await notifyCustomerRegistered(supabase, { fullName, email, phone });
  revalidateAdmin();
}

export async function updateCustomerAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const customerId = requiredString(formData, "customerId");
  const fullName = requiredString(formData, "fullName");
  const email = validateEmail(requiredString(formData, "email"));
  const phone = validatePhone(requiredString(formData, "phone"), "Customer phone");
  const authUserId = optionalString(formData, "authUserId");

  if (authUserId) {
    await updateAuthUser(supabase, authUserId, { email, fullName, phone, role: "customer" });
  }

  await upsertCustomerIdentity(supabase, { authUserId, fullName, email, phone });
  const updateResult = await supabase
    .from("customers")
    .update({ full_name: fullName, email, phone, auth_user_id: authUserId ?? null })
    .eq("id", customerId);

  if (updateResult.error) throw updateResult.error;
  revalidateAdmin();
}

export async function resetCustomerPasswordAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const customerId = requiredString(formData, "customerId");
  const password = requiredString(formData, "password");
  const customerResult = await supabase.from("customers").select("*").eq("id", customerId).single();

  if (customerResult.error) throw customerResult.error;

  const customer = customerResult.data;
  const email = validateEmail(customer.email);
  const phone = validatePhone(requiredStringFromValue(customer.phone, "Customer phone"), "Customer phone");
  const authUserId = customer.auth_user_id
    ? customer.auth_user_id
    : await ensureAuthUser(supabase, { email, password, fullName: customer.full_name, phone, role: "customer" });

  await updateAuthUser(supabase, authUserId, { email, password, fullName: customer.full_name, phone, role: "customer" });

  const updateResult = await supabase
    .from("customers")
    .update({ auth_user_id: authUserId })
    .eq("id", customerId);

  if (updateResult.error) throw updateResult.error;
  revalidateAdmin();
}

export async function createAdminBookingAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const customerId = requiredString(formData, "customerId");
  const customerResult = await supabase.from("customers").select("*").eq("id", customerId).single();

  if (customerResult.error) throw customerResult.error;

  // Stable per-submit idempotency key from the client. A double-submit replays
  // the same key, so we reuse the already-created booking instead of inserting a
  // duplicate. Falls back to a fresh UUID if the client did not supply one.
  const idempotencyKey = optionalString(formData, "idempotencyKey") ?? randomUUID();

  // If this exact submit already produced a booking, don't create another one.
  const existing = await supabase
    .from("bookings")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .order("occurrence_index", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    revalidateAdmin();
    redirect("/admin/bookings?success=booking-created");
  }

  const frequency = requiredString(formData, "frequency") as RegularCleaningBookingInput["frequency"];
  const bookingDate = requiredString(formData, "bookingDate");
  const selectedWeekdays = weekdayList(formData, "recurrenceWeekdays");
  const selectedCleanerChoice = optionalString(formData, "selectedCleanerId");
  if (!selectedCleanerChoice) {
    redirect("/admin/bookings?error=assignment-required");
  }
  const selectedCleanerId = selectedCleanerChoice === AUTO_ASSIGN_SENTINEL ? null : selectedCleanerChoice;
  const bookingInput: RegularCleaningBookingInput = {
    checkoutId: idempotencyKey,
    idempotencyKey,
    serviceSlug: REGULAR_CLEANING_SLUG,
    frequency,
    recurrenceWeekdays: frequency === "monthly"
      ? []
      : selectedWeekdays.length > 0
        ? selectedWeekdays
        : weekdayFromDate(bookingDate),
    bookingDate,
    bookingTime: requiredString(formData, "bookingTime"),
    address: requiredString(formData, "address"),
    suburb: requiredString(formData, "suburb"),
    propertyType: requiredString(formData, "propertyType"),
    bedrooms: clampInt(intValue(formData, "bedrooms"), 0, 12),
    bathrooms: clampInt(intValue(formData, "bathrooms"), 1, 12),
    extraRooms: clampInt(intValue(formData, "extraRooms"), 0, 12),
    squareMeters: 80,
    selectedAddonKeys: formData.getAll("addonKeys").map(String),
    equipmentOptionKey: requiredString(formData, "equipmentOptionKey") as RegularCleaningBookingInput["equipmentOptionKey"],
    cleanerCount: clampInt(intValue(formData, "cleanerCount"), 1, 4),
    selectedCleanerId,
    accessNotes: optionalString(formData, "accessNotes"),
    customer: {
      fullName: customerResult.data.full_name,
      email: customerResult.data.email,
      phone: customerResult.data.phone,
    },
  };

  if (selectedCleanerId) {
    await makeCleanerEligibleForAdminBooking(supabase, selectedCleanerId, bookingInput.suburb);
  }

  let bookingIds: string[] = [];
  try {
    const created = await createRegularCleaningBooking(supabase, bookingInput, customerId);
    bookingIds = created.bookingIds;
  } catch (error) {
    // A unique-constraint violation means a concurrent double-submit already
    // created this booking — treat it as success rather than a duplicate.
    if (error instanceof Error && /duplicate key|23505/.test(error.message)) {
      revalidateAdmin();
      redirect("/admin/bookings?success=booking-created");
    }
    if (error instanceof PreferredCleanerUnavailableError) {
      redirect("/admin/bookings?error=cleaner-unavailable");
    }
    if (error instanceof Error && isRegularCleaningCatalogConfigurationError(error.message)) {
      redirect("/admin/bookings?error=catalog-config");
    }
    console.error("ADMIN_BOOKING_CREATE_FAILED", error);
    redirect("/admin/bookings?error=create-failed");
  }

  // Issue an unpaid Zoho invoice + Paystack payment link for the new booking.
  // Best-effort: never blocks booking creation. Failures are visible/retryable
  // from the booking row actions.
  const provision = await provisionAdminBookingBilling(supabase, bookingIds);

  revalidateAdmin();
  const outcome = provision.invoiceStatus === "synced" && provision.paymentLinkOk
    ? "booking-billed"
    : "booking-created";
  redirect(`/admin/bookings?success=${outcome}`);
}

export async function retryZohoSyncAction(formData: FormData) {
  await requireAdmin();
  const bookingId = requiredString(formData, "bookingId");

  // Admin retry must work for unpaid admin bookings too: create/repair the
  // invoice without requiring payment, and never create a duplicate invoice.
  const result = await syncBookingToZohoBooks(bookingId, { force: true, allowUnpaid: true });

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payments");

  const status = result.status === "synced"
    ? "zoho-synced"
    : result.status === "skipped"
      ? "zoho-skipped"
      : "zoho-failed";
  redirect(`/admin/bookings?success=${status}`);
}

export async function createInvoiceAction(formData: FormData) {
  await requireAdmin();
  const bookingId = requiredString(formData, "bookingId");
  const result = await createUnpaidInvoiceForBooking(createSupabaseAdminClient(), bookingId);
  revalidatePath("/admin/bookings");
  const status = result.status === "synced"
    ? "invoice-created"
    : result.status === "skipped"
      ? "zoho-skipped"
      : "zoho-failed";
  redirect(`/admin/bookings?success=${status}`);
}

export async function sendPaymentLinkAction(formData: FormData) {
  await requireAdmin();
  const bookingId = requiredString(formData, "bookingId");
  const result = await sendPaymentLinkToCustomer(createSupabaseAdminClient(), bookingId);
  revalidatePath("/admin/bookings");
  redirect(`/admin/bookings?success=${result.ok ? "link-sent" : "link-failed"}`);
}

export async function ensurePaymentLinkAction(formData: FormData) {
  await requireAdmin();
  const bookingId = requiredString(formData, "bookingId");
  const result = await ensurePaystackPaymentLink(createSupabaseAdminClient(), bookingId);
  revalidatePath("/admin/bookings");
  redirect(`/admin/bookings?success=${result.ok ? "link-ready" : "link-failed"}`);
}

export async function checkPaymentStatusAction(formData: FormData) {
  await requireAdmin();
  const bookingId = requiredString(formData, "bookingId");
  const result = await checkBookingPaymentStatus(createSupabaseAdminClient(), bookingId);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payments");
  const status = result.reconciled ? "payment-confirmed" : result.ok ? "payment-pending" : "payment-check-failed";
  redirect(`/admin/bookings?success=${status}`);
}

export async function recordManualPaymentAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const bookingId = requiredString(formData, "bookingId");
  const methodRaw = requiredString(formData, "paymentMethod");
  if (!isAdminPaymentMethod(methodRaw)) {
    redirect("/admin/bookings?error=payment-method-invalid");
  }
  const method = methodRaw as AdminPaymentMethod;
  const amountCents = randToCents(formData, "amount", "Amount paid");
  const paymentDate = requiredString(formData, "paymentDate");
  const reference = optionalString(formData, "reference");
  const notes = optionalString(formData, "notes");
  const sendConfirmation = formData.get("sendConfirmation") === "on";

  const result = await recordManualBookingPayment(createSupabaseAdminClient(), {
    bookingId,
    adminProfileId: profile.id,
    adminName: profile.full_name ?? "Admin",
    amountCents,
    method,
    paymentDate,
    reference,
    notes,
    sendConfirmation,
  });

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payments");
  redirect(`/admin/bookings?success=${result.ok ? "payment-recorded" : "payment-record-failed"}`);
}

export async function markBookingPaidAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const bookingId = requiredString(formData, "bookingId");
  const result = await markBookingPaidManually(createSupabaseAdminClient(), {
    bookingId,
    adminProfileId: profile.id,
    adminName: profile.full_name ?? "Admin",
  });
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payments");
  redirect(`/admin/bookings?success=${result.ok ? "payment-recorded" : "payment-record-failed"}`);
}

export async function markBookingUnpaidAction(formData: FormData) {
  await requireAdmin();
  const bookingId = requiredString(formData, "bookingId");
  const result = await markBookingUnpaid(createSupabaseAdminClient(), bookingId);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payments");
  redirect(`/admin/bookings?success=${result.ok ? "marked-unpaid" : "override-failed"}`);
}

export async function voidInvoiceAction(formData: FormData) {
  await requireAdmin();
  const bookingId = requiredString(formData, "bookingId");
  const result = await voidBookingInvoice(createSupabaseAdminClient(), bookingId);
  revalidatePath("/admin/bookings");
  redirect(`/admin/bookings?success=${result.ok ? "invoice-voided" : "override-failed"}`);
}

async function makeCleanerEligibleForAdminBooking(
  supabase: SupabaseAdmin,
  cleanerId: string,
  suburb: string,
) {
  const cleanerResult = await supabase
    .from("cleaners")
    .select("suburbs, service_slugs")
    .eq("id", cleanerId)
    .single();

  if (cleanerResult.error) throw cleanerResult.error;

  const suburbs = Array.from(new Set([...(cleanerResult.data.suburbs ?? []), suburb].filter(Boolean)));
  const serviceSlugs = Array.from(new Set([...(cleanerResult.data.service_slugs ?? []), REGULAR_CLEANING_SLUG]));
  const updateResult = await supabase
    .from("cleaners")
    .update({
      active: true,
      available: true,
      suburbs,
      service_slugs: serviceSlugs,
    })
    .eq("id", cleanerId);

  if (updateResult.error) throw updateResult.error;
}

async function ensureAuthUser(
  supabase: SupabaseAdmin,
  input: { email: string; password: string; fullName: string; phone: string; role: AdminRole },
) {
  const existingUserId = await findAuthUserIdByEmail(supabase, input.email);
  if (existingUserId) {
    await updateAuthUser(supabase, existingUserId, input);
    return existingUserId;
  }

  const result = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      phone: input.phone,
    },
    app_metadata: {
      role: input.role,
    },
  });

  if (result.error) throw result.error;
  if (!result.data.user) throw new Error("Unable to create auth user.");

  await upsertProfileRole(supabase, result.data.user.id, input.role, input.fullName, input.phone);
  return result.data.user.id;
}

async function updateAuthUser(
  supabase: SupabaseAdmin,
  userId: string,
  input: { email: string; password?: string | null; fullName: string; phone: string; role: AdminRole },
) {
  const result = await supabase.auth.admin.updateUserById(userId, {
    email: input.email,
    ...(input.password ? { password: input.password } : {}),
    user_metadata: {
      full_name: input.fullName,
      phone: input.phone,
    },
    app_metadata: {
      role: input.role,
    },
  });

  if (result.error) throw result.error;
  await upsertProfileRole(supabase, userId, input.role, input.fullName, input.phone);
}

async function upsertProfileRole(
  supabase: SupabaseAdmin,
  userId: string,
  role: AdminRole,
  fullName: string,
  phone: string,
) {
  const profileResult = await supabase
    .from("profiles")
    .upsert({ id: userId, role: role as Database["public"]["Tables"]["profiles"]["Insert"]["role"], full_name: fullName, phone }, { onConflict: "id" });

  if (profileResult.error) throw profileResult.error;
}

async function findAuthUserIdByEmail(supabase: SupabaseAdmin, email: string) {
  const result = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (result.error) throw result.error;
  return result.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

function requiredStringFromValue(value: string | null | undefined, label: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function revalidateAdmin() {
  revalidatePath("/admin/cleaners");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/settings");
}

function revalidatePricing() {
  revalidatePath("/admin/pricing");
  revalidatePath("/book");
  revalidatePath("/api/regular-cleaning/catalog");
  revalidatePath("/api/bookings/quote");
}

function isRegularCleaningCatalogConfigurationError(message: string) {
  return message === "Regular Cleaning bedroom/bathroom pricing is not configured" ||
    message === "Regular Cleaning equipment options are not configured";
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randToCents(formData: FormData, key: string, label: string) {
  const value = nonnegativeNumber(formData, key, label);
  return Math.round(value * 100);
}

function nonnegativeNumber(formData: FormData, key: string, label: string) {
  const raw = requiredString(formData, key);
  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return value;
}

function nonnegativeInt(formData: FormData, key: string, label: string) {
  const value = Math.round(nonnegativeNumber(formData, key, label));

  if (value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return value;
}

function positiveInt(formData: FormData, key: string, label: string) {
  const value = nonnegativeInt(formData, key, label);

  if (value < 1) {
    throw new Error(`${label} must be at least 1.`);
  }

  return value;
}
