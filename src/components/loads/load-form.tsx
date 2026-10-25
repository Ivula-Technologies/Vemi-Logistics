"use client";
import { useActionState, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage, selectClass } from "@/components/app/field";
import { PlaceSelect } from "@/components/loads/place-select";
import { postLoad } from "@/app/actions/loads";
import { quote, suggestTruckType, TRUCK_TYPES, TRUCK_TYPE_KEYS, type TruckType } from "@/lib/pricing";
import { CARGO_TYPES } from "@/lib/trips";
import { formatKes } from "@/lib/utils";
import { idleState, type PlaceRow } from "@/lib/types";

export function LoadForm({ places, today, defaultPhone }: { places: PlaceRow[]; today: string; defaultPhone: string }) {
  const [state, action] = useActionState(postLoad, idleState);
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [weight, setWeight] = useState("");
  const [truckType, setTruckType] = useState<TruckType>("trailer");
  const [truckTouched, setTruckTouched] = useState(false);
  const [price, setPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const errors = state.fieldErrors ?? {};

  const estimate = useMemo(() => {
    const origin = places.find((p) => p.id === originId);
    const destination = places.find((p) => p.id === destinationId);
    if (!origin || !destination || origin.id === destination.id) return null;
    return quote(origin, destination, truckType);
  }, [places, originId, destinationId, truckType]);

  // Until the shipper types their own price, the offer follows the guide price.
  const shownPrice = priceTouched ? price : estimate ? String(estimate.price) : price;

  function onWeight(value: string) {
    setWeight(value);
    const tonnes = Number.parseFloat(value);
    if (!truckTouched && tonnes > 0) setTruckType(suggestTruckType(tonnes));
  }

  return <form action={action} className="space-y-6">
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="font-semibold">Route</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pickup town" htmlFor="originId" error={errors.originId}><PlaceSelect id="originId" name="originId" places={places} value={originId} onChange={setOriginId} required /></Field>
        <Field label="Drop-off town" htmlFor="destinationId" error={errors.destinationId}><PlaceSelect id="destinationId" name="destinationId" places={places} value={destinationId} onChange={setDestinationId} required /></Field>
        <Field label="Pickup address or landmark" htmlFor="originDetail" error={errors.originDetail}><Input id="originDetail" name="originDetail" placeholder="e.g. Changamwe, ICD gate 2" /></Field>
        <Field label="Drop-off address or landmark" htmlFor="destinationDetail" error={errors.destinationDetail}><Input id="destinationDetail" name="destinationDetail" placeholder="e.g. Nakawa industrial area" /></Field>
        <Field label="Pickup date" htmlFor="pickupDate" error={errors.pickupDate}><Input id="pickupDate" name="pickupDate" type="date" min={today} defaultValue={today} required /></Field>
      </div>
    </section>

    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="font-semibold">Cargo and truck</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type of goods" htmlFor="cargoType" error={errors.cargoType}><select id="cargoType" name="cargoType" className={selectClass} defaultValue="general">{Object.entries(CARGO_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Weight (tonnes)" htmlFor="weightTonnes" error={errors.weightTonnes}><Input id="weightTonnes" name="weightTonnes" type="number" inputMode="decimal" step="0.1" min="0.1" max="60" value={weight} onChange={(e) => onWeight(e.target.value)} required /></Field>
        <Field label="What exactly, and how is it packed?" htmlFor="cargoDescription" error={errors.cargoDescription} className="sm:col-span-2"><Textarea id="cargoDescription" name="cargoDescription" rows={2} placeholder="e.g. 1,200 cartons of cooking oil on pallets, forklift at pickup" required /></Field>
        <Field label="Truck needed" htmlFor="truckType" error={errors.truckType} hint={`Carries about ${TRUCK_TYPES[truckType].tonnes} t.`}><select id="truckType" name="truckType" className={selectClass} value={truckType} onChange={(e) => { setTruckTouched(true); setTruckType(e.target.value as TruckType); }}>{TRUCK_TYPE_KEYS.map((key) => <option key={key} value={key}>{TRUCK_TYPES[key].label}</option>)}</select></Field>
      </div>
    </section>

    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="font-semibold">Your price</h2>
      {estimate ? <div className="flex gap-3 rounded-md bg-signal-soft p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>Guide price <strong>{formatKes(estimate.price)}</strong> for about {estimate.distanceKm.toLocaleString()} km{estimate.crossings ? `, including ${estimate.crossings} border crossing${estimate.crossings > 1 ? "s" : ""}` : ""}. Offer more to get trucks faster; carriers can also counter-bid.</p>
      </div> : <p className="text-sm text-muted-foreground">Choose the route to see a guide price.</p>}
      <Field label="Price you offer (KES, all-in for the trip)" htmlFor="price" error={errors.price}><Input id="price" name="price" type="number" inputMode="numeric" min="1000" step="500" value={shownPrice} onChange={(e) => { setPriceTouched(true); setPrice(e.target.value); }} required /></Field>
    </section>

    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div><h2 className="font-semibold">Contacts on the day</h2><p className="text-sm text-muted-foreground">Shared with the carrier only after you book and pay.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact at pickup" htmlFor="pickupName" error={errors.pickupName}><Input id="pickupName" name="pickupName" placeholder="Name" /></Field>
        <Field label="Their phone" htmlFor="pickupPhone" error={errors.pickupPhone}><Input id="pickupPhone" name="pickupPhone" type="tel" defaultValue={defaultPhone} placeholder="0712 345 678" /></Field>
        <Field label="Contact at drop-off" htmlFor="dropoffName" error={errors.dropoffName}><Input id="dropoffName" name="dropoffName" placeholder="Name" /></Field>
        <Field label="Their phone" htmlFor="dropoffPhone" error={errors.dropoffPhone}><Input id="dropoffPhone" name="dropoffPhone" type="tel" placeholder="0712 345 678" /></Field>
        <Field label="Anything else the driver should know?" htmlFor="notes" error={errors.notes} className="sm:col-span-2"><Textarea id="notes" name="notes" rows={2} placeholder="Loading hours, gate pass, tarpaulin needed…" /></Field>
      </div>
    </section>

    <FormMessage state={state} />
    <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Posting…">Post load and get bids</SubmitButton>
  </form>;
}
