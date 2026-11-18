import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, digestLines, type OpsEvent } from "@/lib/ops-core";

export { clientIp };

/**
 * Running Vemi alone: server errors go to the app_events table as well as the Vercel log, the daily cron emails a
 * digest of them, the cron jobs record when they last ran (shown by /api/health), and rate limits are kept in
 * Postgres so they hold across Vercel's server instances. Every function here is best-effort and never throws.
 */

// At most this many error rows per minute from one server instance, so an error storm can't flood the database.
const MAX_EVENTS_PER_MINUTE = 30;
let windowStart = 0;
let written = 0;

function describe(error: unknown) {
  if (error instanceof Error) return { message: error.message, stack: error.stack?.split("\n").slice(0, 6).join("\n") };
  if (error && typeof error === "object" && "message" in error) return { message: String((error as { message: unknown }).message), detail: error };
  return { message: String(error) };
}

/** Logs a server error and keeps a copy in the database for the daily digest. */
export async function reportError(source: string, error: unknown, detail?: Record<string, unknown>) {
  const described = describe(error);
  console.error(`[${source}]`, described.message, detail ?? "", error);
  const now = Date.now();
  if (now - windowStart > 60_000) { windowStart = now; written = 0; }
  if (++written > MAX_EVENTS_PER_MINUTE) return;
  try {
    await createAdminClient().from("app_events").insert({ source, message: described.message.slice(0, 500), detail: { ...detail, ...("stack" in described ? { stack: described.stack } : {}) } });
  } catch (logError) {
    console.error("Could not store the error", logError);
  }
}

/** Records that a scheduled job ran, for the cron watch in /api/health. */
export async function markRan(key: string, detail?: Record<string, unknown>) {
  try {
    await createAdminClient().from("app_status").upsert({ key, at: new Date().toISOString(), detail: detail ?? null });
  } catch (error) {
    console.error("Could not record the job run", key, error);
  }
}

/**
 * true when the request is within the limit. Counts are shared by every server instance. If the database can't be
 * reached the request is allowed: a broken limiter must not lock people out.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  try {
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) throw error;
    return data !== false;
  } catch (error) {
    console.error("Rate limit check failed; allowing the request", key, error);
    return true;
  }
}

/** The last day's errors as a short text digest (null when there were none), and housekeeping. */
export async function errorDigest() {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin.from("app_events").select("source, message, at").gte("at", since).order("at", { ascending: false }).limit(500);
  await admin.rpc("prune_ops_tables");
  return digestLines((data ?? []) as OpsEvent[]);
}
