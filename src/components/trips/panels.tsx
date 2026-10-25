import Link from "next/link";
import { Camera, CheckCircle2, Copy, Fuel, Heart, KeyRound, Landmark, Phone, Receipt, ShieldCheck, Star, Ticket, Truck as TruckIcon, UserRound, Wallet } from "lucide-react";
import { Field, selectClass } from "@/components/app/field";
import { CardPay, MpesaPay } from "@/components/trips/pay-panel";
import { CarrierStatusButtons } from "@/components/trips/status-buttons";
import { ShareDriverLink } from "@/components/trips/share-driver-link";
import { ChargeForm } from "@/components/trips/charge-form";
import { CallButton } from "@/components/trips/trip-tools";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  applyPromo, assignTrip, bookOnCredit, cancelBooking, carrierCancelTrip, carrierStopDone, carrierUpdateTrip, chooseBankTransfer, confirmDelivery,
  decideCharge, payWithWallet, raiseDispute, rateTrip, requestFuelAdvance, toggleFavourite, uploadPodAsCarrier,
} from "@/app/actions/trips";
import { cancelTripAsAdmin, clearSos, recordBankPayment, resolveDispute } from "@/app/actions/admin";
import { smsConfigured } from "@/lib/notify";
import { mpesaConfigured } from "@/lib/mpesa";
import { kesToUsd, paypalConfigured } from "@/lib/paypal";
import { voiceConfigured } from "@/lib/voice";
import { TRUCK_TYPES } from "@/lib/pricing";
import { ALERTS, BEFORE_LOADING, CARGO_TYPES, CHARGE_KINDS, COMPLIMENTS, ON_THE_ROAD, PICKUP_WINDOWS, nextSteps } from "@/lib/trips";
import { displayPhone } from "@/lib/phone";
import { percent } from "@/lib/commission";
import { formatDate, formatDateTime, formatKes } from "@/lib/utils";
import type { TripView } from "@/lib/trip-view";

function site() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

export function Panel({ title, children, id, tone = "primary" }: { title: string; children: React.ReactNode; id?: string; tone?: "primary" | "danger" | "plain" }) {
  const border = tone === "danger" ? "border-destructive/40" : tone === "plain" ? "" : "border-primary/30";
  return <section id={id} className={`scroll-mt-20 rounded-lg border ${border} bg-card p-5 shadow-paper`}><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>;
}

function Hidden({ tripId }: { tripId: string }) {
  return <input type="hidden" name="tripId" value={tripId} />;
}

export function Contact({ label, name, phone }: { label: string; name: string | null; phone: string | null }) {
  return <p className="flex flex-wrap items-center gap-1.5"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{label}:</span> {name}{phone ? <a href={`tel:+${phone}`} className="font-semibold text-primary">{displayPhone(phone)}</a> : null}</p>;
}

// ---------------------------------------------------------------------------------------------
// Shipper
// ---------------------------------------------------------------------------------------------

