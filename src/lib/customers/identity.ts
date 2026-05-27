import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type CustomerIdentityInput = {
  authUserId?: string | null;
  fullName: string;
  email: string;
  phone: string;
};

export async function upsertCustomerIdentity(
  supabase: SupabaseClient<Database>,
  input: CustomerIdentityInput,
) {
  const result = await supabase.rpc("upsert_customer_identity", {
    p_auth_user_id: input.authUserId ?? null,
    p_full_name: input.fullName,
    p_email: input.email,
    p_phone: input.phone,
  });

  if (result.error) throw result.error;
  if (!result.data) {
    throw new Error("Unable to resolve customer identity.");
  }

  return result.data;
}
