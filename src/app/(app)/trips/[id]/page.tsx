import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, Receipt } from "lucide-react";
import { Flash, PageHeader } from "@/components/app/page-header";
import { TripStatusBadge } from "@/components/app/status-badge";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { TripMap } from "@/components/app/trip-map";
import { ShareTrackingLink } from "@/components/trips/share-driver-link";
import { SosButton, TripChat } from "@/components/trips/trip-tools";
import { BorderPapersPanel } from "@/components/trips/border-papers";
import {
  AdminPanel, CarrierAssign, CarrierCancel, CarrierExtras, CarrierMove, ChargesPanel, CodesPanel, CompletedPanel, DeliveredPanel,
  LoadBox, MoneyBox, Panel, PeopleBox, ShipperCancel, ShipperPay,
} from "@/components/trips/panels";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { loadTripView } from "@/lib/trip-view";
import { formatDuration } from "@/lib/eta";
import { LIVE_STATUSES, PROGRESS, TRIP_STATUS, progressIndex } from "@/lib/trips";
import { displayPhone } from "@/lib/phone";
import { cn, formatDateTime, formatKes } from "@/lib/utils";
import type { Message } from "@/lib/types";

export const metadata: Metadata = { title: "Trip" };

const SAVED: Record<string, string> = {
  assigned: "Truck and driver saved.", status: "Trip updated.", stop: "Stop ticked off.", pod: "Delivery photo uploaded.",
  advance: "Fuel advance requested. Vemi sends it to your M-Pesa within the hour.", wallet: "Paid from your Vemi wallet.", paid: "Card payment received. Thank you!",
  credit: "Booked on your account. The truck can go; we'll send the invoice.", "charge-approved": "Charge approved and added to the trip.",
  "charge-declined": "Charge declined. The carrier has been told.", confirmed: "Delivery confirmed. Thank you for using Vemi!",
  disputed: "We've got it. Vemi support will call you within one working day; the carrier's payout is on hold.", rated: "Thanks for the rating.",
  favourite: "Saved as a favourite carrier. You can send loads to your favourites first.", unfavourite: "Removed from your favourites.",
  payment: "Bank payment recorded.", dispute: "Dispute updated.", cancelled: "Trip cancelled.", Saved: "Saved.", "Alert cleared": "Alert cleared.",
  booked: "Booked! Pay now so the carrier can dispatch the truck.", paper: "Border paper added. The other side and the driver can see it.", "paper-removed": "Paper removed.", instant: "Booked instantly! Pay now so the truck can be dispatched.",
};

