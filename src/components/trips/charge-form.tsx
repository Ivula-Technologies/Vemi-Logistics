"use client";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage, selectClass } from "@/components/app/field";
import { requestCharge } from "@/app/actions/trips";
import { idleState } from "@/lib/types";
import { t, type AppLang } from "@/lib/i18n";

/** Carrier asks for an extra charge (an extra stop on the day, loading help). The shipper approves it. */
export function ChargeForm({ tripId, lang = "en" }: { tripId: string; lang?: AppLang }) {
  const [state, action] = useActionState(requestCharge, idleState);
  return <form action={action} className="grid gap-3 sm:grid-cols-3">
    <input type="hidden" name="tripId" value={tripId} />
    <Field label={t(lang, "form.chargeFor")} htmlFor="chargeKind"><select id="chargeKind" name="kind" className={selectClass} defaultValue="loading"><option value="loading">{t(lang, "form.chargeLoading")}</option><option value="extra_stop">{t(lang, "form.chargeStop")}</option><option value="other">{t(lang, "form.chargeOther")}</option></select></Field>
    <Field label={t(lang, "form.amount")} htmlFor="chargeAmount"><Input id="chargeAmount" name="amount" type="number" min="100" step="50" required /></Field>
    <Field label={t(lang, "form.why")} htmlFor="chargeNote"><Input id="chargeNote" name="note" minLength={5} maxLength={300} placeholder={t(lang, "form.whyPlaceholder")} required /></Field>
    <div className="space-y-2 sm:col-span-3"><FormMessage state={state} /><SubmitButton size="sm" variant="outline" pendingLabel={t(lang, "form.sending")}>{t(lang, "form.askShipper")}</SubmitButton></div>
  </form>;
}
