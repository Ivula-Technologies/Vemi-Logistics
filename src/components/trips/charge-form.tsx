"use client";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage, selectClass } from "@/components/app/field";
import { requestCharge } from "@/app/actions/trips";
import { idleState } from "@/lib/types";

/** Carrier asks for an extra charge (an extra stop on the day, loading help). The shipper approves it. */
export function ChargeForm({ tripId }: { tripId: string }) {
  const [state, action] = useActionState(requestCharge, idleState);
  return <form action={action} className="grid gap-3 sm:grid-cols-3">
    <input type="hidden" name="tripId" value={tripId} />
    <Field label="For" htmlFor="chargeKind"><select id="chargeKind" name="kind" className={selectClass} defaultValue="loading"><option value="loading">Loading or offloading help</option><option value="extra_stop">An extra stop</option><option value="other">Something else</option></select></Field>
    <Field label="Amount (KES)" htmlFor="chargeAmount"><Input id="chargeAmount" name="amount" type="number" min="100" step="50" required /></Field>
    <Field label="Why" htmlFor="chargeNote"><Input id="chargeNote" name="note" minLength={5} maxLength={300} placeholder="e.g. 2 casual loaders at Kampala" required /></Field>
    <div className="space-y-2 sm:col-span-3"><FormMessage state={state} /><SubmitButton size="sm" variant="outline" pendingLabel="Sending…">Ask the shipper</SubmitButton></div>
  </form>;
}
