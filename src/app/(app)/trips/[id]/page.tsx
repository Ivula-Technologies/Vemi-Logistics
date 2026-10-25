import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Camera, CheckCircle2, Landmark, MapPin, Phone, Star, Truck as TruckIcon, UserRound } from "lucide-react";
import { Flash, PageHeader } from "@/components/app/page-header";
import { TripStatusBadge } from "@/components/app/status-badge";
import { Field, selectClass } from "@/components/app/field";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { TripMap } from "@/components/app/trip-map";
import { MpesaPay } from "@/components/trips/pay-panel";
import { CarrierStatusButtons } from "@/components/trips/status-buttons";
import { ShareDriverLink } from "@/components/trips/share-driver-link";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { assignTrip, cancelBooking, carrierUpdateTrip, chooseBankTransfer, confirmDelivery, raiseDispute, rateTrip, uploadPodAsCarrier } from "@/app/actions/trips";
import { cancelTripAsAdmin, recordBankPayment, resolveDispute } from "@/app/actions/admin";
import { getSession } from "@/lib/auth";
import { placeMap } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";
import { smsConfigured } from "@/lib/notify";
import { mpesaConfigured } from "@/lib/mpesa";
import { TRUCK_TYPES } from "@/lib/pricing";
import { CARGO_TYPES, LIVE_STATUSES, PAYMENT_COLUMNS, PROGRESS, TRIP_COLUMNS, TRIP_STATUS, nextSteps, progressIndex } from "@/lib/trips";
import { displayPhone } from "@/lib/phone";
import { percent } from "@/lib/commission";
import { cn, formatDate, formatDateTime, formatKes } from "@/lib/utils";
import type { Driver, Load, LoadContacts, Payment, Payout, PlatformSettings, Profile, Trip, TripEvent, TripLocation, Truck } from "@/lib/types";

export const metadata: Metadata = { title: "Trip" };

