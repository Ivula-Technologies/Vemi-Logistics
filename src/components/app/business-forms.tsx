"use client";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage, selectClass } from "@/components/app/field";
import { PlaceSelect } from "@/components/loads/place-select";
import { inviteTeamMember, saveBusiness } from "@/app/actions/account";
import { savePlace } from "@/app/actions/loads";
import { displayPhone } from "@/lib/phone";
import { idleState, type BusinessAccount, type PlaceRow } from "@/lib/types";

export function BusinessForm({ business, fallbackName, disabled }: { business: BusinessAccount | null; fallbackName: string; disabled: boolean }) {
  const [state, action] = useActionState(saveBusiness, idleState);
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <fieldset disabled={disabled} className="contents">
      <Field label="Registered business name" htmlFor="legalName" error={state.fieldErrors?.legalName}><Input id="legalName" name="legalName" defaultValue={business?.legal_name ?? fallbackName} required /></Field>
      <Field label="KRA PIN (for invoices)" htmlFor="kraPin" error={state.fieldErrors?.kraPin}><Input id="kraPin" name="kraPin" defaultValue={business?.kra_pin ?? ""} placeholder="P051234567X" className="uppercase" /></Field>
      <Field label="Accounts email (receipts and invoices)" htmlFor="billingEmail" error={state.fieldErrors?.billingEmail}><Input id="billingEmail" name="billingEmail" type="email" defaultValue={business?.billing_email ?? ""} /></Field>
      <Field label="Accounts phone" htmlFor="billingPhone" error={state.fieldErrors?.billingPhone}><Input id="billingPhone" name="billingPhone" type="tel" defaultValue={displayPhone(business?.billing_phone ?? null)} /></Field>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <div><SubmitButton pendingLabel="Saving…">{business ? "Save" : "Create business account"}</SubmitButton></div>
    </fieldset>
  </form>;
}

export function InviteForm() {
  const [state, action] = useActionState(inviteTeamMember, idleState);
  return <form action={action} className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
    <Field label="Their work email" htmlFor="inviteEmail" error={state.fieldErrors?.email}><Input id="inviteEmail" name="email" type="email" required /></Field>
    <Field label="Can" htmlFor="inviteRole"><select id="inviteRole" name="role" className={selectClass} defaultValue="booker"><option value="booker">Book trucks</option><option value="admin">Book and manage</option></select></Field>
    <SubmitButton variant="outline" pendingLabel="Inviting…">Invite</SubmitButton>
    <div className="sm:col-span-3"><FormMessage state={state} /></div>
  </form>;
}

export function SavePlaceForm({ places }: { places: PlaceRow[] }) {
  const [state, action] = useActionState(savePlace, idleState);
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <Field label="Name it" htmlFor="placeLabel" error={state.fieldErrors?.label}><Input id="placeLabel" name="label" placeholder="Warehouse, Port gate, Kampala depot" required maxLength={60} /></Field>
    <Field label="Town" htmlFor="placeId" error={state.fieldErrors?.placeId}><PlaceSelect id="placeId" name="placeId" places={places} required /></Field>
    <Field label="Exact place (gate, street, landmark)" htmlFor="placeDetail" className="sm:col-span-2"><Input id="placeDetail" name="detail" maxLength={200} /></Field>
    <Field label="Contact name (optional)" htmlFor="contactName"><Input id="contactName" name="contactName" maxLength={120} /></Field>
    <Field label="Contact phone (optional)" htmlFor="contactPhone" error={state.fieldErrors?.contactPhone}><Input id="contactPhone" name="contactPhone" type="tel" /></Field>
    <div className="sm:col-span-2"><FormMessage state={state} /></div>
    <div><SubmitButton variant="outline" pendingLabel="Saving…">Save place</SubmitButton></div>
  </form>;
}
