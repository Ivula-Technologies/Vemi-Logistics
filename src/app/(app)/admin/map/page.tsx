import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { TripStatusBadge } from "@/components/app/status-badge";
import { OpsMap, type OpsPin } from "@/components/app/ops-map";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { placeMap } from "@/lib/places";
import { ALERTS, LIVE_STATUSES, type TripStatus } from "@/lib/trips";
import { daysAgoIso, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Live map" };

type LiveTrip = { id: string; ref: string; status: TripStatus; sos_at: string | null; alert: keyof typeof ALERTS | null; load_id: string; carriers: { business_name: string } | null; loads: { origin_id: string; destination_id: string } | null };

/** Ops control room: every moving truck, SOS and silent trucks first, and trucks waiting for loads. */
export default async function AdminMapPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: tripRows }, { data: free }, places] = await Promise.all([
    supabase.from("trips").select("id, ref, status, sos_at, alert, load_id, carriers(business_name), loads(origin_id, destination_id)").in("status", LIVE_STATUSES).limit(500),
    supabase.from("truck_availability").select("truck_id, place_id, lat, lng, available_from, expires_at, trucks(plate, truck_type)").gt("expires_at", new Date().toISOString()).limit(500),
    placeMap(),
  ]);
  const trips = ((tripRows ?? []) as unknown as LiveTrip[]).sort((a, b) => Number(Boolean(b.sos_at || b.alert)) - Number(Boolean(a.sos_at || a.alert)));
  const { data: positions } = trips.length ? await supabase.from("trip_locations").select("trip_id, lat, lng, recorded_at").in("trip_id", trips.map((t) => t.id)).gte("recorded_at", daysAgoIso(2)).order("recorded_at", { ascending: false }).limit(5000) : { data: [] };
  const last = new Map<string, { lat: number; lng: number; recorded_at: string }>();
  for (const p of positions ?? []) if (!last.has(p.trip_id)) last.set(p.trip_id, p);
  const pins: OpsPin[] = [];
  for (const t of trips) { const p = last.get(t.id); if (p) pins.push({ lat: p.lat, lng: p.lng, label: `${t.ref} · ${t.carriers?.business_name ?? ""}${t.sos_at ? " · SOS" : t.alert ? ` · ${ALERTS[t.alert]}` : ""}`, href: `/trips/${t.id}`, tone: t.sos_at || t.alert ? "alert" : "live" }); }
  for (const f of free ?? []) { const place = places.get(f.place_id); const lat = f.lat ?? place?.lat; const lng = f.lng ?? place?.lng; const truck = f.trucks as unknown as { plate: string } | null; if (lat != null && lng != null) pins.push({ lat, lng, label: `Free: ${truck?.plate ?? "truck"} at ${place?.name}`, tone: "free" }); }

  return <div className="space-y-6">
    <AutoRefresh seconds={60} />
    <PageHeader title="Live map" description={`${trips.length} trucks on trips · ${(free ?? []).length} free trucks waiting for loads. Updates every minute.`} />
    <OpsMap pins={pins} className="h-[28rem] w-full rounded-lg border" />
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#f26a1b]" />On a trip</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#dc2626]" />SOS or alert</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#059669]" />Free truck</span></div>
    <div className="divide-y rounded-lg border bg-card text-sm">{trips.map((t) => { const p = last.get(t.id); return <Link key={t.id} href={`/trips/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-secondary/40">
      <span><span className="font-semibold">{t.ref}</span> · {places.get(t.loads?.origin_id ?? "")?.name} → {places.get(t.loads?.destination_id ?? "")?.name} · {t.carriers?.business_name}</span>
      <span className="flex items-center gap-2">{t.sos_at ? <span className="rounded bg-destructive px-1.5 py-0.5 text-xs font-semibold text-white">SOS</span> : t.alert ? <span className="text-xs font-semibold text-destructive">{ALERTS[t.alert]}</span> : null}<span className="text-xs text-muted-foreground">{p ? `seen ${formatDateTime(p.recorded_at)}` : "no position yet"}</span><TripStatusBadge status={t.status} /></span>
    </Link>; })}</div>
  </div>;
}
