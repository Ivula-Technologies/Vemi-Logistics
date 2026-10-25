"use client";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/app/field";
import { requestCashout } from "@/app/actions/account";
import { idleState } from "@/lib/types";

export function CashoutForm({ balance, defaultPhone }: { balance: number; defaultPhone: string }) {
  const [state, action] = useActionState(requestCashout, idleState);
  return <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
    <Field label="Amount (KES)" htmlFor="amount"><Input id="amount" name="amount" type="number" min="100" max={balance} defaultValue={balance} inputMode="numeric" required /></Field>
    <Field label="M-Pesa number" htmlFor="cashoutPhone"><Input id="cashoutPhone" name="phone" type="tel" inputMode="tel" defaultValue={defaultPhone} required /></Field>
    <SubmitButton variant="outline" pendingLabel="Sending…">Cash out</SubmitButton>
    <div className="sm:col-span-3"><FormMessage state={state} /></div>
  </form>;
}
