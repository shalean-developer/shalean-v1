import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

export async function updateCleanerAvailability(
  supabase: Supabase,
  input: { cleanerId: string; available: boolean },
) {
  const result = await supabase
    .from("cleaners")
    .update({ available: input.available })
    .eq("id", input.cleanerId)
    .eq("active", true)
    .select("*")
    .single();

  if (result.error) throw result.error;
  return result.data;
}
