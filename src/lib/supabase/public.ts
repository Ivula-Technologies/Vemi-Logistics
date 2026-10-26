import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
export function createPublicClient() {
  const { url, key } = getSupabasePublicEnv();
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