/** Everything about paying: what is owed, promo code, wallet, M-Pesa (in parts if big), card, on account, bank. */
export function ShipperPay({ view, defaultPhone, payState }: { view: TripView; defaultPhone: string; payState?: string }) {
  const { trip, settings, wallet, business } = view;
  const limit = settings?.mpesa_max_kes ?? 250000;
  const awaiting = trip.status === "awaiting_payment";
  const canPromo = awaiting && trip.amount_paid === 0 && !trip.on_credit && trip.discount === 0;
  const canCredit = awaiting && business?.credit_status === "approved";
  const bankDetails = process.env.VEMI_BANK_DETAILS?.replace(/\\n/g, "\n");
  const title = awaiting ? `Pay ${formatKes(trip.balance)} to dispatch the truck` : trip.status === "cancelled" ? `Cancellation fee: ${formatKes(trip.balance)} to pay` : `${formatKes(trip.balance)} still to pay`;
  return <Panel title={title}>
    <p className="mb-3 text-sm text-muted-foreground">{awaiting ? "Vemi holds the money and pays the carrier after you confirm delivery. Nothing moves until it's paid." : trip.on_credit ? `On your account: due ${formatDate(trip.credit_due_on)}.` : "Extras added after the trip started (waiting time or approved charges)."}</p>
    <MoneyLines view={view} />
    {canPromo ? <form action={applyPromo} className="mt-4 flex gap-2"><Hidden tripId={trip.id} /><Input name="code" placeholder="Promo code" aria-label="Promo code" className="uppercase" maxLength={20} required /><SubmitButton variant="outline" pendingLabel="…"><Ticket className="mr-2 h-4 w-4" />Apply</SubmitButton></form> : null}
    {wallet > 0 ? <form action={payWithWallet} className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-signal-soft p-3 text-sm"><Hidden tripId={trip.id} /><Wallet className="h-4 w-4 text-primary" /><span className="flex-1">Your Vemi wallet has {formatKes(wallet)}.</span><SubmitButton size="sm" pendingLabel="…">Use {formatKes(Math.min(wallet, trip.balance))}</SubmitButton></form> : null}
    <div className="mt-4 space-y-4">
      <MpesaPay tripId={trip.id} amount={Math.min(trip.balance, limit)} maxAmount={trip.balance > limit ? limit : undefined} defaultPhone={defaultPhone}
        disabledReason={!mpesaConfigured() ? "M-Pesa payments are being switched on. Use another way for now." : undefined} />
      {trip.balance > limit ? <p className="text-xs text-muted-foreground">M-Pesa takes up to {formatKes(limit)} at a time, so pay in parts: the truck is released once the full amount is in.</p> : null}
      {paypalConfigured() ? <CardPay tripId={trip.id} usd={kesToUsd(trip.balance, Number(settings?.usd_rate ?? 129))} /> : null}
      {canCredit ? <form action={bookOnCredit}><Hidden tripId={trip.id} /><SubmitButton variant="outline" className="w-full" pendingLabel="…">Put it on our account (pay in {business!.terms_days} days)</SubmitButton></form> : null}
    </div>
    <details className="mt-4 rounded-md border p-3 text-sm" open={payState === "bank"}>
      <summary className="flex cursor-pointer items-center gap-2 font-semibold"><Landmark className="h-4 w-4" />Pay by bank transfer instead</summary>
      {bankDetails ? <pre className="mt-2 whitespace-pre-wrap font-sans">{bankDetails}</pre> : <p className="mt-2 text-muted-foreground">Call or WhatsApp Vemi for our bank details.</p>}
      <p className="mt-2">Use <strong>{trip.ref}</strong> as the reference. We release the truck as soon as the money lands (usually same day).</p>
      {payState === "bank" ? <p className="mt-2 font-semibold text-emerald-700 dark:text-emerald-400">Thanks, we&apos;ve told the Vemi team to look out for it.</p> : <form action={chooseBankTransfer} className="mt-2"><Hidden tripId={trip.id} /><SubmitButton size="sm" variant="outline" pendingLabel="…">I&apos;ll pay by bank</SubmitButton></form>}
    </details>
  </Panel>;
}

/** Shipper cancel button with the fee rules spelt out. */
export function ShipperCancel({ view }: { view: TripView }) {
  const { trip, settings } = view;
  if (!(BEFORE_LOADING as string[]).includes(trip.status)) return null;
  const fee = Math.min(Math.max(settings?.cancel_fee_min_kes ?? 2000, Math.round((trip.price * (settings?.cancel_fee_bps ?? 1000)) / 10000)), trip.price);
  const moving = trip.status === "to_pickup" || trip.status === "at_pickup";
  return <details className="rounded-lg border bg-card p-4 text-sm">
    <summary className="cursor-pointer font-semibold text-destructive">Cancel this booking</summary>
    <p className="mt-2 text-muted-foreground">{moving ? `The truck is on its way, so a fee of ${formatKes(fee)} goes to the carrier. The rest of what you paid goes back to your Vemi wallet.` : trip.status === "scheduled" ? "Free: the truck hasn't set off. What you paid goes back to your Vemi wallet straight away." : "Free: you haven't paid. Your load goes back on the board for other trucks."}</p>
    <form action={cancelBooking} className="mt-2 flex flex-col gap-2 sm:flex-row"><Hidden tripId={trip.id} /><Input name="reason" placeholder="Why? (optional)" maxLength={300} /><SubmitButton variant="destructive" size="sm" pendingLabel="…">{moving ? `Cancel and pay ${formatKes(fee)}` : "Cancel booking"}</SubmitButton></form>
  </details>;
}

export function CodesPanel({ view }: { view: TripView }) {
  const { trip, codes, load } = view;
  if (!codes || !load.require_codes || ["delivered", "completed", "cancelled", "disputed"].includes(trip.status)) return null;
  const loaded = !(BEFORE_LOADING as string[]).includes(trip.status);
  return <Panel title="Pickup and delivery codes">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={`rounded-md border p-3 ${loaded ? "opacity-60" : ""}`}><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><KeyRound className="h-3.5 w-3.5" />Pickup code</p><p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em]">{codes.pickup}</p><p className="mt-1 text-xs text-muted-foreground">{loaded ? "Used: the goods are loaded." : "Give it to the person loading the truck. The driver can't start without it."}</p></div>
      <div className="rounded-md border p-3"><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><KeyRound className="h-3.5 w-3.5" />Delivery code</p><p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em]">{codes.delivery}</p><p className="mt-1 text-xs text-muted-foreground">For the receiver only. We text it to the drop-off contact when the truck leaves. They give it once the goods are checked.</p></div>
    </div>
  </Panel>;
}

