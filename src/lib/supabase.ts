import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Publishable values only. Row level security protects every table.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ktqmwpbzcnzkhjskqisy.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: false } });
  return client;
}
