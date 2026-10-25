import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { VemiMark } from "@/components/brand";
import { DriverTrip } from "@/components/trips/driver-trip";
import { createAdminClient } from "@/lib/supabase/admin";
import { placeMap } from "@/lib/places";
import { TRIP_STATUS, CARGO_TYPES, nextSteps } from "@/lib/trips";
import { TRUCK_TYPES } from "@/lib/pricing";
import { displayPhone } from "@/lib/phone";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Driver trip", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The driver's page. No login: the long random token in the link is the key, and it only works for this one trip. */
export default async function DriverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();
  const admin = createAdminClient();
  const { data: trip } = await admin.from("trips").select("id, ref, status, pod_path, load_id, truck_id, driver_id, carrier_id").eq("driver_token", token).maybeSingle();
  if (!trip) notFound();
  const [{ data: load }, { data: contacts }, { data: driver }, { data: truck }, { data: carrier }, places] = await Promise.all([
    admin.from("loads").select("ref, origin_id, origin_detail, destination_id, destination_detail, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, notes, border_crossings").eq("id", trip.load_id).single(),
    admin.from("load_contacts").select("*").eq("load_id", trip.load_id).maybeSingle(),
    trip.driver_id ? admin.from("drivers").select("full_name").eq("id", trip.driver_id).maybeSingle() : Promise.resolve({ data: null }),
    trip.truck_id ? admin.from("trucks").select("plate").eq("id", trip.truck_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("carriers").select("business_name").eq("id", trip.carrier_id).maybeSingle(),
    placeMap(),
  ]);
  if (!load) notFound();
  const origin = places.get(load.origin_id);
  const destination = places.get(load.destination_id);
  const paid = trip.status !== "awaiting_payment";
  const done = ["delivered", "completed", "cancelled", "disputed"].includes(trip.status);
  return <main className="mx-auto min-h-screen max-w-lg px-4 pb-16 pt-5">
    <header className="flex items-center gap-3"><VemiMark className="h-9 w-9" /><div><p className="text-xs text-muted-foreground">Vemi trip {trip.ref} · {carrier?.business_name}</p><p className="font-semibold">{driver?.full_name ? `Habari ${driver.full_name.split(" ")[0]}` : "Driver"}{truck?.plate ? ` · ${truck.plate}` : ""}</p></div></header>
    <div className="mt-5 rounded-xl bg-[#151a24] p-5 text-white">
      <p className="text-sm text-white/60">{TRIP_STATUS[trip.status as keyof typeof TRIP_STATUS]?.label}</p>
      <p className="mt-1 text-2xl font-bold">{origin?.name} → {destination?.name}</p>
      <p className="mt-1 text-sm text-white/70">Pickup {formatDate(load.pickup_date)} · {Number(load.weight_tonnes)} t · {TRUCK_TYPES[load.truck_type as keyof typeof TRUCK_TYPES]?.short}</p>
    </div>
    {!paid ? <p className="mt-4 rounded-md bg-amber-500/15 px-4 py-3 text-sm">Wait: the shipper has not paid yet. Don&apos;t go to pickup until your boss confirms or this page says it&apos;s paid.</p> : null}
    {trip.status === "cancelled" ? <p className="mt-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">This trip was cancelled. Call your boss.</p> : null}
    <section className="mt-5 space-y-3 rounded-xl border bg-card p-4 text-sm">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pickup</p><p className="font-medium">{withTown(load.origin_detail, origin?.name)}</p>{paid && contacts?.pickup_phone ? <a href={`tel:+${contacts.pickup_phone}`} className="mt-1 inline-flex items-center gap-2 font-semibold text-primary"><Phone className="h-4 w-4" />{contacts.pickup_name ? `${contacts.pickup_name} · ` : ""}{displayPhone(contacts.pickup_phone)}</a> : null}</div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Drop-off</p><p className="font-medium">{withTown(load.destination_detail, destination?.name)}</p>{paid && contacts?.dropoff_phone ? <a href={`tel:+${contacts.dropoff_phone}`} className="mt-1 inline-flex items-center gap-2 font-semibold text-primary"><Phone className="h-4 w-4" />{contacts.dropoff_name ? `${contacts.dropoff_name} · ` : ""}{displayPhone(contacts.dropoff_phone)}</a> : null}</div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Goods</p><p>{CARGO_TYPES[load.cargo_type as keyof typeof CARGO_TYPES]}: {load.cargo_description}</p>{load.notes ? <p className="mt-1 text-muted-foreground">{load.notes}</p> : null}</div>
    </section>
    {!done || trip.status === "delivered" ? <DriverTrip token={token} status={trip.status} steps={paid ? nextSteps(trip.status, load.border_crossings > 0) : []} hasPod={Boolean(trip.pod_path)} /> : <p className="mt-6 text-center text-sm text-muted-foreground">This trip is finished. Asante!</p>}
  </main>;
}

function withTown(detail: string | null, town: string | undefined) {
  if (!detail) return town;
  return town && !detail.toLowerCase().includes(town.toLowerCase()) ? `${detail}, ${town}` : detail;
}