export function ChargesPanel({ view }: { view: TripView }) {
  const { trip, charges, viewer } = view;
  if (!charges.length) return null;
  return <Panel id="charges" title="Extra charges" tone="plain">
    <ul className="space-y-2 text-sm">{charges.map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <div><p className="font-medium">{CHARGE_KINDS[c.kind]}: {formatKes(c.amount)}</p>{c.note ? <p className="text-muted-foreground">{c.note}</p> : null}<p className="text-xs text-muted-foreground">{c.requested_by === "system" ? "Added automatically" : "Asked by the carrier"} · {formatDateTime(c.created_at)}</p></div>
      {c.status === "pending" && viewer !== "carrier" ? <div className="flex gap-2">
        <form action={decideCharge}><Hidden tripId={trip.id} /><input type="hidden" name="chargeId" value={c.id} /><input type="hidden" name="approve" value="true" /><SubmitButton size="sm" pendingLabel="…">Approve</SubmitButton></form>
        <form action={decideCharge}><Hidden tripId={trip.id} /><input type="hidden" name="chargeId" value={c.id} /><input type="hidden" name="approve" value="false" /><SubmitButton size="sm" variant="outline" pendingLabel="…">Decline</SubmitButton></form>
      </div> : <span className={`text-xs font-semibold ${c.status === "approved" ? "text-emerald-700 dark:text-emerald-400" : c.status === "declined" ? "text-muted-foreground" : "text-amber-700"}`}>{c.status === "pending" ? "Waiting for the shipper" : c.status}</span>}
    </li>)}</ul>
  </Panel>;
}

