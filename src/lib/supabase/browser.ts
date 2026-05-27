"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase browser environment variables are not configured");
  }

  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
