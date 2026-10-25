import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { TripCard } from "@/components/trips/trip-card";
import { LoadCard } from "@/components/loads/load-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { placeMap } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";
import { TRIP_COLUMNS } from "@/lib/trips";
import type { Load, Trip } from "@/lib/types";

export const metadata: Metadata = { title: "All trips" };

const FILTERS: [string, string][] = [["", "All"], ["awaiting_payment", "Unpaid"], ["live", "On the road"], ["delivered", "Delivered"], ["disputed", "Disputes"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["loads", "Open loads"]];

export default async function AdminTripsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireRole("admin");
  const { status = "", q = "" } = await searchParams;
  const supabase = await createClient();
  const places = await placeMap();
  let body: React.ReactNode;
  if (status === "loads") {
    const { data } = await supabase.from("loads").select("*").eq("status", "open").order("pickup_date").limit(200);
    body = (data ?? []).length ? <div className="space-y-3">{(data as Load[]).map((l) => <LoadCard key={l.id} load={l} places={places} href={`/admin/trips?q=${l.ref}`} />)}</div> : <EmptyState title="No open loads" />;
  } else {
    let request = supabase.from("trips").select(`${TRIP_COLUMNS}, loads(origin_id, destination_id, pickup_date, cargo_description)`).order("created_at", { ascending: false }).limit(200);
    if (status === "live") request = request.in("status", ["scheduled", "to_pickup", "loaded", "in_transit", "at_border"]);
    else if (status) request = request.eq("status", status);
    if (q.trim()) request = request.ilike("ref", `%${q.trim().replace(/[%_]/g, "")}%`);
    const { data } = await request;
    const trips = (data ?? []) as unknown as (Trip & { loads: Pick<Load, "origin_id" | "destination_id" | "pickup_date" | "cargo_description"> })[];
    body = trips.length ? <div className="space-y-3">{trips.map((t) => <TripCard key={t.id} trip={t} places={places} viewer="admin" />)}</div> : <EmptyState title="Nothing here" />;
  }
  return <div>
    <PageHeader title="All trips" />
    <form className="mb-3 flex gap-2"><input type="hidden" name="status" value={status} /><Input name="q" defaultValue={q} placeholder="Search by reference, e.g. VM-7F3A2C" /><Button variant="outline">Search</Button></form>
    <nav className="mb-4 flex gap-2 overflow-x-auto scrollbar-none">{FILTERS.map(([key, label]) => <Link key={key} href={key ? `/admin/trips?status=${key}` : "/admin/trips"} className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${key === status ? "border-primary bg-signal-soft font-semibold" : ""}`}>{label}</Link>)}</nav>
    {body}
  </div>;
}