export function DeliveredPanel({ view }: { view: TripView }) {
  const { trip } = view;
  return <Panel title="Did everything arrive?">
    <p className="mb-3 text-sm text-muted-foreground">Check the goods, then confirm so the carrier is paid. If you do nothing, it confirms automatically 48 hours after delivery.</p>
    {trip.pod_path ? <a href={`/api/files/pod/${trip.id}`} target="_blank" rel="noreferrer" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"><Camera className="h-4 w-4" />See the delivery photo</a> : null}
    <form action={confirmDelivery}><Hidden tripId={trip.id} /><SubmitButton className="w-full sm:w-auto" pendingLabel="Confirming…"><CheckCircle2 className="mr-2 h-4 w-4" />Yes, confirm delivery</SubmitButton></form>
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-destructive">Something is missing or damaged</summary>
      <form action={raiseDispute} className="mt-2 space-y-3"><Hidden tripId={trip.id} />
        <Textarea name="reason" rows={3} minLength={10} required placeholder="What's missing or damaged? How many units?" aria-label="What went wrong" />
        <Field label="Value of the loss or damage (KES, optional)" htmlFor="claim" hint={view.load.insure ? `Covered up to ${formatKes(view.load.declared_value)} by your cargo cover.` : "Without cargo cover, Vemi settles from the carrier's payout where the carrier is at fault."}><Input id="claim" name="claim" type="number" min="1" inputMode="numeric" /></Field>
        <Field label="Photos (up to 3)" htmlFor="photos"><Input id="photos" name="photos" type="file" accept="image/*" multiple capture="environment" /></Field>
        <SubmitButton variant="destructive" size="sm" pendingLabel="Sending…">Report a problem</SubmitButton>
      </form>
    </details>
  </Panel>;
}

/** After the trip: rate with compliments, tip the driver, favourite the carrier, receipt and book again. */
export function CompletedPanel({ view, defaultPhone }: { view: TripView; defaultPhone: string }) {
  const { trip, myRating, viewer, favourite } = view;
  const tags = viewer === "shipper" ? COMPLIMENTS.carrier : COMPLIMENTS.shipper;
  return <Panel title={myRating ? "Thanks for rating" : `How was the ${viewer === "shipper" ? "carrier" : "shipper"}?`}>
    <form action={rateTrip} className="space-y-3"><Hidden tripId={trip.id} />
      {/* Stars are in reverse DOM order so the checked star and every star "after" it (the lower ones) light up. */}
      <div className="flex flex-row-reverse justify-end gap-1 [&_label:has(input:checked)_svg]:fill-amber-400 [&_label:has(input:checked)_svg]:text-amber-400 [&_label:has(input:checked)~label_svg]:fill-amber-400 [&_label:has(input:checked)~label_svg]:text-amber-400" role="radiogroup" aria-label="Stars">{[5, 4, 3, 2, 1].map((n) => <label key={n} className="cursor-pointer"><input type="radio" name="stars" value={n} defaultChecked={myRating?.stars === n} className="sr-only" required /><Star className="h-8 w-8 text-muted-foreground" /><span className="sr-only">{n} stars</span></label>)}</div>
      <div className="flex flex-wrap gap-2">{Object.entries(tags).map(([key, label]) => <label key={key} className="cursor-pointer rounded-full border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-signal-soft"><input type="checkbox" name="tags" value={key} defaultChecked={myRating?.tags?.includes(key)} className="sr-only" />{label}</label>)}</div>
      <Input name="comment" placeholder="Anything to add? (optional)" maxLength={500} defaultValue={myRating?.comment ?? ""} />
      <SubmitButton size="sm" variant="outline" pendingLabel="…">{myRating ? "Update rating" : "Send rating"}</SubmitButton>
    </form>
    {viewer === "shipper" ? <div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2">
      <div><p className="mb-2 text-sm font-semibold">Tip the driver</p><p className="mb-2 text-xs text-muted-foreground">All of it goes to the carrier&apos;s team, no commission.{trip.tip ? ` You tipped ${formatKes(trip.tip)} so far.` : ""}</p>
        <MpesaPay tripId={trip.id} amount={500} purpose="tip" defaultPhone={defaultPhone} disabledReason={!mpesaConfigured() ? "Tips by M-Pesa are being switched on." : undefined} /></div>
      <div className="space-y-2 text-sm">
        <form action={toggleFavourite}><Hidden tripId={trip.id} /><input type="hidden" name="carrierId" value={trip.carrier_id} /><SubmitButton variant="outline" size="sm" pendingLabel="…"><Heart className={`mr-2 h-4 w-4 ${favourite ? "fill-primary text-primary" : ""}`} />{favourite ? "In your favourites" : "Add to favourite carriers"}</SubmitButton></form>
        <p className="text-xs text-muted-foreground">Favourites can see your new loads first.</p>
        <Button asChild variant="outline" size="sm"><Link href={`/loads/new?copy=${trip.load_id}`}><Copy className="mr-2 h-4 w-4" />Book this trip again</Link></Button>
      </div>
    </div> : null}
  </Panel>;
}

export function MoneyLines({ view }: { view: TripView }) {
  const { trip } = view;
  const rows: [string, number][] = [["Trip", trip.price]];
  if (trip.insurance_fee) rows.push(["Cargo cover", trip.insurance_fee]);
  if (trip.extras) rows.push(["Extras (waiting time, approved charges)", trip.extras]);
  if (trip.discount) rows.push(["Promo / referral discount", -trip.discount]);
  return <dl className="space-y-1 text-sm">
    {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd>{value < 0 ? `− ${formatKes(-value)}` : formatKes(value)}</dd></div>)}
    <div className="flex justify-between gap-3 border-t pt-1 font-semibold"><dt>Total</dt><dd>{formatKes(trip.total_due)}</dd></div>
    {trip.amount_paid ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Paid</dt><dd>{formatKes(trip.amount_paid)}</dd></div> : null}
    {trip.cancel_fee ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Cancellation fee</dt><dd>{formatKes(trip.cancel_fee)}</dd></div> : null}
  </dl>;
}

// ---------------------------------------------------------------------------------------------
// Carrier
// ---------------------------------------------------------------------------------------------

