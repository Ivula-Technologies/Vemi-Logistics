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
import { t, type AppLang } from "@/lib/i18n";

function useResetOnSuccess(status: string) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (status === "success") ref.current?.reset(); }, [status]);
  return ref;
}

export function TruckForm({ lang = "en" }: { lang?: AppLang } = {}) {
  const [state, action] = useActionState(addTruck, idleState);
  const ref = useResetOnSuccess(state.status);
  const e = state.fieldErrors ?? {};
  return <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
    <Field label={t(lang, "form.plate")} htmlFor="plate" error={e.plate}><Input id="plate" name="plate" placeholder="KDA 123A" autoCapitalize="characters" required /></Field>
    <Field label={t(lang, "form.type")} htmlFor="truckType" error={e.truckType}><select id="truckType" name="truckType" className={selectClass} defaultValue="trailer">{TRUCK_TYPE_KEYS.map((k) => <option key={k} value={k}>{TRUCK_TYPES[k].label}</option>)}</select></Field>
    <Field label={t(lang, "form.capacity")} htmlFor="capacityTonnes" error={e.capacityTonnes}><Input id="capacityTonnes" name="capacityTonnes" type="number" step="0.5" min="0.5" max="80" required /></Field>
    <Field label={t(lang, "form.makeModel")} htmlFor="makeModel" error={e.makeModel}><Input id="makeModel" name="makeModel" placeholder={t(lang, "form.makeModelPlaceholder")} /></Field>
    <div className="space-y-2 sm:col-span-2"><FormMessage state={state} /><SubmitButton pendingLabel={t(lang, "form.adding")}>{t(lang, "form.addTruck")}</SubmitButton></div>
  </form>;
}

export function DriverForm({ lang = "en" }: { lang?: AppLang } = {}) {
  const [state, action] = useActionState(addDriver, idleState);
  const ref = useResetOnSuccess(state.status);
  const e = state.fieldErrors ?? {};
  return <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-3">
    <Field label={t(lang, "form.driverName")} htmlFor="fullName" error={e.fullName}><Input id="fullName" name="fullName" required /></Field>
    <Field label={t(lang, "form.mobile")} htmlFor="dphone" error={e.phone}><Input id="dphone" name="phone" type="tel" placeholder="0712 345 678" required /></Field>
    <Field label={t(lang, "form.licence")} htmlFor="licenceNo" error={e.licenceNo}><Input id="licenceNo" name="licenceNo" /></Field>
    <Field label={t(lang, "form.driverLang")} htmlFor="language" hint={t(lang, "form.driverLangHint")}><select id="language" name="language" className={selectClass} defaultValue="sw"><option value="sw">Kiswahili</option><option value="en">English</option></select></Field>
    <div className="space-y-2 sm:col-span-3"><FormMessage state={state} /><SubmitButton pendingLabel={t(lang, "form.adding")}>{t(lang, "form.addDriver")}</SubmitButton></div>
  </form>;
}

export function CarrierProfileForm({ carrier, details, fallbackName, fallbackPhone, lang = "en" }: { carrier: Carrier | null; details: CarrierPrivate | null; fallbackName: string; fallbackPhone: string | null; lang?: AppLang }) {
  const [state, action] = useActionState(saveCarrierProfile, idleState);
  const e = state.fieldErrors ?? {};
  const countries = new Set(carrier?.countries ?? ["KE"]);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <Field label={t(lang, "pf.businessName")} htmlFor="businessName" error={e.businessName}><Input id="businessName" name="businessName" defaultValue={carrier?.business_name ?? fallbackName} required /></Field>
    <Field label={t(lang, "pf.base")} htmlFor="baseTown" error={e.baseTown}><Input id="baseTown" name="baseTown" defaultValue={carrier?.base_town ?? ""} placeholder={t(lang, "pf.basePlaceholder")} /></Field>
    <Field label={t(lang, "pf.kra")} htmlFor="kraPin" error={e.kraPin}><Input id="kraPin" name="kraPin" defaultValue={details?.kra_pin ?? ""} placeholder="A012345678B" autoCapitalize="characters" /></Field>
    <Field label={t(lang, "pf.id")} htmlFor="idNumber" error={e.idNumber}><Input id="idNumber" name="idNumber" defaultValue={details?.id_number ?? ""} /></Field>
    <Field label={t(lang, "pf.payout")} htmlFor="payoutPhone" error={e.payoutPhone} hint={t(lang, "pf.payoutHint")}><Input id="payoutPhone" name="payoutPhone" type="tel" defaultValue={displayPhone(details?.payout_phone ?? fallbackPhone)} required /></Field>
    <Field label={t(lang, "pf.payoutName")} htmlFor="payoutName" error={e.payoutName}><Input id="payoutName" name="payoutName" defaultValue={details?.payout_name ?? ""} required /></Field>
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-medium">{t(lang, "pf.countries")}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{Object.entries(COUNTRY_NAMES).map(([code, name]) => <label key={code} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-signal-soft"><input type="checkbox" name="countries" value={code} defaultChecked={countries.has(code)} className="accent-[hsl(var(--primary))]" />{name}</label>)}</div>
      {e.countries ? <p className="mt-1 text-xs text-destructive">{e.countries[0]}</p> : null}
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="crossBorder" defaultChecked={carrier?.cross_border ?? false} className="accent-[hsl(var(--primary))]" />{t(lang, "pf.crossBorder")}</label>
    </fieldset>
    <div className="space-y-2 sm:col-span-2"><FormMessage state={state} /><SubmitButton pendingLabel={t(lang, "pf.saving")}>{carrier ? t(lang, "pf.saveChanges") : t(lang, "pf.saveContinue")}</SubmitButton></div>
  </form>;
}

export function AccountForm({ profile, lang = "en" }: { profile: Profile; lang?: AppLang }) {
  const [state, action] = useActionState(updateAccount, idleState);
  const e = state.fieldErrors ?? {};
  return <form action={action} className="grid gap-4 sm:grid-cols-3">
    <Field label={t(lang, "auth.name")} htmlFor="afullName" error={e.fullName}><Input id="afullName" name="fullName" defaultValue={profile.full_name} required /></Field>
    <Field label={t(lang, "pf.company")} htmlFor="acompany" error={e.company}><Input id="acompany" name="company" defaultValue={profile.company ?? ""} /></Field>
    <Field label={t(lang, "auth.mobile")} htmlFor="aphone" error={e.phone}><Input id="aphone" name="phone" type="tel" defaultValue={displayPhone(profile.phone)} required /></Field>
    <div className="space-y-2 sm:col-span-3"><FormMessage state={state} /><SubmitButton variant="outline" pendingLabel={t(lang, "pf.saving")}>{t(lang, "pf.save")}</SubmitButton></div>
  </form>;
}
