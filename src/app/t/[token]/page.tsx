import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, Truck as TruckIcon } from "lucide-react";
import { VemiMark } from "@/components/brand";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { TripStatusBadge } from "@/components/app/status-badge";
import { TripMap } from "@/components/app/trip-map";
import { createAdminClient } from "@/lib/supabase/admin";
import { placeMap } from "@/lib/places";
import { tripEta } from "@/lib/trip-view";
import { formatDuration } from "@/lib/eta";
import { LIVE_STATUSES, PROGRESS, TRIP_STATUS, progressIndex } from "@/lib/trips";
import { cn, formatDateTime } from "@/lib/utils";
import type { Load, LoadStop, Trip, TripEvent, TripLocation } from "@/lib/types";

export const metadata: Metadata = { title: "Live tracking", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Share my trip: anyone with the link follows the truck. No prices, no phone numbers, no codes. */
export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();
  const admin = createAdminClient();
  const { data: tripRow } = await admin.from("trips").select("id, ref, status, load_id, truck_id, driver_id, carrier_id, delivered_at, expected_delivery").eq("share_token", token).maybeSingle();
  if (!tripRow) notFound();
  const trip = tripRow as unknown as Trip;
  const [{ data: loadRow }, { data: stops }, { data: events }, { data: locations }, { data: carrier }, { data: truck }, { data: driver }, places] = await Promise.all([
    admin.from("loads").select("ref, origin_id, origin_lat, origin_lng, destination_id, destination_lat, destination_lng, pickup_date, border_crossings, cargo_type").eq("id", trip.load_id).single(),
    admin.from("load_stops").select("id, seq, place_id, lat, lng, done_at, detail, kind, load_id").eq("load_id", trip.load_id).order("seq"),
    admin.from("trip_events").select("id, status, created_at").eq("trip_id", trip.id).order("created_at", { ascending: false }),
    admin.from("trip_locations").select("lat, lng, recorded_at").eq("trip_id", trip.id).order("recorded_at").limit(1000),
    admin.from("carriers").select("business_name").eq("id", trip.carrier_id).maybeSingle(),
    trip.truck_id ? admin.from("trucks").select("plate").eq("id", trip.truck_id).maybeSingle() : Promise.resolve({ data: null }),
    trip.driver_id ? admin.from("drivers").select("full_name").eq("id", trip.driver_id).maybeSingle() : Promise.resolve({ data: null }),
    placeMap(),
  ]);
  if (!loadRow) notFound();
  const load = loadRow as unknown as Load;
  const origin = places.get(load.origin_id)!;
  const destination = places.get(load.destination_id)!;
  const stopRows = (stops ?? []) as LoadStop[];
  const path = (locations ?? []) as TripLocation[];
  const live = (LIVE_STATUSES as string[]).includes(trip.status);
  const eta = tripEta({ trip, load, origin, destination, stops: stopRows, places, events: (events ?? []) as TripEvent[], locations: path });
  const step = progressIndex(trip.status);
  const stopPins = stopRows.flatMap((s) => { const p = places.get(s.place_id); const lat = s.lat ?? p?.lat; const lng = s.lng ?? p?.lng; return lat != null && lng != null ? [{ lat, lng, name: p?.name ?? "Stop", done: Boolean(s.done_at) }] : []; });
  const pin = (lat: number | null, lng: number | null, fallback: typeof origin) => (lat !== null && lng !== null ? { ...fallback, lat, lng } : fallback);

  return <main className="mx-auto min-h-screen max-w-3xl px-4 pb-16 pt-5">
    {live ? <AutoRefresh seconds={30} /> : null}
    <header className="flex items-center justify-between gap-3">
      <Link href="/" className="flex items-center gap-2"><VemiMark className="h-9 w-9" /><span className="font-semibold">Vemi Logistics</span></Link>
      <TripStatusBadge status={trip.status} />
    </header>
    <h1 className="mt-5 text-2xl font-bold">{origin.name} → {destination.name}</h1>
    <p className="text-sm text-muted-foreground">Trip {trip.ref} · {carrier?.business_name}{truck?.plate ? ` · ${truck.plate}` : ""}{driver?.full_name ? ` · driver ${driver.full_name.split(" ")[0]}` : ""}</p>

    {trip.status !== "cancelled" ? <ol className="mt-4 grid grid-cols-7 gap-1" aria-label="Trip progress">
      {PROGRESS.map((s, i) => <li key={s}><div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} /><p className={cn("mt-1 hidden truncate text-[11px] sm:block", i === step ? "font-semibold" : "text-muted-foreground")}>{TRIP_STATUS[s].label.split(",")[0]}</p></li>)}
    </ol> : null}

    <section className="mt-5 overflow-hidden rounded-lg border bg-card">
      <TripMap origin={pin(load.origin_lat, load.origin_lng, origin)} destination={pin(load.destination_lat, load.destination_lng, destination)} stops={stopPins} path={path} className="h-80 w-full" />
      <div className="space-y-1 border-t px-4 py-3 text-sm">
        {eta ? <p className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4 text-primary" />{eta.label === "pickup" ? "Truck at pickup" : "Arrives"} in {formatDuration(eta.hours)} (around {formatDateTime(eta.at)})</p> : null}
        {trip.status === "delivered" || trip.status === "completed" ? <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400"><TruckIcon className="h-4 w-4" />Delivered {formatDateTime(trip.delivered_at)}</p> : null}
        {live ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{path.length ? `Last position ${formatDateTime(path.at(-1)!.recorded_at)}` : "Waiting for the truck's first position."} Updates every 30 seconds.</p> : null}
      </div>
    </section>

    <section className="mt-6">
      <h2 className="mb-3 font-semibold">Updates</h2>
      <ol className="space-y-2 border-l-2 pl-5 text-sm">{((events ?? []) as TripEvent[]).map((e) => <li key={e.id}><p className="font-medium">{TRIP_STATUS[e.status as keyof typeof TRIP_STATUS]?.label ?? e.status}</p><p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p></li>)}</ol>
    </section>
    <p className="mt-10 text-center text-xs text-muted-foreground">Moving goods in East Africa? <Link href="/signup" className="font-semibold text-primary">Book a truck on Vemi</Link></p>
  </main>;
}