const SAVED: Record<string, string> = {
  assigned: "Truck and driver saved.", status: "Trip updated.", pod: "Delivery photo uploaded.", confirmed: "Delivery confirmed. Thank you for using Vemi!",
  disputed: "We've got it. Vemi support will call you within one working day; the carrier's payout is on hold.", rated: "Thanks for the rating.",
  payment: "Bank payment recorded.", dispute: "Dispute updated.", cancelled: "Trip cancelled.",
};

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string; booked?: string; pay?: string }> }) {
  const [{ id }, query, { user, profile }] = await Promise.all([params, searchParams, getSession()]);
  const supabase = await createClient();
  const { data: tripRow } = await supabase.from("trips").select(TRIP_COLUMNS).eq("id", id).maybeSingle();
  if (!tripRow) notFound();
  const trip = tripRow as unknown as Trip;
  const viewer = profile.role === "admin" ? "admin" : trip.carrier_id === user.id ? "carrier" : "shipper";

  const [{ data: load }, { data: contacts }, { data: events }, { data: locations }, { data: carrier }, { data: counterpart }, { data: truck }, { data: driver }, { data: myRating }, places] = await Promise.all([
    supabase.from("loads").select("*").eq("id", trip.load_id).single(),
    supabase.from("load_contacts").select("*").eq("load_id", trip.load_id).maybeSingle(),
    supabase.from("trip_events").select("*").eq("trip_id", id).order("created_at", { ascending: false }),
    supabase.from("trip_locations").select("lat, lng, recorded_at").eq("trip_id", id).order("recorded_at").limit(1000),
    supabase.from("carriers").select("business_name, rating_avg, rating_count").eq("id", trip.carrier_id).maybeSingle(),
    supabase.from("profiles").select("full_name, phone, company").eq("id", viewer === "carrier" ? trip.shipper_id : trip.carrier_id).maybeSingle(),
    trip.truck_id ? supabase.from("trucks").select("*").eq("id", trip.truck_id).maybeSingle() : Promise.resolve({ data: null }),
    trip.driver_id ? supabase.from("drivers").select("*").eq("id", trip.driver_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("ratings").select("stars").eq("trip_id", id).eq("rater_id", user.id).maybeSingle(),
    placeMap(),
  ]);
  const l = load as Load;
  const c = contacts as LoadContacts | null;
  const origin = places.get(l.origin_id)!;
  const destination = places.get(l.destination_id)!;
  const live = (LIVE_STATUSES as string[]).includes(trip.status);
  const balance = trip.price - trip.amount_paid;
  const other = counterpart as Pick<Profile, "full_name" | "phone" | "company"> | null;
  const t = truck as Truck | null;
  const d = driver as Driver | null;
  const step = progressIndex(trip.status);

  // Carrier-only data: their fleet for assignment and the driver link.
  let fleet: { trucks: Truck[]; drivers: Driver[] } = { trucks: [], drivers: [] };
  let driverLink: string | null = null;
  if (viewer === "carrier") {
    const [{ data: trucks }, { data: drivers }, { data: token }] = await Promise.all([
      supabase.from("trucks").select("*").eq("carrier_id", user.id).eq("active", true),
      supabase.from("drivers").select("*").eq("carrier_id", user.id).eq("active", true),
      supabase.rpc("trip_driver_token", { p_trip: id }),
    ]);
    fleet = { trucks: (trucks ?? []) as Truck[], drivers: (drivers ?? []) as Driver[] };
    if (token) driverLink = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/d/${token}`;
  }
  let payments: Payment[] = [];
  let payout: Payout | null = null;
  let settings: PlatformSettings | null = null;
  if (viewer !== "carrier") {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("payments").select(PAYMENT_COLUMNS).eq("trip_id", id).order("created_at", { ascending: false }),
      supabase.from("platform_settings").select("*").single(),
    ]);
    payments = (p ?? []) as unknown as Payment[];
    settings = s as PlatformSettings | null;
  }
  if (viewer !== "shipper") {
    const { data } = await supabase.from("payouts").select("*").eq("trip_id", id).maybeSingle();
    payout = data as Payout | null;
  }
  const bankDetails = process.env.VEMI_BANK_DETAILS?.replace(/\\n/g, "\n");

  return <div className="max-w-5xl">
    {live || trip.status === "awaiting_payment" ? <AutoRefresh seconds={live ? 30 : 20} /> : null}
    <Flash error={query.error} saved={query.booked ? "booked" : query.saved} savedText={{ ...SAVED, booked: "Booked! Pay now so the carrier can dispatch the truck." }} />
    <PageHeader title={`${origin.name} → ${destination.name}`} description={<span className="inline-flex flex-wrap items-center gap-2">{trip.ref} <TripStatusBadge status={trip.status} /></span>} />

    {trip.status !== "cancelled" ? <ol className="mb-6 grid grid-cols-7 gap-1" aria-label="Trip progress">
      {PROGRESS.map((s, i) => <li key={s} className="min-w-0"><div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} /><p className={cn("mt-1 hidden truncate text-[11px] sm:block", i === step ? "font-semibold" : "text-muted-foreground")}>{TRIP_STATUS[s].label.split(",")[0]}</p></li>)}
    </ol> : null}

    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* What to do next, by role */}
        {viewer === "shipper" && trip.status === "awaiting_payment" ? <Panel title={`Pay ${formatKes(balance)} to dispatch the truck`}>
          <p className="mb-3 text-sm text-muted-foreground">Vemi holds the booking and pays the carrier after you confirm delivery. Nothing moves until you pay.</p>
          <MpesaPay tripId={trip.id} amount={balance} defaultPhone={displayPhone(profile.phone)} disabledReason={!mpesaConfigured() ? "M-Pesa payments are being switched on. Use bank transfer for now." : settings && balance > settings.mpesa_max_kes ? `M-Pesa takes up to ${formatKes(settings.mpesa_max_kes)} at a time, so pay this trip by bank transfer.` : undefined} />
          <details className="mt-4 rounded-md border p-3 text-sm" open={query.pay === "bank"}>
            <summary className="flex cursor-pointer items-center gap-2 font-semibold"><Landmark className="h-4 w-4" />Pay by bank transfer instead</summary>
            {bankDetails ? <pre className="mt-2 whitespace-pre-wrap font-sans">{bankDetails}</pre> : <p className="mt-2 text-muted-foreground">Call or WhatsApp Vemi for our bank details.</p>}
            <p className="mt-2">Use <strong>{trip.ref}</strong> as the reference. We release the truck as soon as the money lands (usually same day).</p>
            {query.pay === "bank" ? <p className="mt-2 font-semibold text-emerald-700 dark:text-emerald-400">Thanks, we&apos;ve told the Vemi team to look out for it.</p> : <form action={chooseBankTransfer} className="mt-2"><input type="hidden" name="tripId" value={trip.id} /><SubmitButton size="sm" variant="outline" pendingLabel="…">I&apos;ll pay by bank</SubmitButton></form>}
          </details>
          <form action={cancelBooking} className="mt-4 flex gap-2"><input type="hidden" name="tripId" value={trip.id} /><input type="hidden" name="reason" value="Cancelled before payment" /><SubmitButton size="sm" variant="ghost" className="text-destructive" pendingLabel="…">Cancel this booking</SubmitButton></form>
        </Panel> : null}

        {viewer === "shipper" && trip.status === "delivered" ? <Panel title="Did everything arrive?">
          <p className="mb-3 text-sm text-muted-foreground">Check the goods, then confirm so the carrier is paid. If you do nothing, it confirms automatically 48 hours after delivery.</p>
          {trip.pod_path ? <a href={`/api/files/pod/${trip.id}`} target="_blank" rel="noreferrer" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"><Camera className="h-4 w-4" />See the delivery photo</a> : null}
          <form action={confirmDelivery}><input type="hidden" name="tripId" value={trip.id} /><SubmitButton className="w-full sm:w-auto" pendingLabel="Confirming…"><CheckCircle2 className="mr-2 h-4 w-4" />Yes, confirm delivery</SubmitButton></form>
          <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-destructive">Something is wrong</summary>
            <form action={raiseDispute} className="mt-2 space-y-2"><input type="hidden" name="tripId" value={trip.id} /><Textarea name="reason" rows={3} minLength={10} required placeholder="What's missing or damaged? How many units?" /><SubmitButton variant="destructive" size="sm" pendingLabel="Sending…">Report a problem</SubmitButton></form>
          </details>
        </Panel> : null}

        {viewer === "carrier" && ["awaiting_payment", "scheduled", "to_pickup"].includes(trip.status) ? <Panel title={trip.truck_id ? "Truck and driver" : "Assign a truck and driver"}>
          {trip.status === "awaiting_payment" ? <p className="mb-3 rounded-md bg-amber-500/10 px-3 py-2 text-sm">Waiting for the shipper to pay. Get ready now; you&apos;ll get an SMS the moment it&apos;s paid.</p> : null}
          {fleet.trucks.length && fleet.drivers.length ? <form action={assignTrip} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="tripId" value={trip.id} />
            <Field label="Truck" htmlFor="truckId"><select id="truckId" name="truckId" className={selectClass} defaultValue={trip.truck_id ?? ""} required><option value="" disabled>Choose</option>{fleet.trucks.map((x) => <option key={x.id} value={x.id}>{x.plate} · {TRUCK_TYPES[x.truck_type]?.short}</option>)}</select></Field>
            <Field label="Driver" htmlFor="driverId"><select id="driverId" name="driverId" className={selectClass} defaultValue={trip.driver_id ?? ""} required><option value="" disabled>Choose</option>{fleet.drivers.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field>
            {smsConfigured() ? <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="smsDriver" defaultChecked className="accent-[hsl(var(--primary))]" />Text the driver their trip link</label> : null}
            <div className="sm:col-span-2"><SubmitButton variant={trip.truck_id ? "outline" : "default"} pendingLabel="Saving…">{trip.truck_id ? "Change" : "Assign"}</SubmitButton></div>
          </form> : <p className="text-sm">Add a truck and a driver in <a className="font-semibold text-primary underline" href="/fleet">Fleet</a> first.</p>}
          {driverLink && trip.driver_id ? <div className="mt-4 border-t pt-4"><p className="mb-2 text-sm font-semibold">Driver&apos;s trip link</p><p className="mb-3 text-sm text-muted-foreground">The driver opens it on their phone to see pickup details and tap each step. Location is shared only while it&apos;s open.</p><ShareDriverLink url={driverLink} driverPhone={d?.phone ?? null} tripRef={trip.ref} /></div> : null}
        </Panel> : null}

        {viewer === "carrier" && nextSteps(trip.status, l.border_crossings > 0).length ? <Panel title="Update the trip">
          <p className="mb-3 text-sm text-muted-foreground">Your driver can do this from their link. Each update tells the shipper.</p>
          <CarrierStatusButtons tripId={trip.id} steps={nextSteps(trip.status, l.border_crossings > 0)} action={carrierUpdateTrip} />
        </Panel> : null}

        {viewer === "carrier" && ["in_transit", "at_border", "delivered"].includes(trip.status) && !trip.pod_path ? <Panel title="Delivery photo">
          <form action={uploadPodAsCarrier} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="tripId" value={trip.id} /><Input name="file" type="file" accept="image/*,application/pdf" capture="environment" required /><SubmitButton variant="outline" pendingLabel="Uploading…"><Camera className="mr-2 h-4 w-4" />Upload</SubmitButton></form>
          <p className="mt-2 text-xs text-muted-foreground">A photo of the signed delivery note speeds up confirmation and your payout.</p>
        </Panel> : null}

        {viewer !== "admin" && trip.status === "completed" ? <Panel title={myRating ? "Thanks for rating" : `Rate the ${viewer === "shipper" ? "carrier" : "shipper"}`}>
          <form action={rateTrip} className="space-y-3"><input type="hidden" name="tripId" value={trip.id} />
            <div className="flex gap-1" role="radiogroup" aria-label="Stars">{[1, 2, 3, 4, 5].map((n) => <label key={n} className="cursor-pointer"><input type="radio" name="stars" value={n} defaultChecked={myRating?.stars === n} className="peer sr-only" required /><Star className="h-8 w-8 text-muted-foreground peer-checked:fill-amber-400 peer-checked:text-amber-400" /><span className="sr-only">{n} stars</span></label>)}</div>
            <Input name="comment" placeholder="Anything to add? (optional)" maxLength={500} />
            <SubmitButton size="sm" variant="outline" pendingLabel="…">{myRating ? "Update rating" : "Send rating"}</SubmitButton>
          </form>
        </Panel> : null}

        {viewer === "admin" ? <Panel title="Vemi ops">
          <div className="space-y-5 text-sm">
            {trip.status === "awaiting_payment" ? <form action={recordBankPayment} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><input type="hidden" name="tripId" value={trip.id} />
              <Field label="Bank amount received" htmlFor="amount"><Input id="amount" name="amount" type="number" defaultValue={balance} required /></Field>
              <Field label="Bank reference" htmlFor="reference"><Input id="reference" name="reference" required /></Field>
              <SubmitButton pendingLabel="…">Record</SubmitButton></form> : null}
            {trip.status === "disputed" ? <form action={resolveDispute} className="space-y-2"><input type="hidden" name="tripId" value={trip.id} />
              <p><strong>Dispute:</strong> {trip.dispute_reason}</p>
              <Input name="note" placeholder="What you decided and why" />
              <div className="flex flex-wrap gap-2"><SubmitButton name="outcome" value="pay_carrier" pendingLabel="…">Release payout</SubmitButton><SubmitButton name="outcome" value="hold" variant="outline" pendingLabel="…">Keep payout on hold</SubmitButton></div>
            </form> : null}
            {!["completed", "cancelled"].includes(trip.status) ? <details><summary className="cursor-pointer font-semibold text-destructive">Cancel this trip</summary>
              <form action={cancelTripAsAdmin} className="mt-2 space-y-2"><input type="hidden" name="tripId" value={trip.id} /><Input name="reason" placeholder="Reason" required />
                <label className="flex items-center gap-2"><input type="checkbox" name="reopen" defaultChecked />Put the load back on the board</label>
                {trip.amount_paid > 0 ? <p className="text-amber-700">The shipper paid {formatKes(trip.amount_paid)}. Refund them by M-Pesa or bank and note it in the reason.</p> : null}
                <SubmitButton variant="destructive" size="sm" pendingLabel="…">Cancel trip</SubmitButton></form></details> : null}
          </div>
        </Panel> : null}

        <section className="overflow-hidden rounded-lg border bg-card">
          <TripMap origin={origin} destination={destination} path={(locations ?? []) as TripLocation[]} className="h-72 w-full" />
          {live ? <p className="flex items-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-primary" />{(locations ?? []).length ? `Last position ${formatDateTime((locations as TripLocation[]).at(-1)!.recorded_at)}` : "Waiting for the driver's first position."} The page updates every 30 seconds.</p> : null}
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Timeline</h2>
          <ol className="space-y-3 border-l-2 pl-5">{((events ?? []) as TripEvent[]).map((e) => <li key={e.id} className="relative text-sm">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
            <p className="font-medium">{TRIP_STATUS[e.status as keyof typeof TRIP_STATUS]?.label ?? e.status}</p>
            {e.note ? <p className="text-muted-foreground">{e.note}</p> : null}
            <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)} · {e.actor === "system" ? "Vemi" : e.actor}</p>
          </li>)}</ol>
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{viewer === "carrier" ? "Your payout" : "Trip price"}</p>
          <p className="text-2xl font-bold">{formatKes(viewer === "carrier" ? trip.carrier_payout : trip.price)}</p>
          {viewer !== "shipper" ? <p className="mt-1 text-muted-foreground">Trip {formatKes(trip.price)} − Vemi {percent(trip.commission_bps)} ({formatKes(trip.commission)})</p> : null}
          {viewer !== "carrier" ? <p className="mt-1 text-muted-foreground">Paid {formatKes(trip.amount_paid)}{balance > 0 && trip.status !== "cancelled" ? ` · ${formatKes(balance)} to pay` : ""}</p> : null}
          {payout ? <p className="mt-2 font-medium">{payout.status === "paid" ? `Paid ${formatDate(payout.paid_at)} (ref ${payout.reference})` : payout.status === "held" ? "Payout on hold (dispute)" : "Payout queued: within 24 hours"}</p> : null}
          {payments.filter((p) => p.status === "paid").map((p) => <p key={p.id} className="mt-1 text-xs text-muted-foreground">{p.method === "mpesa" ? "M-Pesa" : "Bank"} {formatKes(p.amount)} {p.receipt ? `· ${p.receipt}` : ""} · {formatDate(p.paid_at)}</p>)}
        </div>
        <div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
          <p className="font-semibold">Load {l.ref}</p>
          <p>{CARGO_TYPES[l.cargo_type]}: {l.cargo_description}</p>
          <p className="text-muted-foreground">{Number(l.weight_tonnes)} t · {TRUCK_TYPES[l.truck_type]?.label} · pickup {formatDate(l.pickup_date)}</p>
          <p><span className="text-muted-foreground">From:</span> {l.origin_detail || origin.name}</p>
          <p><span className="text-muted-foreground">To:</span> {l.destination_detail || destination.name}</p>
          {l.notes ? <p><span className="text-muted-foreground">Notes:</span> {l.notes}</p> : null}
          {c ? <>
            {c.pickup_phone ? <Contact label="Pickup contact" name={c.pickup_name} phone={c.pickup_phone} /> : null}
            {c.dropoff_phone ? <Contact label="Drop-off contact" name={c.dropoff_name} phone={c.dropoff_phone} /> : null}
          </> : viewer === "carrier" ? <p className="text-xs text-muted-foreground">Pickup and drop-off contacts appear once the shipper pays.</p> : null}
          {trip.pod_path ? <a href={`/api/files/pod/${trip.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary"><Camera className="h-4 w-4" />Delivery photo</a> : null}
        </div>
        <div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
          <p className="font-semibold">{viewer === "carrier" ? "Shipper" : "Carrier"}</p>
          {viewer !== "carrier" ? <p className="flex items-center gap-1.5">{carrier?.business_name}{carrier?.rating_count ? <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(carrier.rating_avg).toFixed(1)}</span> : null}</p> : null}
          {other ? <Contact label={viewer === "carrier" ? (other.company || "Contact") : "Owner"} name={other.full_name} phone={other.phone} /> : <p className="text-xs text-muted-foreground">Phone numbers are shared once the trip is paid.</p>}
          {t ? <p className="flex items-center gap-2"><TruckIcon className="h-4 w-4 text-muted-foreground" />{t.plate} · {TRUCK_TYPES[t.truck_type]?.short}</p> : null}
          {d ? <p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted-foreground" />{d.full_name} · <a className="font-semibold text-primary" href={`tel:+${d.phone}`}>{displayPhone(d.phone)}</a></p> : null}
        </div>
      </aside>
    </div>
  </div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-primary/30 bg-card p-5 shadow-paper"><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>;
}

function Contact({ label, name, phone }: { label: string; name: string | null; phone: string | null }) {
  return <p className="flex flex-wrap items-center gap-1.5"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{label}:</span> {name}{phone ? <a href={`tel:+${phone}`} className="font-semibold text-primary">{displayPhone(phone)}</a> : null}</p>;
}
