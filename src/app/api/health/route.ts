import { NextResponse } from "next/server";
import { mpesaConfigured } from "@/lib/mpesa";
import { smsConfigured } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobHealth } from "@/lib/ops-core";

export const dynamic = "force-dynamic";

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SITE_URL", "SUPABASE_SECRET_KEY", "CRON_SECRET", "RESEND_API_KEY", "VEMI_FROM_EMAIL", "VEMI_OPS_EMAIL"] as const;

/**
 * For uptime monitors: 200 when settings, the database and the daily job are fine, 503 otherwise. Names only, never
 * values. dailyCron goes "late" after 26 hours without a run; watchCron (every 15 minutes, from cron-job.org on
 * Vercel Hobby) is reported but doesn't turn the check red, because it is optional.
 */
export async function GET() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  let database: "ok" | "unreachable" | "not_checked" = "not_checked";
  let dailyCron: "ok" | "late" | "never" | "not_checked" = "not_checked";
  let watchCron: "ok" | "late" | "never" | "not_checked" = "not_checked";
  let errorsLastDay: number | null = null;
  if (process.env.SUPABASE_SECRET_KEY) {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("places").select("id", { head: true, count: "exact" }).limit(1);
      database = error ? "unreachable" : "ok";
      if (!error) {
        const [{ data: runs }, { count }] = await Promise.all([
          admin.from("app_status").select("key, at").in("key", ["cron_daily", "cron_frequent"]),
          admin.from("app_events").select("id", { head: true, count: "exact" }).gte("at", new Date(Date.now() - 86_400_000).toISOString()),
        ]);
        const last = (key: string) => runs?.find((r) => r.key === key)?.at as string | undefined;
        dailyCron = jobHealth(last("cron_daily"), 26);
        watchCron = jobHealth(last("cron_frequent"), 1);
        errorsLastDay = count ?? null;
      }
    } catch {
      database = "unreachable";
    }
  }
  const healthy = missing.length === 0 && database === "ok" && dailyCron === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", database, dailyCron, watchCron, errorsLastDay, missingSettings: missing, mpesa: mpesaConfigured(), sms: smsConfigured(), time: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
