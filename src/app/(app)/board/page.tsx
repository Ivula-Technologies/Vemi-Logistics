import type { Metadata } from "next";
import Link from "next/link";
import { Flame, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { LoadCard } from "@/components/loads/load-card";
import { selectClass } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { placeMap } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";
import { COUNTRY_NAMES, TRUCK_TYPES, TRUCK_TYPE_KEYS } from "@/lib/pricing";
import type { Load } from "@/lib/types";

export const metadata: Metadata = { title: "Find loads" };

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ truck?: string; from?: string; to?: string; all?: string; instant?: string; part?: string }> }) {
  const [{ user, carrier }, query] = await Promise.all([requireRole("carrier"), searchParams]);
  if (carrier?.status !== "verified") {
    return <div><PageHeader title="Find loads" /><EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="You&apos;ll see loads once you&apos;re verified" description="Add your trucks, a driver and your documents. Vemi checks them within one working day." action={<Button asChild><Link href="/home">See what&apos;s left to do</Link></Button>} /></div>;
  }
  const supabase = await createClient();
  const [{ data: trucks }, { data: myBids }, { data: free }, { data: lanes }, places] = await Promise.all([
    supabase.from("trucks").select("truck_type").eq("carrier_id", user.id).eq("active", true),
    supabase.from("bids").select("load_id, amount, status").eq("carrier_id", user.id),
    supabase.from("truck_availability").select("heading_to, place_id").eq("carrier_id", user.id),
    supabase.rpc("busy_lanes"),
    placeMap(),
  ]);
  const myTypes = [...new Set((trucks ?? []).map((t) => t.truck_type as string))];
  const truck = query.truck && query.truck in TRUCK_TYPES ? query.truck : query.all ? "" : "";
  let request = supabase.from("loads").select("*").eq("status", "open").order("pickup_date").limit(100);
  if (truck) request = request.eq("truck_type", truck);
  if (query.part) request = request.eq("part_load", true);
  if (query.instant) request = request.eq("instant_book", true);
  else if (!query.all && myTypes.length) request = request.in("truck_type", myTypes);
  const { data } = await request;
  const countryOf = (id: string) => places.get(id)?.country;
  const loads = ((data ?? []) as Load[]).filter((l) => (!query.from || countryOf(l.origin_id) === query.from) && (!query.to || countryOf(l.destination_id) === query.to));
  const bids = new Map((myBids ?? []).map((b) => [b.load_id, b]));
  // Return loads: loads leaving the towns my free trucks are heading to (or are at), so trucks don't come back empty.
  const towns = new Set((free ?? []).flatMap((f) => [f.heading_to, f.place_id]).filter(Boolean) as string[]);
  const returns = loads.filter((l) => towns.has(l.origin_id)).slice(0, 5);
  const busy = (lanes ?? []) as { origin_id: string; destination_country: string; open_loads: number; avg_price_per_km: number }[];
  const countries = Object.entries(COUNTRY_NAMES);
  return <div>
    <PageHeader title="Find loads" description={myTypes.length && !truck && !query.all ? `Showing loads for your trucks (${myTypes.map((t) => TRUCK_TYPES[t as keyof typeof TRUCK_TYPES]?.short).join(", ")}).` : "Open loads from shippers across the region."} />
    <form className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <select name="truck" defaultValue={truck} className={selectClass} aria-label="Truck type"><option value="">My truck types</option>{TRUCK_TYPE_KEYS.map((k) => <option key={k} value={k}>{TRUCK_TYPES[k].short}</option>)}</select>
      <select name="from" defaultValue={query.from ?? ""} className={selectClass} aria-label="From country"><option value="">From anywhere</option>{countries.map(([code, name]) => <option key={code} value={code}>From {name}</option>)}</select>
      <select name="to" defaultValue={query.to ?? ""} className={selectClass} aria-label="To country"><option value="">To anywhere</option>{countries.map(([code, name]) => <option key={code} value={code}>To {name}</option>)}</select>
      <Button type="submit" variant="outline"><Search className="mr-2 h-4 w-4" />Filter</Button>
      <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" name="instant" value="1" defaultChecked={Boolean(query.instant)} className="accent-[hsl(var(--primary))]" />Only loads I can book now at the shipper&apos;s price</label>
      <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" name="part" value="1" defaultChecked={Boolean(query.part)} className="accent-[hsl(var(--primary))]" />Only part loads (fill the space left on a truck)</label>
    </form>
    {busy.length ? <section className="mb-6 rounded-lg border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Flame className="h-4 w-4 text-primary" />Busy lanes this week</h2>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{busy.map((lane) => <div key={`${lane.origin_id}-${lane.destination_country}`} className="min-w-40 rounded-md bg-secondary px-3 py-2 text-xs">
        <p className="font-semibold">{places.get(lane.origin_id)?.name} → {COUNTRY_NAMES[lane.destination_country] ?? lane.destination_country}</p>
        <p className="text-muted-foreground">{lane.open_loads} load{lane.open_loads > 1 ? "s" : ""} · about KES {lane.avg_price_per_km}/km</p>
      </div>)}</div>
      <p className="mt-2 text-xs text-muted-foreground">Mark a truck free in <Link href="/fleet" className="font-semibold text-primary">Fleet</Link> to be texted first when loads come up near it.</p>
    </section> : null}
    {returns.length ? <section className="mb-6"><h2 className="mb-3 flex items-center gap-2 font-semibold"><RotateCcw className="h-4 w-4 text-primary" />Return loads for your free trucks</h2><div className="space-y-3">{returns.map((load) => <LoadCard key={load.id} load={load} places={places} href={`/board/${load.id}`} showStatus={false} />)}</div></section> : null}
    {loads.length ? <div className="space-y-3">{loads.map((load) => {
      const bid = bids.get(load.id);
      return <LoadCard key={load.id} load={load} places={places} href={`/board/${load.id}`} showStatus={false}
        extra={bid ? <p className="text-sm font-medium text-primary">Your bid: KES {bid.amount.toLocaleString("en-KE")} ({bid.status})</p> : null} />;
    })}</div> : <EmptyState title="No open loads match" description="New loads come in through the day, and we email you when one fits your trucks." action={!query.all ? <Button variant="outline" asChild><Link href="/board?all=1">Show all truck types</Link></Button> : null} />}
  </div>;
}
