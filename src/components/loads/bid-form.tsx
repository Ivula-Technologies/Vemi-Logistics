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

export function BidForm({ loadId, offered, bps, current, currentNote }: { loadId: string; offered: number; bps: number; current: number | null; currentNote: string }) {
  const [state, action] = useActionState(placeBid, idleState);
  const [amount, setAmount] = useState(String(current ?? offered));
  const value = Number.parseInt(amount, 10);
  return <form action={action} className="space-y-3 rounded-lg border bg-card p-4">
    <input type="hidden" name="loadId" value={loadId} />
    <Field label={current ? "Change your bid (KES)" : "Your price for the trip (KES)"} htmlFor="amount" error={state.fieldErrors?.amount}>
      <Input id="amount" name="amount" type="number" inputMode="numeric" min="1000" step="500" value={amount} onChange={(e) => setAmount(e.target.value)} required />
    </Field>
    {value >= 1000 ? <p className="rounded-md bg-signal-soft px-3 py-2 text-sm">You receive <strong>{formatKes(carrierPayout(value, bps))}</strong> to M-Pesa after delivery (Vemi commission {percent(bps)}).</p> : null}
    <Field label="Message to the shipper (optional)" htmlFor="note" error={state.fieldErrors?.note}><Textarea id="note" name="note" rows={2} defaultValue={currentNote} placeholder="e.g. Truck is in Mombasa, can load tomorrow 7am" maxLength={300} /></Field>
    <FormMessage state={state} />
    <SubmitButton className="w-full" pendingLabel="Sending…">{value === offered ? `Accept at ${formatKes(offered)}` : current ? "Update bid" : "Send bid"}</SubmitButton>
  </form>;
}
