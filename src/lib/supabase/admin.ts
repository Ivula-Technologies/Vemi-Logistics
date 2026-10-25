import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY.");
  return createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}
