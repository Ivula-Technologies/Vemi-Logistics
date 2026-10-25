import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Navigation, Phone } from "lucide-react";
import { VemiMark } from "@/components/brand";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { DriverTrip, StopDoneButton } from "@/components/trips/driver-trip";
import { CallButton, SosButton, TripChat } from "@/components/trips/trip-tools";
import { createAdminClient } from "@/lib/supabase/admin";
import { placeMap } from "@/lib/places";
import { tripEta } from "@/lib/trip-view";
import { formatDuration } from "@/lib/eta";
import { driverText } from "@/lib/driver-i18n";
import { voiceConfigured } from "@/lib/voice";
import { CARGO_TYPES, LIVE_STATUSES, nextSteps } from "@/lib/trips";
import { TRUCK_TYPES } from "@/lib/pricing";
import { displayPhone } from "@/lib/phone";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Load, LoadStop, Message, PlaceRow, Trip, TripEvent, TripLocation } from "@/lib/types";

export const metadata: Metadata = { title: "Driver trip", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const LOAD_FIELDS = "ref, origin_id, origin_detail, origin_lat, origin_lng, destination_id, destination_detail, destination_lat, destination_lng, pickup_date, pickup_window, cargo_type, cargo_description, weight_tonnes, truck_type, notes, border_crossings, require_codes";

/** The driver's page. No login: the long random token in the link is the key, and it only works for this one trip. */
export default async function DriverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();
  const admin = createAdminClient();
  const { data: trip } = await admin.from("trips").select("id, ref, status, pod_path, load_id, truck_id, driver_id, carrier_id").eq("driver_token", token).maybeSingle();
  if (!trip) notFound();
  const [{ data: loadRow }, { data: contacts }, { data: driver }, { data: truck }, { data: carrier }, { data: stops }, { data: events }, { data: locations }, { data: messages }, places] = await Promise.all([
    admin.from("loads").select(LOAD_FIELDS).eq("id", trip.load_id).single(),
    admin.from("load_contacts").select("*").eq("load_id", trip.load_id).maybeSingle(),
    trip.driver_id ? admin.from("drivers").select("full_name, language").eq("id", trip.driver_id).maybeSingle() : Promise.resolve({ data: null }),
    trip.truck_id ? admin.from("trucks").select("plate").eq("id", trip.truck_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("carriers").select("business_name").eq("id", trip.carrier_id).maybeSingle(),
    admin.from("load_stops").select("*").eq("load_id", trip.load_id).order("seq"),
    admin.from("trip_events").select("status").eq("trip_id", trip.id),
    admin.from("trip_locations").select("lat, lng, recorded_at").eq("trip_id", trip.id).order("recorded_at", { ascending: false }).limit(1),
    admin.from("messages").select("id, trip_id, sender, body, to_support, created_at").eq("trip_id", trip.id).order("created_at").limit(200),
    placeMap(),
  ]);
  if (!loadRow) notFound();
  const load = loadRow as unknown as Load;
  const lang = driver?.language === "en" ? "en" : "sw";
  const t = driverText(lang);
  const origin = places.get(load.origin_id)!;
  const destination = places.get(load.destination_id)!;
  const stopRows = (stops ?? []) as LoadStop[];
  const paid = trip.status !== "awaiting_payment";
  const done = ["delivered", "completed", "cancelled", "disputed"].includes(trip.status);
  const live = (LIVE_STATUSES as string[]).includes(trip.status);
  const access = { kind: "driver" as const, token };
  const eta = tripEta({ trip: trip as Trip, load, origin, destination, stops: stopRows, places, events: (events ?? []) as TripEvent[], locations: (locations ?? []) as TripLocation[] });
  // The driver sees the trip conversation but not what the shipper or carrier sent privately to Vemi support.
  const chat = ((messages ?? []) as Message[]).filter((m) => !m.to_support || m.sender === "driver");
  const voice = voiceConfigured();
  const goTo = (lat: number | null, lng: number | null, place: PlaceRow | undefined) => {
    const la = lat ?? place?.lat; const ln = lng ?? place?.lng;
    return la != null && ln != null ? `https://www.google.com/maps/dir/?api=1&destination=${la},${ln}&travelmode=driving` : null;
  };

  return <main className="mx-auto min-h-screen max-w-lg px-4 pb-16 pt-5">
    {live ? <AutoRefresh seconds={60} /> : null}
    <header className="flex items-center gap-3"><VemiMark className="h-9 w-9" /><div><p className="text-xs text-muted-foreground">Vemi {trip.ref} · {carrier?.business_name}</p><p className="font-semibold">{driver?.full_name ? `Habari ${driver.full_name.split(" ")[0]}` : t.driver}{truck?.plate ? ` · ${truck.plate}` : ""}</p></div></header>
    <div className="mt-5 rounded-xl bg-[#151a24] p-5 text-white">
      <p className="text-sm text-white/60">{t.status[trip.status] ?? trip.status}</p>
      <p className="mt-1 text-2xl font-bold">{origin.name} → {destination.name}</p>
      <p className="mt-1 text-sm text-white/70">{formatDate(load.pickup_date)} · {Number(load.weight_tonnes)} t · {TRUCK_TYPES[load.truck_type]?.short}</p>
      {eta ? <p className="mt-3 flex items-center gap-2 text-sm"><Clock className="h-4 w-4" />{t.eta}: {formatDateTime(eta.at)} ({formatDuration(eta.hours)})</p> : null}
    </div>
    {!paid ? <p className="mt-4 rounded-md bg-amber-500/15 px-4 py-3 text-sm">{t.notPaid}</p> : null}
    {trip.status === "cancelled" ? <p className="mt-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{t.cancelled}</p> : null}

    <section className="mt-5 space-y-4 rounded-xl border bg-card p-4 text-sm">
      <Place label={t.pickup} detail={withTown(load.origin_detail, origin.name)} nav={paid ? goTo(load.origin_lat, load.origin_lng, origin) : null} navLabel={t.navigate} name={paid ? contacts?.pickup_name : null} phone={paid ? contacts?.pickup_phone : null} />
      {stopRows.length ? <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.stops}</p>
        <ol className="mt-1 space-y-3">{stopRows.map((s) => {
          const place = places.get(s.place_id);
          const nav = paid ? goTo(s.lat, s.lng, place) : null;
          return <li key={s.id} className="rounded-md border p-3">
            <p className="font-medium">{s.seq}. {withTown(s.detail, place?.name)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {nav ? <a href={nav} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary"><Navigation className="h-4 w-4" />{t.navigate}</a> : null}
              {s.done_at ? <span className="text-xs font-semibold text-emerald-700">✓ {t.stopFinished}</span> : paid && !done && !["to_pickup", "at_pickup", "scheduled"].includes(trip.status) ? <StopDoneButton token={token} seq={s.seq} lang={lang} /> : null}
            </div>
          </li>;
        })}</ol>
      </div> : null}
      <Place label={t.dropoff} detail={withTown(load.destination_detail, destination.name)} nav={paid ? goTo(load.destination_lat, load.destination_lng, destination) : null} navLabel={t.navigate} name={paid ? contacts?.dropoff_name : null} phone={paid ? contacts?.dropoff_phone : null} />
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.goods}</p><p>{CARGO_TYPES[load.cargo_type]}: {load.cargo_description}</p>{load.notes ? <p className="mt-1 text-muted-foreground">{load.notes}</p> : null}</div>
    </section>

    {!done || trip.status === "delivered" ? <DriverTrip token={token} status={trip.status} steps={paid ? nextSteps(trip.status, load.border_crossings > 0) : []} hasPod={Boolean(trip.pod_path)} lang={lang} requireCodes={load.require_codes} /> : <p className="mt-6 text-center text-sm text-muted-foreground">{t.finished}</p>}

    {voice && paid && !done ? <section className="mt-5 flex flex-wrap gap-2">
      <CallButton access={access} to="carrier" label={`${t.callVemi}: ${carrier?.business_name ?? "boss"}`} ringing={t.callRinging} />
    </section> : null}

    {paid && trip.status !== "cancelled" ? <section className="mt-6">
      <h2 className="mb-2 font-semibold">{t.chat}</h2>
      <TripChat access={access} messages={chat} me="driver" text={{ placeholder: t.chatPlaceholder, send: t.send, you: t.you, help: false }} />
    </section> : null}

    {live ? <section className="mt-6"><SosButton access={access} text={{ label: t.sos, hint: t.sosHint, confirm: t.sosConfirm, sent: t.sosSent, numbers: t.emergencyNumbers }} /></section> : null}
  </main>;
}

function Place({ label, detail, nav, navLabel, name, phone }: { label: string; detail: string | undefined; nav: string | null; navLabel: string; name?: string | null; phone?: string | null }) {
  return <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-medium">{detail}</p>
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
      {nav ? <a href={nav} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary"><Navigation className="h-4 w-4" />{navLabel}</a> : null}
      {phone ? <a href={`tel:+${phone}`} className="inline-flex items-center gap-1 font-semibold text-primary"><Phone className="h-4 w-4" />{name ? `${name} · ` : ""}{displayPhone(phone)}</a> : null}
    </div>
  </div>;
}

function withTown(detail: string | null, town: string | undefined) {
  if (!detail) return town;
  return town && !detail.toLowerCase().includes(town.toLowerCase()) ? `${detail}, ${town}` : detail;
}
