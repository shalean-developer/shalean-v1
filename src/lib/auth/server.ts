import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { upsertCustomerIdentity } from "@/lib/customers/identity";
import { cleanerEmailFromPhone, validateCleanerPhone } from "./cleaner";

export const cleanerSessionCookie = "shalean_cleaner_session";
export const shaleanAdminEmail = "admin@shalean.co.za";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type CleanerRow = Database["public"]["Tables"]["cleaners"]["Row"];
type AuthUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function isAdminRole(role?: ProfileRow["role"] | string | null) {
  return role === "admin";
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const result = await supabase.auth.getUser();

  return result.data.user ?? null;
}

export async function getProfileForUser(userId: string) {
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data;
}

export async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin/login");
  }

  const profile = await getAdminProfileForUser(user);
  if (!profile) {
    redirect("/admin/login?error=unauthorized");
  }

  return { user, profile: profile as ProfileRow };
}

export async function getAdminSession() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const profile = await getAdminProfileForUser(user);
  if (!profile) {
    return null;
  }

  return { user, profile };
}

export async function getAdminProfileForUser(user: AuthUser) {
  let profile = await getProfileForUser(user.id);

  if (!profile && user.email?.toLowerCase() === shaleanAdminEmail && isAdminRole(user.app_metadata?.role as string | undefined)) {
    const admin = createSupabaseAdminClient();
    const fullName = typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "Shalean Cleaning Services Admin";
    const profileResult = await admin
      .from("profiles")
      .upsert({ id: user.id, role: "admin", full_name: fullName, phone: null }, { onConflict: "id" })
      .select("*")
      .single();

    if (profileResult.error) throw profileResult.error;
    profile = profileResult.data;
  }

  return isAdminRole(profile?.role) ? profile : null;
}

export async function getCustomerSession() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const profile = await getProfileForUser(user.id);
  if (profile && profile.role !== "customer") {
    return null;
  }

  return { user, profile };
}

export async function requireCustomer() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/book");
  }

  return session;
}

export async function clearCleanerSession() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(cleanerSessionCookie);
}

export async function loginCleanerWithPassword(input: { phone: string; password: string }) {
  const phone = validateCleanerPhone(input.phone);
  if (!input.password) {
    throw new Error("Password is required.");
  }

  const email = cleanerEmailFromPhone(phone);
  const supabase = await createSupabaseServerClient();
  const signInResult = await supabase.auth.signInWithPassword({ email, password: input.password });

  if (signInResult.error || !signInResult.data.user) {
    throw new Error("Invalid phone number or password.");
  }

  const admin = createSupabaseAdminClient();
  const cleanerResult = await admin
    .from("cleaners")
    .select("*")
    .eq("auth_user_id", signInResult.data.user.id)
    .eq("auth_email", email)
    .maybeSingle();

  if (cleanerResult.error) throw cleanerResult.error;
  if (!cleanerResult.data?.active) {
    await supabase.auth.signOut();
    throw new Error("Invalid phone number or password.");
  }

  await admin.from("cleaners").update({ last_login_at: new Date().toISOString() }).eq("id", cleanerResult.data.id);

  return cleanerResult.data;
}

export async function getCleanerSession() {
  const supabase = await createSupabaseServerClient();
  const userResult = await supabase.auth.getUser();
  const user = userResult.data.user;
  if (!user) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const cleanerResult = await admin
    .from("cleaners")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (cleanerResult.error) throw cleanerResult.error;
  if (!cleanerResult.data) {
    return null;
  }

  return {
    session: user,
    cleaner: cleanerResult.data as CleanerRow,
  };
}

export async function requireCleanerSession() {
  const session = await getCleanerSession();
  if (!session) {
    redirect("/cleaner/login");
  }

  return session;
}

export async function ensureCustomerProfile(input: {
  userId: string;
  email: string;
  fullName: string;
  phone: string;
}) {
  const supabase = createSupabaseAdminClient();
  const profileResult = await supabase
    .from("profiles")
    .upsert({
      id: input.userId,
      role: "customer",
      full_name: input.fullName,
      phone: input.phone,
    }, { onConflict: "id" });

  if (profileResult.error) throw profileResult.error;

  return upsertCustomerIdentity(supabase, {
    authUserId: input.userId,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
  });
}
