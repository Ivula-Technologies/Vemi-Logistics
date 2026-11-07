"use client";
import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/app/field";
import { placeBid } from "@/app/actions/bids";
import { carrierPayout, percent } from "@/lib/commission";
import { formatKes } from "@/lib/utils";
import { idleState } from "@/lib/types";
import { t, type AppLang } from "@/lib/i18n";

export function BidForm({ loadId, offered, bps, current, currentNote, lang = "en" }: { loadId: string; offered: number; bps: number; current: number | null; currentNote: string; lang?: AppLang }) {
  const [state, action] = useActionState(placeBid, idleState);
  const [amount, setAmount] = useState(String(current ?? offered));
  const value = Number.parseInt(amount, 10);
  return <form action={action} className="space-y-3 rounded-lg border bg-card p-4">
    <input type="hidden" name="loadId" value={loadId} />
    <Field label={current ? t(lang, "bidform.change") : t(lang, "bidform.price")} htmlFor="amount" error={state.fieldErrors?.amount}>
      <Input id="amount" name="amount" type="number" inputMode="numeric" min="1000" step="500" value={amount} onChange={(e) => setAmount(e.target.value)} required />
    </Field>
    {value >= 1000 ? <p className="rounded-md bg-signal-soft px-3 py-2 text-sm">{t(lang, "bidform.receive", { amount: "@@", percent: percent(bps) }).split("@@")[0]}<strong>{formatKes(carrierPayout(value, bps))}</strong>{t(lang, "bidform.receive", { amount: "@@", percent: percent(bps) }).split("@@")[1]}</p> : null}
    <Field label={t(lang, "bidform.message")} htmlFor="note" error={state.fieldErrors?.note}><Textarea id="note" name="note" rows={2} defaultValue={currentNote} placeholder={t(lang, "bidform.placeholder")} maxLength={300} /></Field>
    <FormMessage state={state} />
    <SubmitButton className="w-full" pendingLabel={t(lang, "bidform.sending")}>{value === offered ? t(lang, "bidform.accept", { amount: formatKes(offered) }) : current ? t(lang, "bidform.update") : t(lang, "bidform.send")}</SubmitButton>
  </form>;
}
