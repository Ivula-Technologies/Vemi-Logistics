import type { Metadata } from "next";
import { Route } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { TripCard } from "@/components/trips/trip-card";
import { getSession } from "@/lib/auth";
import { placeMap } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";
import { TRIP_COLUMNS } from "@/lib/trips";
import type { Load, Trip } from "@/lib/types";

export const metadata: Metadata = { title: "Trips" };

type Row = Trip & { loads: Pick<Load, "origin_id" | "destination_id" | "pickup_date" | "cargo_description"> | null };

export default async function TripsPage() {
  const { user, profile, accountId } = await getSession();
  const supabase = await createClient();
  let request = supabase.from("trips").select(`${TRIP_COLUMNS}, loads(origin_id, destination_id, pickup_date, cargo_description)`).order("created_at", { ascending: false }).limit(200);
  if (profile.role !== "admin") request = request.eq(profile.role === "carrier" ? "carrier_id" : "shipper_id", profile.role === "carrier" ? user.id : accountId);
  const [{ data }, places] = await Promise.all([request, placeMap()]);
  const trips = (data ?? []) as unknown as Row[];
  const active = trips.filter((t) => !["completed", "cancelled"].includes(t.status));
  const past = trips.filter((t) => ["completed", "cancelled"].includes(t.status));
  const viewer = profile.role;
  return <div className="space-y-8">
    <PageHeader title="Trips" description={viewer === "carrier" ? "Loads you won. Open one to dispatch, update the trip and see your payout." : "Every booking, from payment to delivery."} />
    {trips.length ? <>
      <section><h2 className="mb-3 font-semibold">Active</h2>{active.length ? <div className="space-y-3">{active.map((t) => <TripCard key={t.id} trip={t} places={places} viewer={viewer} />)}</div> : <p className="text-sm text-muted-foreground">Nothing active right now.</p>}</section>
      {past.length ? <section><h2 className="mb-3 font-semibold">Past</h2><div className="space-y-3">{past.map((t) => <TripCard key={t.id} trip={t} places={places} viewer={viewer} />)}</div></section> : null}
    </> : <EmptyState icon={<Route className="h-5 w-5" />} title="No trips yet" description={viewer === "carrier" ? "Bid on loads. When a shipper books you, the trip appears here." : "Book a bid on one of your loads and the trip appears here."} />}
  </div>;
}