type Query = { error?: string; saved?: string; booked?: string; pay?: string; off?: string };

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query, { user, profile }] = await Promise.all([params, searchParams, getSession()]);
  const view = await loadTripView(id, user.id, profile.role);
  if (!view) notFound();
  const { trip, load, viewer, origin, destination } = view;
  const live = (LIVE_STATUSES as string[]).includes(trip.status);
  const step = progressIndex(trip.status);
  const defaultPhone = displayPhone(profile.phone);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const me: Message["sender"] = viewer === "admin" ? "vemi" : viewer;
  const access = { kind: "session" as const, tripId: trip.id };
  const saved = query.booked === "instant" ? "instant" : query.booked ? "booked" : query.saved;
  const savedText = { ...SAVED, promo: query.off ? `Promo applied: ${formatKes(Number(query.off))} off.` : "Promo applied." };
  const stopPins = view.stops.flatMap((s) => {
    const place = view.places.get(s.place_id);
    const lat = s.lat ?? place?.lat; const lng = s.lng ?? place?.lng;
    return lat != null && lng != null ? [{ lat, lng, name: s.detail || place?.name || "Stop", done: Boolean(s.done_at) }] : [];
  });
  const pin = (lat: number | null, lng: number | null, fallback: typeof origin) => (lat !== null && lng !== null ? { ...fallback, lat, lng } : fallback);
  const chatOpen = !["cancelled", "awaiting_payment"].includes(trip.status);

  return <div className="max-w-5xl">
    {live || trip.status === "awaiting_payment" ? <AutoRefresh seconds={live ? 30 : 20} /> : null}
    <Flash error={query.error} saved={saved} savedText={savedText} />
    <PageHeader title={`${origin.name} → ${destination.name}`} description={<span className="inline-flex flex-wrap items-center gap-2">{trip.ref} <TripStatusBadge status={trip.status} />{trip.sos_at ? <span className="rounded bg-destructive px-1.5 py-0.5 text-xs font-semibold text-white">SOS</span> : null}</span>}
      actions={viewer !== "carrier" && trip.amount_paid > 0 ? <Button asChild variant="outline" size="sm"><Link href={`/trips/${trip.id}/receipt`}><Receipt className="mr-2 h-4 w-4" />Receipt</Link></Button> : null} />

    {trip.status !== "cancelled" ? <ol className="mb-6 grid grid-cols-7 gap-1" aria-label="Trip progress">
      {PROGRESS.map((s, i) => <li key={s} className="min-w-0"><div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} /><p className={cn("mt-1 hidden truncate text-[11px] sm:block", i === step ? "font-semibold" : "text-muted-foreground")}>{TRIP_STATUS[s].label.split(",")[0]}</p></li>)}
    </ol> : null}

    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* What to do next, by role */}
        {viewer === "shipper" && trip.balance > 0 && !trip.on_credit ? <ShipperPay view={view} defaultPhone={defaultPhone} payState={query.pay} /> : null}
        {viewer === "shipper" ? <CodesPanel view={view} /> : null}
        <ChargesPanel view={view} />
        <BorderPapersPanel view={view} />
        {viewer === "shipper" && trip.status === "delivered" ? <DeliveredPanel view={view} /> : null}
        {viewer !== "admin" && trip.status === "completed" ? <CompletedPanel view={view} defaultPhone={defaultPhone} /> : null}

        {viewer === "carrier" && ["awaiting_payment", "scheduled", "to_pickup"].includes(trip.status) ? <CarrierAssign view={view} /> : null}
        {viewer === "carrier" ? <><CarrierMove view={view} /><CarrierExtras view={view} /></> : null}
        {viewer === "admin" ? <AdminPanel view={view} /> : null}

        <section className="overflow-hidden rounded-lg border bg-card">
          <TripMap origin={pin(load.origin_lat, load.origin_lng, origin)} destination={pin(load.destination_lat, load.destination_lng, destination)} stops={stopPins} path={view.locations} className="h-72 w-full" />
          {live ? <div className="space-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
            {view.eta ? <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Clock className="h-4 w-4 text-primary" />{view.eta.label === "pickup" ? "At pickup" : "Delivery"} in {formatDuration(view.eta.hours)} (around {formatDateTime(view.eta.at)})</p> : null}
            <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" />{view.locations.length ? `Last position ${formatDateTime(view.locations.at(-1)!.recorded_at)}` : "Waiting for the driver's first position."} The page updates every 30 seconds.</p>
          </div> : null}
          {view.shareToken && viewer !== "carrier" && !["completed", "cancelled"].includes(trip.status) ? <div className="border-t px-4 py-3">
            <p className="mb-2 text-sm font-semibold">Share live tracking</p>
            <p className="mb-2 text-xs text-muted-foreground">Send the receiver or your boss a link to follow the truck. It shows the map and arrival time only, no prices or phone numbers.{view.contacts?.dropoff_phone ? " The receiver also gets it by SMS when the truck leaves pickup." : ""}</p>
            <ShareTrackingLink url={`${site}/t/${view.shareToken}`} phone={view.contacts?.dropoff_phone ?? null} tripRef={trip.ref} />
          </div> : null}
        </section>

        {chatOpen || view.messages.length ? <Panel title={viewer === "admin" ? "Trip chat" : `Chat with the ${viewer === "shipper" ? "carrier and driver" : "shipper"}`} id="chat" tone="plain">
          <TripChat access={access} messages={view.messages} me={me} text={{ help: viewer !== "admin" }} />
        </Panel> : null}

        {viewer !== "admin" && live ? <Panel title="Safety" tone="danger"><SosButton access={access} /></Panel> : null}

        {viewer === "shipper" ? <ShipperCancel view={view} /> : null}
        {viewer === "carrier" ? <CarrierCancel view={view} /> : null}

        <section>
          <h2 className="mb-3 font-semibold">Timeline</h2>
          <ol className="space-y-3 border-l-2 pl-5">{view.events.map((e) => <li key={e.id} className="relative text-sm">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
            <p className="font-medium">{TRIP_STATUS[e.status as keyof typeof TRIP_STATUS]?.label ?? e.status}</p>
            {e.note ? <p className="text-muted-foreground">{e.note}</p> : null}
            <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)} · {e.actor === "system" ? "Vemi" : e.actor}</p>
          </li>)}</ol>
        </section>
      </div>

      <aside className="space-y-4">
        <MoneyBox view={view} />
        <LoadBox view={view} />
        <PeopleBox view={view} />
      </aside>
    </div>
  </div>;
}
