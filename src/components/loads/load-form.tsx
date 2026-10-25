"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Info, Plus, ShieldCheck, Trash2, Truck, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage, selectClass } from "@/components/app/field";
import { PlaceSelect } from "@/components/loads/place-select";
import { MapPicker } from "@/components/loads/map-picker";
import { postLoad } from "@/app/actions/loads";
import { quoteRoute, suggestTruckType, withSurcharge, TRUCK_TYPES, TRUCK_TYPE_KEYS, type RoutePoint, type TruckType } from "@/lib/pricing";
import { CARGO_TYPES, PICKUP_WINDOWS } from "@/lib/trips";
import { MAX_STOPS } from "@/lib/validations";
import { displayPhone } from "@/lib/phone";
import { formatKes } from "@/lib/utils";
import { idleState, type Load, type LoadStop, type PlaceRow, type SavedPlace, type LaneSurge, type StopContact } from "@/lib/types";

type Point = { lat: number; lng: number };
type Stop = { key: number; placeId: string; kind: "drop" | "pickup"; detail: string; name: string; phone: string };
export type LoadFormSettings = { stopFee: number; insuranceBps: number; insuranceMin: number };
export type LoadCopy = { load: Load; stops: LoadStop[]; contacts: { pickup_name: string | null; pickup_phone: string | null; dropoff_name: string | null; dropoff_phone: string | null; stops: StopContact[] } | null };

const pinOf = (lat: number | null | undefined, lng: number | null | undefined) => (lat !== null && lat !== undefined && lng !== null && lng !== undefined ? { lat, lng } : null);

/** A row of one-tap saved places (warehouses, yards, customers), like Uber's Home and Work. */
function SavedPicker({ saved, onPick, label }: { saved: SavedPlace[]; onPick: (place: SavedPlace) => void; label: string }) {
  if (!saved.length) return null;
  return <div className="flex flex-wrap items-center gap-1.5 text-xs"><span className="text-muted-foreground">{label}</span>
    {saved.map((s) => <button key={s.id} type="button" onClick={() => onPick(s)} className="rounded-full border px-2.5 py-1 font-medium hover:border-primary hover:bg-signal-soft">{s.label}</button>)}
  </div>;
}

