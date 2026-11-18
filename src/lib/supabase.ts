import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Publishable values only. Row level security protects every table.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ktqmwpbzcnzkhjskqisy.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: false } });
  return client;
}

// Server-only client for privileged writes (documents). Uses the service role key when it is set in Vercel,
// so the doc RPCs can be revoked from anon. Falls back to the public client until the key exists.
let serverClient: SupabaseClient | null = null;

export function serverSupabase(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("serverSupabase is server-only");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return supabase();
  if (!serverClient) serverClient = createClient(URL, key, { auth: { persistSession: false } });
  return serverClient;
}
