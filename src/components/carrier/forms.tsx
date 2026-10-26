"use client";
import { useActionState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage, selectClass } from "@/components/app/field";
import { addDriver, addTruck, saveCarrierProfile } from "@/app/actions/carrier";
import { updateAccount } from "@/app/actions/auth";
import { COUNTRY_NAMES, TRUCK_TYPES, TRUCK_TYPE_KEYS } from "@/lib/pricing";
import { idleState, type Carrier, type CarrierPrivate, type Profile } from "@/lib/types";
import { displayPhone } from "@/lib/phone";

function useResetOnSuccess(status: string) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (status === "success") ref.current?.reset(); }, [status]);
  return ref;
}

export function TruckForm() {
  const [state, action] = useActionState(addTruck, idleState);
  const ref = useResetOnSuccess(state.status);
  const e = state.fieldErrors ?? {};
  return <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
    <Field label="Number plate" htmlFor="plate" error={e.plate}><Input id="plate" name="plate" placeholder="KDA 123A" autoCapitalize="characters" required /></Field>
    <Field label="Type" htmlFor="truckType" error={e.truckType}><select id="truckType" name="truckType" className={selectClass} defaultValue="trailer">{TRUCK_TYPE_KEYS.map((k) => <option key={k} value={k}>{TRUCK_TYPES[k].label}</option>)}</select></Field>
    <Field label="Capacity (tonnes)" htmlFor="capacityTonnes" error={e.capacityTonnes}><Input id="capacityTonnes" name="capacityTonnes" type="number" step="0.5" min="0.5" max="80" required /></Field>
    <Field label="Make and model (optional)" htmlFor="makeModel" error={e.makeModel}><Input id="makeModel" name="makeModel" placeholder="e.g. Mercedes Actros 2014" /></Field>
    <div className="space-y-2 sm:col-span-2"><FormMessage state={state} /><SubmitButton pendingLabel="Adding…">Add truck</SubmitButton></div>
  </form>;
}

export function DriverForm() {
  const [state, action] = useActionState(addDriver, idleState);
  const ref = useResetOnSuccess(state.status);
  const e = state.fieldErrors ?? {};
  return <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-3">
    <Field label="Driver's name" htmlFor="fullName" error={e.fullName}><Input id="fullName" name="fullName" required /></Field>
    <Field label="Mobile number" htmlFor="dphone" error={e.phone}><Input id="dphone" name="phone" type="tel" placeholder="0712 345 678" required /></Field>
    <Field label="Licence number (optional)" htmlFor="licenceNo" error={e.licenceNo}><Input id="licenceNo" name="licenceNo" /></Field>
    <Field label="Driver's language" htmlFor="language" hint="Their trip page and texts use it."><select id="language" name="language" className={selectClass} defaultValue="sw"><option value="sw">Kiswahili</option><option value="en">English</option></select></Field>
    <div className="space-y-2 sm:col-span-3"><FormMessage state={state} /><SubmitButton pendingLabel="Adding…">Add driver</SubmitButton></div>
  </form>;
}

export function CarrierProfileForm({ carrier, details, fallbackName, fallbackPhone }: { carrier: Carrier | null; details: CarrierPrivate | null; fallbackName: string; fallbackPhone: string | null }) {
  const [state, action] = useActionState(saveCarrierProfile, idleState);
  const e = state.fieldErrors ?? {};
  const countries = new Set(carrier?.countries ?? ["KE"]);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <Field label="Business or trading name" htmlFor="businessName" error={e.businessName}><Input id="businessName" name="businessName" defaultValue={carrier?.business_name ?? fallbackName} required /></Field>
    <Field label="Where your trucks are based" htmlFor="baseTown" error={e.baseTown}><Input id="baseTown" name="baseTown" defaultValue={carrier?.base_town ?? ""} placeholder="e.g. Mombasa" /></Field>
    <Field label="KRA PIN" htmlFor="kraPin" error={e.kraPin}><Input id="kraPin" name="kraPin" defaultValue={details?.kra_pin ?? ""} placeholder="A012345678B" autoCapitalize="characters" /></Field>
    <Field label="National ID or passport number" htmlFor="idNumber" error={e.idNumber}><Input id="idNumber" name="idNumber" defaultValue={details?.id_number ?? ""} /></Field>
    <Field label="M-Pesa number for payouts" htmlFor="payoutPhone" error={e.payoutPhone} hint="Payouts go only to this number."><Input id="payoutPhone" name="payoutPhone" type="tel" defaultValue={displayPhone(details?.payout_phone ?? fallbackPhone)} required /></Field>
    <Field label="Name registered on that M-Pesa line" htmlFor="payoutName" error={e.payoutName}><Input id="payoutName" name="payoutName" defaultValue={details?.payout_name ?? ""} required /></Field>
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-medium">Countries you can drive to</legend>
      <div className="mt-2 flex flex-wrap gap-2">{Object.entries(COUNTRY_NAMES).map(([code, name]) => <label key={code} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-signal-soft"><input type="checkbox" name="countries" value={code} defaultChecked={countries.has(code)} className="accent-[hsl(var(--primary))]" />{name}</label>)}</div>
      {e.countries ? <p className="mt-1 text-xs text-destructive">{e.countries[0]}</p> : null}
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="crossBorder" defaultChecked={carrier?.cross_border ?? false} className="accent-[hsl(var(--primary))]" />I have the permits and COMESA Yellow Card for cross-border trips</label>
    </fieldset>
    <div className="space-y-2 sm:col-span-2"><FormMessage state={state} /><SubmitButton pendingLabel="Saving…">{carrier ? "Save changes" : "Save and continue"}</SubmitButton></div>
  </form>;
}

export function AccountForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(updateAccount, idleState);
  const e = state.fieldErrors ?? {};
  return <form action={action} className="grid gap-4 sm:grid-cols-3">
    <Field label="Your name" htmlFor="afullName" error={e.fullName}><Input id="afullName" name="fullName" defaultValue={profile.full_name} required /></Field>
    <Field label="Company" htmlFor="acompany" error={e.company}><Input id="acompany" name="company" defaultValue={profile.company ?? ""} /></Field>
    <Field label="Mobile number" htmlFor="aphone" error={e.phone}><Input id="aphone" name="phone" type="tel" defaultValue={displayPhone(profile.phone)} required /></Field>
    <div className="space-y-2 sm:col-span-3"><FormMessage state={state} /><SubmitButton variant="outline" pendingLabel="Saving…">Save</SubmitButton></div>
  </form>;
}