export function LoadForm({ places, today, defaultPhone, saved, hasFavourites, settings, copy }: { places: PlaceRow[]; today: string; defaultPhone: string; saved: SavedPlace[]; hasFavourites: boolean; settings: LoadFormSettings; copy?: LoadCopy | null }) {
  const [state, action] = useActionState(postLoad, idleState);
  const c = copy?.load;
  const [originId, setOriginId] = useState(c?.origin_id ?? "");
  const [destinationId, setDestinationId] = useState(c?.destination_id ?? "");
  const [originDetail, setOriginDetail] = useState(c?.origin_detail ?? "");
  const [destinationDetail, setDestinationDetail] = useState(c?.destination_detail ?? "");
  const [originPin, setOriginPin] = useState<Point | null>(pinOf(c?.origin_lat, c?.origin_lng));
  const [destinationPin, setDestinationPin] = useState<Point | null>(pinOf(c?.destination_lat, c?.destination_lng));
  const [pickupName, setPickupName] = useState(copy?.contacts?.pickup_name ?? "");
  const [pickupPhone, setPickupPhone] = useState(displayPhone(copy?.contacts?.pickup_phone ?? defaultPhone));
  const [dropoffName, setDropoffName] = useState(copy?.contacts?.dropoff_name ?? "");
  const [dropoffPhone, setDropoffPhone] = useState(displayPhone(copy?.contacts?.dropoff_phone ?? ""));
  const [stops, setStops] = useState<Stop[]>(() => (copy?.stops ?? []).map((s, i) => {
    const contact = copy?.contacts?.stops.find((x) => x.seq === s.seq);
    return { key: i, placeId: s.place_id, kind: s.kind, detail: s.detail ?? "", name: contact?.name ?? "", phone: displayPhone(contact?.phone ?? "") };
  }));
  const [pickupDate, setPickupDate] = useState(today);
  const [weight, setWeight] = useState(c ? String(c.weight_tonnes) : "");
  const [truckType, setTruckType] = useState<TruckType>(c?.truck_type ?? "trailer");
  const [truckTouched, setTruckTouched] = useState(Boolean(c));
  const [price, setPrice] = useState(c ? String(c.price) : "");
  const [priceTouched, setPriceTouched] = useState(Boolean(c));
  const [insure, setInsure] = useState(c?.insure ?? false);
  const [declared, setDeclared] = useState(c?.declared_value ? String(c.declared_value) : "");
  const [lane, setLane] = useState<(LaneSurge & { trucks_near: number }) | null>(null);
  const errors = state.fieldErrors ?? {};
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const origin = byId.get(originId);
  const destination = byId.get(destinationId);

  // Busy-lane pricing and trucks free near the pickup, from the server.
  useEffect(() => {
    if (!originId) return;
    const controller = new AbortController();
    fetch(`/api/quote?${new URLSearchParams({ origin: originId, truck: truckType, pickup: pickupDate })}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null)).then((data) => setLane(data)).catch(() => undefined);
    return () => controller.abort();
  }, [originId, truckType, pickupDate]);

  const estimate = useMemo(() => {
    if (!origin || !destination || origin.id === destination.id) return null;
    const middle = stops.map((s) => byId.get(s.placeId)).filter(Boolean) as PlaceRow[];
    const points: RoutePoint[] = [{ ...origin, pin: originPin }, ...middle, { ...destination, pin: destinationPin }];
    const route = quoteRoute(points, truckType, settings.stopFee);
    const surge = (lane?.urgent_bps ?? 0) + (lane?.busy_bps ?? 0);
    return { ...route, base: route.price, surge, price: withSurcharge(route.price, surge) };
  }, [origin, destination, originPin, destinationPin, stops, byId, truckType, settings.stopFee, lane]);

  // Until the shipper types their own price, the offer follows the guide price.
  const shownPrice = priceTouched ? price : estimate ? String(estimate.price) : price;
  const declaredValue = Number.parseInt(declared.replace(/[,\s]/g, ""), 10);
  const insuranceFee = insure && declaredValue > 0 ? Math.max(settings.insuranceMin, Math.round((declaredValue * settings.insuranceBps) / 10000)) : 0;

  function onWeight(value: string) {
    setWeight(value);
    const tonnes = Number.parseFloat(value);
    if (!truckTouched && tonnes > 0) setTruckType(suggestTruckType(tonnes));
  }
  function pickSaved(which: "origin" | "destination", place: SavedPlace) {
    const pin = pinOf(place.lat, place.lng);
    if (which === "origin") { setOriginId(place.place_id); setOriginDetail(place.detail ?? ""); setOriginPin(pin); if (place.contact_name) setPickupName(place.contact_name); if (place.contact_phone) setPickupPhone(displayPhone(place.contact_phone)); }
    else { setDestinationId(place.place_id); setDestinationDetail(place.detail ?? ""); setDestinationPin(pin); if (place.contact_name) setDropoffName(place.contact_name); if (place.contact_phone) setDropoffPhone(displayPhone(place.contact_phone)); }
  }
  const updateStop = (key: number, patch: Partial<Stop>) => setStops((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  return <form action={action} className="space-y-6">
    {c ? <input type="hidden" name="copiedFrom" value={c.id} /> : null}
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="font-semibold">Route</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-3">
          <SavedPicker saved={saved} label="Saved:" onPick={(p) => pickSaved("origin", p)} />
          <Field label="Pickup town" htmlFor="originId" error={errors.originId}><PlaceSelect id="originId" name="originId" places={places} value={originId} onChange={(v) => { setOriginId(v); setOriginPin(null); }} required /></Field>
          <Field label="Pickup address or landmark" htmlFor="originDetail" error={errors.originDetail}><Input id="originDetail" name="originDetail" value={originDetail} onChange={(e) => setOriginDetail(e.target.value)} placeholder="e.g. Changamwe, ICD gate 2" /></Field>
          <MapPicker name="origin" label="Pin the exact pickup" center={origin ?? null} value={originPin} onChange={setOriginPin} />
        </div>
        <div className="space-y-3">
          <SavedPicker saved={saved} label="Saved:" onPick={(p) => pickSaved("destination", p)} />
          <Field label="Drop-off town" htmlFor="destinationId" error={errors.destinationId}><PlaceSelect id="destinationId" name="destinationId" places={places} value={destinationId} onChange={(v) => { setDestinationId(v); setDestinationPin(null); }} required /></Field>
          <Field label="Drop-off address or landmark" htmlFor="destinationDetail" error={errors.destinationDetail}><Input id="destinationDetail" name="destinationDetail" value={destinationDetail} onChange={(e) => setDestinationDetail(e.target.value)} placeholder="e.g. Nakawa industrial area" /></Field>
          <MapPicker name="destination" label="Pin the exact drop-off" center={destination ?? null} value={destinationPin} onChange={setDestinationPin} />
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between gap-2"><div><p className="text-sm font-semibold">Stops on the way</p><p className="text-xs text-muted-foreground">Extra drop-offs or pickups, in order. {formatKes(settings.stopFee)} a stop plus the extra distance.</p></div>
          {stops.length < MAX_STOPS ? <Button type="button" size="sm" variant="outline" onClick={() => setStops((all) => [...all, { key: Date.now(), placeId: "", kind: "drop", detail: "", name: "", phone: "" }])}><Plus className="mr-1 h-4 w-4" />Add a stop</Button> : null}
        </div>
        {stops.map((stop, index) => <div key={stop.key} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label={`Stop ${index + 1}`} htmlFor={`stopPlace_${index + 1}`}><PlaceSelect id={`stopPlace_${index + 1}`} name={`stopPlace_${index + 1}`} places={places} value={stop.placeId} onChange={(v) => updateStop(stop.key, { placeId: v })} required /></Field>
          <Field label="What happens there" htmlFor={`stopKind_${index + 1}`}><select id={`stopKind_${index + 1}`} name={`stopKind_${index + 1}`} className={selectClass} value={stop.kind} onChange={(e) => updateStop(stop.key, { kind: e.target.value as Stop["kind"] })}><option value="drop">Drop off part of the load</option><option value="pickup">Pick up more goods</option></select></Field>
          <Button type="button" variant="ghost" size="sm" className="self-end text-destructive" onClick={() => setStops((all) => all.filter((s) => s.key !== stop.key))} aria-label={`Remove stop ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>
          <Field label="Address or landmark" htmlFor={`stopDetail_${index + 1}`}><Input id={`stopDetail_${index + 1}`} name={`stopDetail_${index + 1}`} value={stop.detail} onChange={(e) => updateStop(stop.key, { detail: e.target.value })} /></Field>
          <Field label="Contact there (name, phone)" htmlFor={`stopName_${index + 1}`}><div className="flex gap-2"><Input id={`stopName_${index + 1}`} name={`stopName_${index + 1}`} value={stop.name} onChange={(e) => updateStop(stop.key, { name: e.target.value })} placeholder="Name" /><Input name={`stopPhone_${index + 1}`} type="tel" value={stop.phone} onChange={(e) => updateStop(stop.key, { phone: e.target.value })} placeholder="0712 345 678" aria-label={`Stop ${index + 1} phone`} /></div></Field>
        </div>)}
      </div>

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
        <Field label="Pickup date" htmlFor="pickupDate" error={errors.pickupDate}><Input id="pickupDate" name="pickupDate" type="date" min={today} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} required /></Field>
        <Field label="Pickup time" htmlFor="pickupWindow"><select id="pickupWindow" name="pickupWindow" className={selectClass} defaultValue={c?.pickup_window ?? "anytime"}>{Object.entries(PICKUP_WINDOWS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></Field>
      </div>
    </section>

    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="font-semibold">Cargo and truck</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type of goods" htmlFor="cargoType" error={errors.cargoType}><select id="cargoType" name="cargoType" className={selectClass} defaultValue={c?.cargo_type ?? "general"}>{Object.entries(CARGO_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Weight (tonnes)" htmlFor="weightTonnes" error={errors.weightTonnes}><Input id="weightTonnes" name="weightTonnes" type="number" inputMode="decimal" step="0.1" min="0.1" max="60" value={weight} onChange={(e) => onWeight(e.target.value)} required /></Field>
        <Field label="What exactly, and how is it packed?" htmlFor="cargoDescription" error={errors.cargoDescription} className="sm:col-span-2"><Textarea id="cargoDescription" name="cargoDescription" rows={2} defaultValue={c?.cargo_description ?? ""} placeholder="e.g. 1,200 cartons of cooking oil on pallets, forklift at pickup" required /></Field>
        <Field label="Truck needed" htmlFor="truckType" error={errors.truckType} hint={`Carries about ${TRUCK_TYPES[truckType].tonnes} t.`}><select id="truckType" name="truckType" className={selectClass} value={truckType} onChange={(e) => { setTruckTouched(true); setTruckType(e.target.value as TruckType); }}>{TRUCK_TYPE_KEYS.map((key) => <option key={key} value={key}>{TRUCK_TYPES[key].label}</option>)}</select></Field>
      </div>
      {origin && lane ? <p className="flex items-center gap-2 text-sm"><Truck className="h-4 w-4 text-primary" />{lane.trucks_near ? <span><strong>{lane.trucks_near}</strong> free {TRUCK_TYPES[truckType].short.toLowerCase()} truck{lane.trucks_near > 1 ? "s" : ""} near {origin.name} right now. They hear about your load first.</span> : <span>No {TRUCK_TYPES[truckType].short.toLowerCase()} marked free near {origin.name} yet. We alert every carrier with one.</span>}</p> : null}
    </section>

    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="font-semibold">Your price</h2>
      {estimate ? <div className="flex gap-3 rounded-md bg-signal-soft p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <p>Guide price <strong>{formatKes(estimate.price)}</strong> for about {estimate.distanceKm.toLocaleString()} km{estimate.crossings ? `, including ${estimate.crossings} border crossing${estimate.crossings > 1 ? "s" : ""}` : ""}{estimate.stops ? ` and ${estimate.stops} extra stop${estimate.stops > 1 ? "s" : ""}` : ""}.</p>
          {estimate.surge ? <p className="text-xs">Includes {(estimate.surge / 100).toFixed(0)}% for {[lane?.urgent_bps ? "a same-day or next-day pickup" : null, lane?.busy_bps ? `a busy lane (${lane.open_loads} load${lane.open_loads === 1 ? "" : "s"} waiting, ${lane.free_trucks} truck${lane.free_trucks === 1 ? "" : "s"} free)` : null].filter(Boolean).join(" and ")}. Base price {formatKes(estimate.base)}.</p> : null}
          <p className="text-xs text-muted-foreground">Offer more to get trucks faster; carriers can also counter-bid.</p>
        </div>
      </div> : <p className="text-sm text-muted-foreground">Choose the route to see a guide price.</p>}
      <Field label="Price you offer (KES, all-in for the trip)" htmlFor="price" error={errors.price}><Input id="price" name="price" type="number" inputMode="numeric" min="1000" step="500" value={shownPrice} onChange={(e) => { setPriceTouched(true); setPrice(e.target.value); }} required /></Field>
    </section>

    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="font-semibold">How you want to book</h2>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="instantBook" defaultChecked={c?.instant_book ?? true} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" /><span><span className="flex items-center gap-1.5 font-semibold"><Zap className="h-4 w-4 text-primary" />Instant booking at my price</span><span className="text-muted-foreground">The first verified truck to tap &quot;Book now&quot; gets the load. Carriers can still send cheaper bids for you to pick from.</span></span></label>
      {hasFavourites ? <Field label="Offer it to my favourite carriers first" htmlFor="favouritesHours" hint="Carriers you starred see it before everyone else."><select id="favouritesHours" name="favouritesHours" className={selectClass} defaultValue="0"><option value="0">No, everyone sees it now</option><option value="1">For 1 hour</option><option value="3">For 3 hours</option><option value="6">For 6 hours</option><option value="12">For 12 hours</option></select></Field> : <input type="hidden" name="favouritesHours" value="0" />}
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="requireCodes" defaultChecked={c?.require_codes ?? true} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" /><span><span className="font-semibold">Pickup and delivery codes</span><span className="block text-muted-foreground">You get two 4-digit codes. The driver needs one to start loading and the other from the receiver to finish. Stops the wrong truck taking your goods.</span></span></label>
      <div className="space-y-3 rounded-md border p-3">
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="insure" checked={insure} onChange={(e) => setInsure(e.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" /><span><span className="flex items-center gap-1.5 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Cargo cover</span><span className="text-muted-foreground">Covers loss or damage up to the value you declare, for {(settings.insuranceBps / 100).toFixed(1)}% of it (at least {formatKes(settings.insuranceMin)}). Added to the trip price.</span></span></label>
        {insure ? <Field label="Value of the goods (KES)" htmlFor="declaredValue" error={errors.declaredValue} hint={insuranceFee ? `Cover costs ${formatKes(insuranceFee)}.` : undefined}><Input id="declaredValue" name="declaredValue" type="number" inputMode="numeric" min="1000" value={declared} onChange={(e) => setDeclared(e.target.value)} required /></Field> : null}
      </div>
    </section>

    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div><h2 className="font-semibold">Contacts on the day</h2><p className="text-sm text-muted-foreground">Shared with the carrier only after you book and pay. Calls can go through Vemi so numbers stay private.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact at pickup" htmlFor="pickupName" error={errors.pickupName}><Input id="pickupName" name="pickupName" value={pickupName} onChange={(e) => setPickupName(e.target.value)} placeholder="Name" /></Field>
        <Field label="Their phone" htmlFor="pickupPhone" error={errors.pickupPhone}><Input id="pickupPhone" name="pickupPhone" type="tel" value={pickupPhone} onChange={(e) => setPickupPhone(e.target.value)} placeholder="0712 345 678" /></Field>
        <Field label="Contact at drop-off" htmlFor="dropoffName" error={errors.dropoffName}><Input id="dropoffName" name="dropoffName" value={dropoffName} onChange={(e) => setDropoffName(e.target.value)} placeholder="Name" /></Field>
        <Field label="Their phone" htmlFor="dropoffPhone" error={errors.dropoffPhone} hint="They get a live tracking link when the truck leaves."><Input id="dropoffPhone" name="dropoffPhone" type="tel" value={dropoffPhone} onChange={(e) => setDropoffPhone(e.target.value)} placeholder="0712 345 678" /></Field>
        <Field label="Save the pickup as (optional)" htmlFor="savePickupAs" error={errors.savePickupAs}><Input id="savePickupAs" name="savePickupAs" placeholder="e.g. Main warehouse" maxLength={60} /></Field>
        <Field label="Save the drop-off as (optional)" htmlFor="saveDropoffAs" error={errors.saveDropoffAs}><Input id="saveDropoffAs" name="saveDropoffAs" placeholder="e.g. Kampala depot" maxLength={60} /></Field>
        <Field label="Anything else the driver should know?" htmlFor="notes" error={errors.notes} className="sm:col-span-2"><Textarea id="notes" name="notes" rows={2} defaultValue={c?.notes ?? ""} placeholder="Loading hours, gate pass, tarpaulin needed…" /></Field>
      </div>
    </section>

    <FormMessage state={state} />
    <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Posting…">Post load</SubmitButton>
  </form>;
}