export function CarrierAssign({ view }: { view: TripView }) {
  const { trip, fleet, driver, driverToken } = view;
  const link = driverToken ? `${site()}/d/${driverToken}` : null;
  return <Panel title={trip.truck_id ? "Truck and driver" : "Assign a truck and driver"}>
    {trip.status === "awaiting_payment" ? <p className="mb-3 rounded-md bg-amber-500/10 px-3 py-2 text-sm">Waiting for the shipper to pay. Get ready now; you&apos;ll get an SMS the moment it&apos;s paid.</p> : null}
    {fleet.trucks.length && fleet.drivers.length ? <form action={assignTrip} className="grid gap-3 sm:grid-cols-2">
      <Hidden tripId={trip.id} />
      <Field label="Truck" htmlFor="truckId"><select id="truckId" name="truckId" className={selectClass} defaultValue={trip.truck_id ?? ""} required><option value="" disabled>Choose</option>{fleet.trucks.map((x) => <option key={x.id} value={x.id}>{x.plate} · {TRUCK_TYPES[x.truck_type]?.short}</option>)}</select></Field>
      <Field label="Driver" htmlFor="driverId"><select id="driverId" name="driverId" className={selectClass} defaultValue={trip.driver_id ?? ""} required><option value="" disabled>Choose</option>{fleet.drivers.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field>
      {smsConfigured() ? <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="smsDriver" defaultChecked className="accent-[hsl(var(--primary))]" />Text the driver their trip link (in their language)</label> : null}
      <div className="sm:col-span-2"><SubmitButton variant={trip.truck_id ? "outline" : "default"} pendingLabel="Saving…">{trip.truck_id ? "Change" : "Assign"}</SubmitButton></div>
    </form> : <p className="text-sm">Add a truck and a driver in <a className="font-semibold text-primary underline" href="/fleet">Fleet</a> first.</p>}
    {link && trip.driver_id ? <div className="mt-4 border-t pt-4"><p className="mb-2 text-sm font-semibold">Driver&apos;s trip link</p><p className="mb-3 text-sm text-muted-foreground">The driver opens it on their phone to see pickup details, enter the codes and tap each step. Location is shared only while it&apos;s open.</p><ShareDriverLink url={link} driverPhone={driver?.phone ?? null} tripRef={trip.ref} /></div> : null}
  </Panel>;
}

export function CarrierMove({ view }: { view: TripView }) {
  const { trip, load, stops } = view;
  const steps = nextSteps(trip.status, load.border_crossings > 0);
  const open = stops.filter((s) => !s.done_at);
  const onRoad = (ON_THE_ROAD as string[]).includes(trip.status);
  if (!steps.length && !open.length) return null;
  return <Panel title="Update the trip">
    <p className="mb-3 text-sm text-muted-foreground">Your driver can do this from their link. Each update tells the shipper.{load.require_codes ? " Loading needs the pickup code; delivering needs the receiver's code or a delivery photo." : ""}</p>
    {onRoad && open.length ? <ul className="mb-4 space-y-2">{open.map((stop) => <li key={stop.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"><span>Stop {stop.seq}: {stop.kind === "pickup" ? "pick up at" : "drop at"} {stop.detail || view.places.get(stop.place_id)?.name}</span>
      <form action={carrierStopDone}><Hidden tripId={trip.id} /><input type="hidden" name="seq" value={stop.seq} /><SubmitButton size="sm" variant="outline" pendingLabel="…">Done</SubmitButton></form></li>)}</ul> : null}
    <CarrierStatusButtons tripId={trip.id} steps={steps} action={carrierUpdateTrip} requireCodes={load.require_codes} />
  </Panel>;
}

export function CarrierExtras({ view }: { view: TripView }) {
  const { trip, settings } = view;
  const onRoad = (ON_THE_ROAD as string[]).includes(trip.status);
  const inProgress = ["scheduled", "to_pickup", "at_pickup", "loaded", "in_transit", "at_border", "at_dropoff", "delivered"].includes(trip.status);
  const maxAdvance = Math.floor((trip.carrier_payout * (settings?.fuel_advance_max_bps ?? 3000)) / 10000);
  const canAdvance = onRoad && trip.advance_amount === 0 && (trip.on_credit || trip.paid_at) && maxAdvance >= 1000;
  const showPod = ["in_transit", "at_border", "at_dropoff", "delivered"].includes(trip.status) && !trip.pod_path;
  if (!inProgress) return null;
  return <Panel title="Photos, extras and fuel" tone="plain">
    <div className="space-y-5 text-sm">
      {showPod ? <div><p className="mb-2 font-semibold">Delivery photo</p><form action={uploadPodAsCarrier} className="flex flex-col gap-2 sm:flex-row"><Hidden tripId={trip.id} /><Input name="file" type="file" accept="image/*,application/pdf" capture="environment" required /><SubmitButton variant="outline" pendingLabel="Uploading…"><Camera className="mr-2 h-4 w-4" />Upload</SubmitButton></form><p className="mt-1 text-xs text-muted-foreground">A photo of the signed delivery note speeds up confirmation and your payout.</p></div> : null}
      {canAdvance ? <div><p className="mb-1 flex items-center gap-1.5 font-semibold"><Fuel className="h-4 w-4 text-primary" />Fuel advance</p><p className="mb-2 text-xs text-muted-foreground">Take up to {formatKes(maxAdvance)} of your payout now for a {percent(settings?.fuel_advance_fee_bps ?? 300)} fee. The rest comes after delivery.</p>
        <form action={requestFuelAdvance} className="flex gap-2"><Hidden tripId={trip.id} /><Input name="amount" type="number" min="1000" max={maxAdvance} defaultValue={maxAdvance} aria-label="Advance amount" /><SubmitButton variant="outline" pendingLabel="…">Request</SubmitButton></form></div>
        : trip.advance_amount ? <p className="flex items-center gap-1.5"><Fuel className="h-4 w-4 text-primary" />Fuel advance: {formatKes(trip.advance_amount - trip.advance_fee)} sent or on its way (fee {formatKes(trip.advance_fee)}).</p> : null}
      {trip.status !== "delivered" ? <div><p className="mb-2 font-semibold">Ask for an extra charge</p><ChargeForm tripId={trip.id} /><p className="mt-1 text-xs text-muted-foreground">Waiting time over {view.settings?.free_waiting_hours ?? 3} hours is added automatically when the driver taps Arrived and then Loaded or Delivered.</p></div> : null}
    </div>
  </Panel>;
}

export function CarrierCancel({ view }: { view: TripView }) {
  const { trip } = view;
  if (!(BEFORE_LOADING as string[]).includes(trip.status)) return null;
  return <details className="rounded-lg border bg-card p-4 text-sm">
    <summary className="cursor-pointer font-semibold text-destructive">I can&apos;t do this trip</summary>
    <p className="mt-2 text-muted-foreground">The load goes back on the board and the shipper gets their money back.{trip.status !== "awaiting_payment" ? " Cancelling after payment counts against your reliability score, which shippers see with every bid." : ""}</p>
    <form action={carrierCancelTrip} className="mt-2 flex flex-col gap-2 sm:flex-row"><Hidden tripId={trip.id} /><Input name="reason" placeholder="Tell the shipper why" minLength={5} maxLength={300} required /><SubmitButton variant="destructive" size="sm" pendingLabel="…">Give the trip back</SubmitButton></form>
  </details>;
}

// ---------------------------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------------------------

export function AdminPanel({ view }: { view: TripView }) {
  const { trip, codes } = view;
  const payout = Math.max(trip.carrier_payout + trip.extras - trip.extras_commission - trip.advance_amount, 0);
  return <Panel title="Vemi ops">
    <div className="space-y-5 text-sm">
      {trip.sos_at || trip.alert ? <form action={clearSos} className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3"><Hidden tripId={trip.id} />
        <p className="font-semibold text-destructive">{trip.sos_at ? `SOS at ${formatDateTime(trip.sos_at)}${trip.sos_note ? `: ${trip.sos_note}` : ""}` : ALERTS[trip.alert!]}</p>
        <Input name="note" placeholder="What you did (shown on the timeline)" /><SubmitButton size="sm" pendingLabel="…">Mark handled</SubmitButton></form> : null}
      {codes ? <p>Codes: pickup <strong className="font-mono">{codes.pickup}</strong> · delivery <strong className="font-mono">{codes.delivery}</strong></p> : null}
      {trip.balance > 0 && trip.status !== "cancelled" ? <form action={recordBankPayment} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Hidden tripId={trip.id} />
        <Field label="Bank amount received" htmlFor="amount"><Input id="amount" name="amount" type="number" defaultValue={trip.balance} required /></Field>
        <Field label="Bank reference" htmlFor="reference"><Input id="reference" name="reference" required /></Field>
        <SubmitButton pendingLabel="…">Record</SubmitButton></form> : null}
      {trip.status === "disputed" ? <form action={resolveDispute} className="space-y-2"><Hidden tripId={trip.id} />
        <p><strong>Dispute:</strong> {trip.dispute_reason}{trip.claim_amount ? ` · claim ${formatKes(trip.claim_amount)}` : ""}</p>
        {trip.dispute_files.length ? <p className="flex flex-wrap gap-2">{trip.dispute_files.map((_, i) => <a key={i} href={`/api/files/dispute/${trip.id}?i=${i}`} target="_blank" rel="noreferrer" className="font-semibold text-primary">Photo {i + 1}</a>)}</p> : null}
        <Input name="note" placeholder="What you decided and why" />
        <Field label={`To the shipper's wallet from the payout (for a split, up to ${formatKes(payout)})`} htmlFor="splitAmount"><Input id="splitAmount" name="amount" type="number" min="1" max={payout} defaultValue={trip.claim_amount ? Math.min(trip.claim_amount, payout) : undefined} /></Field>
        <div className="flex flex-wrap gap-2"><SubmitButton name="outcome" value="pay_carrier" pendingLabel="…">Release payout</SubmitButton><SubmitButton name="outcome" value="split" variant="outline" pendingLabel="…">Split: pay the claim from the payout</SubmitButton><SubmitButton name="outcome" value="hold" variant="outline" pendingLabel="…">Keep payout on hold</SubmitButton></div>
      </form> : null}
      {!["completed", "cancelled"].includes(trip.status) ? <details><summary className="cursor-pointer font-semibold text-destructive">Cancel this trip</summary>
        <form action={cancelTripAsAdmin} className="mt-2 space-y-2"><Hidden tripId={trip.id} /><Input name="reason" placeholder="Reason" required />
          <label className="flex items-center gap-2"><input type="checkbox" name="reopen" defaultChecked />Put the load back on the board</label>
          {trip.amount_paid > 0 ? <p className="text-amber-700">The shipper paid {formatKes(trip.amount_paid)}. It goes back to their Vemi wallet, which they can cash out.</p> : null}
          <SubmitButton variant="destructive" size="sm" pendingLabel="…">Cancel trip</SubmitButton></form></details> : null}
    </div>
  </Panel>;
}

// ---------------------------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------------------------

export function MoneyBox({ view }: { view: TripView }) {
  const { trip, viewer, payouts, payments } = view;
  const payout = trip.carrier_payout + trip.extras - trip.extras_commission;
  return <div className="rounded-lg border bg-card p-4 text-sm">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{viewer === "carrier" ? "Your payout" : "Trip total"}</p>
    <p className="text-2xl font-bold">{formatKes(viewer === "carrier" ? payout : trip.total_due)}</p>
    {viewer !== "shipper" ? <p className="mt-1 text-muted-foreground">Trip {formatKes(trip.price)}{trip.extras ? ` + extras ${formatKes(trip.extras)}` : ""} − Vemi {percent(trip.commission_bps)} ({formatKes(trip.commission + trip.extras_commission)})</p> : null}
    {viewer !== "carrier" ? <p className="mt-1 text-muted-foreground">Paid {formatKes(trip.amount_paid)}{trip.balance > 0 ? ` · ${formatKes(trip.balance)} to pay` : ""}{trip.on_credit ? ` · on account, due ${formatDate(trip.credit_due_on)}` : ""}</p> : null}
    {payouts.map((p) => <p key={p.id} className="mt-2 font-medium">{{ trip: "Payout", advance: "Fuel advance", tip: "Tip", cancellation: "Cancellation fee", bonus: "Referral bonus" }[p.kind]} {formatKes(p.amount)}: {p.status === "paid" ? `paid ${formatDate(p.paid_at)} (ref ${p.reference})` : p.status === "held" ? "on hold (dispute)" : p.status === "sending" ? "sending to M-Pesa" : "queued, within 24 hours"}</p>)}
    {payments.filter((p) => p.status === "paid").map((p) => <p key={p.id} className="mt-1 text-xs text-muted-foreground">{p.purpose === "tip" ? "Tip · " : ""}{{ mpesa: "M-Pesa", bank: "Bank", paypal: "Card / PayPal", wallet: "Wallet" }[p.method]} {formatKes(p.amount)}{p.usd_amount ? ` (US$${Number(p.usd_amount).toFixed(2)})` : ""} {p.receipt ? `· ${p.receipt}` : ""} · {formatDate(p.paid_at)}</p>)}
    {viewer !== "carrier" && trip.amount_paid > 0 ? <Link href={`/trips/${trip.id}/receipt`} className="mt-3 inline-flex items-center gap-1.5 font-semibold text-primary"><Receipt className="h-4 w-4" />Receipt</Link> : null}
    {viewer === "carrier" && payouts.length ? <Link href={`/trips/${trip.id}/receipt`} className="mt-3 inline-flex items-center gap-1.5 font-semibold text-primary"><Receipt className="h-4 w-4" />Statement</Link> : null}
  </div>;
}

export function LoadBox({ view }: { view: TripView }) {
  const { load: l, contacts: c, viewer, trip, origin, destination, stops, places } = view;
  return <div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
    <p className="font-semibold">Load {l.ref}</p>
    <p>{CARGO_TYPES[l.cargo_type]}: {l.cargo_description}</p>
    <p className="text-muted-foreground">{Number(l.weight_tonnes)} t · {TRUCK_TYPES[l.truck_type]?.label} · pickup {formatDate(l.pickup_date)}{l.pickup_window !== "anytime" ? ` (${PICKUP_WINDOWS[l.pickup_window].toLowerCase()})` : ""}</p>
    {trip.expected_delivery ? <p className="text-muted-foreground">Expected delivery by {formatDate(trip.expected_delivery)}</p> : null}
    <p><span className="text-muted-foreground">From:</span> {l.origin_detail || origin.name}</p>
    {stops.map((s) => { const contact = c?.stops.find((x) => x.seq === s.seq); return <p key={s.id}><span className="text-muted-foreground">Stop {s.seq}{s.done_at ? " (done)" : ""}:</span> {s.kind === "pickup" ? "pick up at " : "drop at "}{s.detail || places.get(s.place_id)?.name}{contact?.phone ? <> · <a href={`tel:+${contact.phone}`} className="font-semibold text-primary">{contact.name ? `${contact.name} ` : ""}{displayPhone(contact.phone)}</a></> : null}</p>; })}
    <p><span className="text-muted-foreground">To:</span> {l.destination_detail || destination.name}</p>
    {l.insure ? <p className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" />Cargo cover for {formatKes(l.declared_value)}</p> : null}
    {l.notes ? <p><span className="text-muted-foreground">Notes:</span> {l.notes}</p> : null}
    {c ? <>
      {c.pickup_phone ? <Contact label="Pickup contact" name={c.pickup_name} phone={c.pickup_phone} /> : null}
      {c.dropoff_phone ? <Contact label="Drop-off contact" name={c.dropoff_name} phone={c.dropoff_phone} /> : null}
    </> : viewer === "carrier" ? <p className="text-xs text-muted-foreground">Pickup and drop-off contacts appear once the shipper pays.</p> : null}
    {trip.pod_path ? <a href={`/api/files/pod/${trip.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary"><Camera className="h-4 w-4" />Delivery photo</a> : null}
  </div>;
}

export function PeopleBox({ view }: { view: TripView }) {
  const { viewer, carrier, counterpart: other, truck: t, driver: d, trip, score } = view;
  const live = !["awaiting_payment", "cancelled", "completed"].includes(trip.status);
  const access = { kind: "session" as const, tripId: trip.id };
  const calls = voiceConfigured() && live && viewer !== "admin";
  return <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
    <p className="font-semibold">{viewer === "carrier" ? "Shipper" : "Carrier"}</p>
    {viewer !== "carrier" ? <div><p className="flex items-center gap-1.5">{carrier?.business_name}{carrier?.rating_count ? <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(carrier.rating_avg).toFixed(1)}</span> : null}</p>
      {score?.completed ? <p className="text-xs text-muted-foreground">{score.completed} trips{score.on_time_pct !== null ? ` · ${score.on_time_pct}% on time` : ""}{score.cancellations ? ` · ${score.cancellations} cancelled` : ""}</p> : null}</div> : null}
    {other ? <Contact label={viewer === "carrier" ? (other.company || "Contact") : "Owner"} name={other.full_name} phone={calls ? null : other.phone} /> : <p className="text-xs text-muted-foreground">Phone numbers are shared once the trip is paid.</p>}
    {t ? <div className="flex items-center gap-3">{t.photo_path ? <img src={`/api/files/truck/${t.id}`} alt={`Truck ${t.plate}`} className="h-14 w-20 rounded-md object-cover" /> : <TruckIcon className="h-4 w-4 text-muted-foreground" />}<span>{t.plate} · {TRUCK_TYPES[t.truck_type]?.short}</span></div> : null}
    {d ? <div className="flex items-center gap-3">{d.photo_path ? <img src={`/api/files/driver/${d.id}`} alt={d.full_name} className="h-14 w-14 rounded-full object-cover" /> : <UserRound className="h-4 w-4 text-muted-foreground" />}<span>{d.full_name}{calls ? null : <> · <a className="font-semibold text-primary" href={`tel:+${d.phone}`}>{displayPhone(d.phone)}</a></>}</span></div> : null}
    {calls ? <div className="flex flex-wrap gap-2 border-t pt-3">
      {viewer === "shipper" ? <><CallButton access={access} to="carrier" label="Call the carrier" />{d ? <CallButton access={access} to="driver" label="Call the driver" /> : null}</>
        : <><CallButton access={access} to="shipper" label="Call the shipper" />{d ? <CallButton access={access} to="driver" label="Call the driver" /> : null}</>}
      <p className="w-full text-xs text-muted-foreground">Calls go through a Vemi number, so neither side sees the other&apos;s phone.</p>
    </div> : null}
  </div>;
}
