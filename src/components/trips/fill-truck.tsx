import { Users } from "lucide-react";
import { LoadCard } from "@/components/loads/load-card";
import { Panel } from "@/components/trips/panels";
import { createClient } from "@/lib/supabase/server";
import { TRUCK_TYPES, spaceLeft } from "@/lib/pricing";
import { canRideAlong } from "@/lib/part-loads";
import { BEFORE_LOADING } from "@/lib/trips";
import type { TripView } from "@/lib/trip-view";
import type { Load } from "@/lib/types";

const SHARING = ["awaiting_payment", "scheduled", "to_pickup", "at_pickup", "loaded", "in_transit", "at_border", "at_dropoff"];

/**
 * For the carrier on a part-load trip: what else is on this truck, the space left, and open part loads going the
 * same way that would fill it. Each one is booked like any load, so every shipper keeps their own trip.
 */
export async function FillTruckPanel({ view }: { view: TripView }) {
  const { trip, load, truck } = view;
  if (view.viewer !== "carrier" || !load.part_load || !(BEFORE_LOADING as string[]).includes(trip.status)) return null;
  const supabase = await createClient();
  const capacity = Number(truck?.capacity_tonnes ?? TRUCK_TYPES[load.truck_type].tonnes);
  const [{ data: sharing }, { data: open }] = await Promise.all([
    truck ? supabase.from("trips").select("id, ref, loads!inner(weight_tonnes, pickup_date, part_load)").eq("truck_id", truck.id).neq("id", trip.id).in("status", SHARING) : Promise.resolve({ data: [] }),
    supabase.from("loads").select("*").eq("status", "open").eq("part_load", true).neq("shipper_id", view.userId).order("pickup_date").limit(200),
  ]);
  type Sharing = { id: string; ref: string; loads: { weight_tonnes: number; pickup_date: string; part_load: boolean } };
  const day = Date.parse(`${load.pickup_date}T00:00:00Z`);
  const onTruck = ((sharing ?? []) as unknown as Sharing[]).filter((s) => s.loads.part_load && Math.abs(Date.parse(`${s.loads.pickup_date}T00:00:00Z`) - day) <= 86_400_000);
  const space = spaceLeft(capacity, [load.weight_tonnes, ...onTruck.map((s) => s.loads.weight_tonnes)]);
  const matches = ((open ?? []) as Load[]).filter((other) => other.id !== load.id && canRideAlong(load, other, view.places, space, capacity)).slice(0, 5);
  return <Panel title="Fill your truck" id="fill">
    <p className="mb-3 flex items-start gap-2 text-sm"><Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>
      This is a part load ({Number(load.weight_tonnes)} t). {truck ? `${truck.plate} carries ${capacity} t` : `A ${TRUCK_TYPES[load.truck_type].short.toLowerCase()} carries about ${capacity} t`}{onTruck.length ? ` and also has ${onTruck.map((s) => s.ref).join(", ")} on it` : ""}, so <strong>{space} t</strong> is still free.
      {truck ? "" : " Assign the truck to see exactly what fits."}
    </span></p>
    {matches.length ? <div className="space-y-3">{matches.map((m) => <LoadCard key={m.id} load={m} places={view.places} href={`/board/${m.id}`} showStatus={false} />)}</div>
      : <p className="text-sm text-muted-foreground">No part loads going the same way right now. We tell you by push when one comes up near this pickup.</p>}
  </Panel>;
}
