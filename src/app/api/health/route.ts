import { NextResponse } from "next/server";
import { mpesaConfigured } from "@/lib/mpesa";
import { smsConfigured } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SITE_URL", "SUPABASE_SECRET_KEY", "CRON_SECRET", "RESEND_API_KEY", "VEMI_FROM_EMAIL", "VEMI_OPS_EMAIL"] as const;

/** For uptime monitors: 200 when settings and the database are fine, 503 otherwise. Names only, never values. */
export async function GET() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  let database: "ok" | "unreachable" | "not_checked" = "not_checked";
  if (process.env.SUPABASE_SECRET_KEY) {
    try {
      const { error } = await createAdminClient().from("places").select("id", { head: true, count: "exact" }).limit(1);
      database = error ? "unreachable" : "ok";
    } catch {
      database = "unreachable";
    }
  }
  const healthy = missing.length === 0 && database === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", database, missingSettings: missing, mpesa: mpesaConfigured(), sms: smsConfigured(), time: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
