import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/cron";
import { notifyOps, notifyUser } from "@/lib/notify";
import { announceLoad } from "@/lib/load-alerts";
import { ALERTS } from "@/lib/trips";

export const dynamic = "force-dynamic";

type Watch = { alerts: { trip_id: string; ref: string; alert: keyof typeof ALERTS; carrier_id: string }[]; announce: string[] };

/**
 * Every 15 minutes from cPanel cron: truck watch (no signal or stopped too long, like Uber's RideCheck) and
 * announcing loads whose favourites-first window has closed.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient().rpc("run_watch_jobs");
  if (error) { console.error("Watch jobs failed", error); return NextResponse.json({ error: error.message }, { status: 500 }); }
  const watch = data as Watch;
  await Promise.all(watch.alerts.map(async (a) => {
    await notifyOps(`Truck watch: ${a.ref}`, `${ALERTS[a.alert]}. Call the driver and the carrier.`, `/trips/${a.trip_id}`, { urgent: a.alert === "no_signal" });
    await notifyUser(a.carrier_id, `Check on ${a.ref}`, `${ALERTS[a.alert]}. Is everything OK? Ask your driver to keep the trip page open, or tell Vemi on the trip chat.`, `/trips/${a.trip_id}`, { sms: true, key: `watch-${a.trip_id}-${a.alert}` });
  }));
  for (const loadId of watch.announce) await announceLoad(loadId);
  return NextResponse.json({ alerts: watch.alerts.length, announced: watch.announce.length });
}
