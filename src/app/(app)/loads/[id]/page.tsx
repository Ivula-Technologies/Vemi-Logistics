import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flash, PageHeader, EmptyState } from "@/components/app/page-header";
import { LoadStatusBadge } from "@/components/app/status-badge";
import { RouteLine } from "@/components/loads/load-card";
import { SubmitButton } from "@/components/submit-button";
import { acceptBid, cancelLoad, updateLoadPrice } from "@/app/actions/loads";
import { requireRole } from "@/lib/auth";
import { placeMap } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";
import { TRUCK_TYPES } from "@/lib/pricing";
import { CARGO_TYPES } from "@/lib/trips";
import { displayPhone } from "@/lib/phone";
import { formatDate, formatDateTime, formatKes } from "@/lib/utils";
import type { Bid, Carrier, Load, LoadContacts } from "@/lib/types";

export const metadata: Metadata = { title: "Load" };

export default async function LoadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string; posted?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await requireRole("shipper", "admin");
  const supabase = await createClient();
  const [{ data: load }, { data: contacts }, { data: bidRows }, { data: trip }, places] = await Promise.all([
    supabase.from("loads").select("*").eq("id", id).maybeSingle(),
    supabase.from("load_contacts").select("*").eq("load_id", id).maybeSingle(),
    supabase.from("bids").select("*, carriers(business_name, base_town, rating_avg, rating_count, verified_at, cross_border)").eq("load_id", id).order("amount"),
    supabase.from("trips").select("id, status").eq("load_id", id).neq("status", "cancelled").maybeSingle(),
    placeMap(),
  ]);
  if (!load) notFound();
  const l = load as Load;
  const c = contacts as LoadContacts | null;
  const bids = (bidRows ?? []) as (Bid & { carriers: Pick<Carrier, "business_name" | "base_town" | "rating_avg" | "rating_count" | "verified_at" | "cross_border"> | null })[];
  const pending = bids.filter((b) => b.status === "pending");
  const origin = places.get(l.origin_id);
  const destination = places.get(l.destination_id);
  return <div className="max-w-4xl">
    <Flash error={query.error} saved={query.posted ? "posted" : query.saved} savedText={{ posted: "Your load is live. Verified carriers with the right truck have been told. Bids appear below.", reopened: "Booking cancelled. Your load is open for bids again.", 1: "Price updated." }} />
    <PageHeader title={`${origin?.name ?? ""} → ${destination?.name ?? ""}`} description={<span className="inline-flex flex-wrap items-center gap-2">{l.ref} <LoadStatusBadge status={l.status} /></span>}
      actions={trip ? <Button asChild><Link href={`/trips/${trip.id}`}>Open the trip</Link></Button> : null} />
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        <h2 className="mb-3 font-semibold">Bids {pending.length ? `(${pending.length})` : ""}</h2>
        {l.status === "open" && !pending.length ? <EmptyState title="No bids yet" description="Most loads get their first bid within a few hours. Raising your price brings bids faster." /> : null}
        <div className="space-y-3">
          {bids.filter((b) => b.status === "pending" || b.status === "accepted").map((bid) => <div key={bid.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="Verified" />{bid.carriers?.business_name ?? "Verified carrier"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {bid.carriers?.rating_count ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(bid.carriers.rating_avg).toFixed(1)} ({bid.carriers.rating_count} trips)</span> : "New on Vemi"}
                  {bid.carriers?.base_town ? ` · based in ${bid.carriers.base_town}` : ""}{bid.carriers?.cross_border ? " · cross-border" : ""}
                </p>
                {bid.note ? <p className="mt-2 text-sm">“{bid.note}”</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(bid.updated_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{formatKes(bid.amount)}</p>
                {bid.amount < l.price ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{formatKes(l.price - bid.amount)} under your price</p> : bid.amount > l.price ? <p className="text-xs text-muted-foreground">{formatKes(bid.amount - l.price)} over your price</p> : <p className="text-xs text-muted-foreground">at your price</p>}
              </div>
            </div>
            {bid.status === "pending" && l.status === "open" ? <form action={acceptBid} className="mt-3">
              <input type="hidden" name="bidId" value={bid.id} /><input type="hidden" name="loadId" value={l.id} />
              <SubmitButton className="w-full sm:w-auto" pendingLabel="Booking…">Book this truck for {formatKes(bid.amount)}</SubmitButton>
            </form> : bid.status === "accepted" ? <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">Booked</p> : null}
          </div>)}
        </div>
      </section>
      <aside className="space-y-4">
        <div className="rounded-lg border bg-card p-4 text-sm">
          <RouteLine from={origin} to={destination} />
          <dl className="mt-3 space-y-2">
            <Row label="Pickup">{formatDate(l.pickup_date)}{l.origin_detail ? `, ${l.origin_detail}` : ""}</Row>
            <Row label="Drop-off">{l.destination_detail || destination?.name}</Row>
            <Row label="Goods">{CARGO_TYPES[l.cargo_type]}: {l.cargo_description}</Row>
            <Row label="Weight">{Number(l.weight_tonnes)} t</Row>
            <Row label="Truck">{TRUCK_TYPES[l.truck_type]?.label}</Row>
            <Row label="Distance">about {l.distance_km.toLocaleString()} km{l.border_crossings ? `, ${l.border_crossings} border${l.border_crossings > 1 ? "s" : ""}` : ""}</Row>
            <Row label="Guide price">{formatKes(l.guide_price)}</Row>
            <Row label="Your price">{formatKes(l.price)}</Row>
            {c?.pickup_phone ? <Row label="Pickup contact">{[c.pickup_name, displayPhone(c.pickup_phone)].filter(Boolean).join(", ")}</Row> : null}
            {c?.dropoff_phone ? <Row label="Drop-off contact">{[c.dropoff_name, displayPhone(c.dropoff_phone)].filter(Boolean).join(", ")}</Row> : null}
            {l.notes ? <Row label="Notes">{l.notes}</Row> : null}
          </dl>
        </div>
        {l.status === "open" ? <>
          <form action={updateLoadPrice} className="space-y-2 rounded-lg border bg-card p-4">
            <input type="hidden" name="loadId" value={l.id} />
            <label htmlFor="price" className="text-sm font-semibold">Change your price</label>
            <div className="flex gap-2"><Input id="price" name="price" type="number" min="1000" step="500" defaultValue={l.price} /><SubmitButton variant="outline" pendingLabel="…">Save</SubmitButton></div>
          </form>
          <form action={cancelLoad}><input type="hidden" name="loadId" value={l.id} /><SubmitButton variant="ghost" className="w-full text-destructive" pendingLabel="Cancelling…">Cancel this load</SubmitButton></form>
        </> : null}
      </aside>
    </div>
  </div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[100px_1fr] gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{children}</dd></div>;
}
