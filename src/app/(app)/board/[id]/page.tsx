import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Flash, PageHeader } from "@/components/app/page-header";
import { RouteLine } from "@/components/loads/load-card";
import { BidForm } from "@/components/loads/bid-form";
import { SubmitButton } from "@/components/submit-button";
import { instantBook, withdrawBid } from "@/app/actions/bids";
import { requireRole } from "@/lib/auth";
import { placeMap } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";
import { TRUCK_TYPES } from "@/lib/pricing";
import { CARGO_TYPES, PICKUP_WINDOWS } from "@/lib/trips";
import { carrierPayout, percent } from "@/lib/commission";
import { Zap } from "lucide-react";
import { commissionBps } from "@/lib/commission";
import type { LoadStop } from "@/lib/types";
import { formatDate, formatKes } from "@/lib/utils";
import type { Bid, Load, PlatformSettings } from "@/lib/types";

export const metadata: Metadata = { title: "Load" };

export default async function BoardLoadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }, { user, carrier }] = await Promise.all([params, searchParams, requireRole("carrier")]);
  const supabase = await createClient();
  const [{ data: load }, { data: bid }, { data: settings }, { data: trip }, { data: stopRows }, places] = await Promise.all([
    supabase.from("loads").select("*").eq("id", id).maybeSingle(),
    supabase.from("bids").select("*").eq("load_id", id).eq("carrier_id", user.id).maybeSingle(),
    supabase.from("platform_settings").select("*").single(),
    supabase.from("trips").select("id").eq("load_id", id).eq("carrier_id", user.id).neq("status", "cancelled").maybeSingle(),
    supabase.from("load_stops").select("*").eq("load_id", id).order("seq"),
    placeMap(),
  ]);
  if (!load) notFound();
  const l = load as Load;
  const b = bid as Bid | null;
  const bps = commissionBps(carrier, settings as PlatformSettings);
  const origin = places.get(l.origin_id);
  const destination = places.get(l.destination_id);
  const stops = (stopRows ?? []) as LoadStop[];
  const { data: shipper } = await supabase.from("profiles").select("rating_avg, rating_count").eq("id", l.shipper_id).maybeSingle();
  return <div className="max-w-3xl">
    <Flash error={error} />
    <PageHeader title={`${origin?.name} → ${destination?.name}`} description={`${l.ref} · pickup ${formatDate(l.pickup_date)}`} actions={trip ? <Button asChild><Link href={`/trips/${trip.id}`}>You won this: open the trip</Link></Button> : null} />
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <div className="rounded-lg border bg-card p-5 text-sm">
        <RouteLine from={origin} to={destination} />
        <dl className="mt-4 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
          <dt className="text-muted-foreground">Pickup area</dt><dd>{l.origin_detail || origin?.name}{l.pickup_window !== "anytime" ? ` · ${PICKUP_WINDOWS[l.pickup_window].toLowerCase()}` : ""}</dd>
          {stops.map((stop) => <Fragment key={stop.id}><dt className="text-muted-foreground">Stop {stop.seq}</dt><dd>{stop.kind === "pickup" ? "Pick up at " : "Drop at "}{stop.detail || places.get(stop.place_id)?.name}</dd></Fragment>)}
          <dt className="text-muted-foreground">Drop-off area</dt><dd>{l.destination_detail || destination?.name}</dd>
          <dt className="text-muted-foreground">Goods</dt><dd>{CARGO_TYPES[l.cargo_type]}: {l.cargo_description}</dd>
          <dt className="text-muted-foreground">Weight</dt><dd>{Number(l.weight_tonnes)} t</dd>
          <dt className="text-muted-foreground">Truck</dt><dd>{TRUCK_TYPES[l.truck_type]?.label}</dd>
          <dt className="text-muted-foreground">Distance</dt><dd>about {l.distance_km.toLocaleString()} km{l.border_crossings ? `, ${l.border_crossings} border crossing${l.border_crossings > 1 ? "s" : ""}` : ""}</dd>
          {l.notes ? <><dt className="text-muted-foreground">Notes</dt><dd>{l.notes}</dd></> : null}
          <dt className="text-muted-foreground">Shipper</dt><dd>{shipper?.rating_count ? `${Number(shipper.rating_avg).toFixed(1)} stars from ${shipper.rating_count} carriers` : "New on Vemi"}</dd>
          {l.require_codes ? <><dt className="text-muted-foreground">Codes</dt><dd>Your driver enters a pickup code to load and the receiver&apos;s code to finish.</dd></> : null}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">Contact names and phone numbers are shared once the shipper books you and pays. Vemi pays you to M-Pesa within 24 hours of confirmed delivery.</p>
      </div>
      <div className="space-y-3">
        <div className="rounded-lg border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Shipper offers</p><p className="text-2xl font-bold">{formatKes(l.price)}</p><p className="text-xs text-muted-foreground">You get {formatKes(carrierPayout(l.price, bps))} after Vemi&apos;s {percent(bps)}</p></div>
        {l.status === "open" && l.instant_book && !trip ? <form action={instantBook}><input type="hidden" name="loadId" value={l.id} /><SubmitButton size="lg" className="w-full" pendingLabel="Booking…"><Zap className="mr-2 h-4 w-4" />Book now at {formatKes(l.price)}</SubmitButton><p className="mt-1 text-center text-xs text-muted-foreground">First verified truck wins. Or send a different price below.</p></form> : null}
        {l.status === "open" && b?.status !== "accepted" ? <BidForm loadId={l.id} offered={l.price} bps={bps} current={b?.status === "pending" ? b.amount : null} currentNote={b?.note ?? ""} /> : <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">This load is no longer taking bids.</p>}
        {b?.status === "pending" ? <form action={withdrawBid}><input type="hidden" name="bidId" value={b.id} /><input type="hidden" name="loadId" value={l.id} /><SubmitButton variant="ghost" className="w-full" pendingLabel="…">Withdraw my bid ({formatKes(b.amount)})</SubmitButton></form> : null}
      </div>
    </div>
  </div>;
}
