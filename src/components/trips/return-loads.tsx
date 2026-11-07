import { Home, RotateCcw } from "lucide-react";
import { LoadCard } from "@/components/loads/load-card";
import { Panel } from "@/components/trips/panels";
import { createClient } from "@/lib/supabase/server";
import { HOME_KM, returnLoadsFor, returnWindow } from "@/lib/return-loads";
import type { TripView } from "@/lib/trip-view";
import type { Load } from "@/lib/types";
import { translator, type AppLang } from "@/lib/i18n";

const HEADING_OUT = ["scheduled", "to_pickup", "at_pickup", "loaded", "in_transit", "at_border", "at_dropoff", "delivered"];

function shortDate(date: string, lang: AppLang) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(lang === "sw" ? "sw-KE" : "en-KE", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * For the carrier on a booked trip: open loads picking up near where this truck unloads, from the day it
 * arrives to a few days later, so it doesn't drive home empty. Loads that end near where it started come first.
 */
export async function ReturnLoadsPanel({ view, lang = "en" }: { view: TripView; lang?: AppLang }) {
  const tr = translator(lang);
  const { trip, load, truck, destination, origin } = view;
  if (view.viewer !== "carrier" || !HEADING_OUT.includes(trip.status)) return null;
  const { from, to } = returnWindow(load, view.places);
  const supabase = await createClient();
  const { data } = await supabase.from("loads").select("*").eq("status", "open").neq("shipper_id", view.userId)
    .gte("pickup_date", from).lte("pickup_date", to).order("pickup_date").limit(200);
  const matches = returnLoadsFor(load, (data ?? []) as Load[], view.places, truck ?? { truck_type: load.truck_type }).slice(0, 5);
  return <Panel title={tr("return.title")} id="return">
    <p className="mb-3 flex items-start gap-2 text-sm"><RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>
      {tr("return.intro", { truck: truck ? truck.plate : tr("return.yourTruck"), town: destination.name, from: shortDate(from, lang), to: shortDate(to, lang) })}
    </span></p>
    {matches.length ? <div className="space-y-3">{matches.map(({ load: m, homeKm }) => <LoadCard key={m.id} load={m} places={view.places} href={`/board/${m.id}`} showStatus={false} lang={lang}
      extra={homeKm <= HOME_KM ? <p className="flex items-center gap-1.5 text-sm font-medium text-primary"><Home className="h-4 w-4" />{tr("return.home", { town: origin.name })}</p> : null} />)}</div>
      : <p className="text-sm text-muted-foreground">{tr("return.none", { town: destination.name })}</p>}
  </Panel>;
}
