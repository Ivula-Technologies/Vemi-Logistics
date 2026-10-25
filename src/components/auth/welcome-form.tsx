"use client";
import { useActionState, useState } from "react";
import { Building2, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/app/field";
import { chooseRole } from "@/app/actions/account";
import { idleState } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "shipper", title: "I move goods", text: "Post loads, get bids, track trucks.", icon: Building2 },
  { value: "carrier", title: "I own trucks", text: "Find loads, get paid to M-Pesa.", icon: Truck },
] as const;

/** One step after Google sign-in: what you do, and a mobile number for trip texts. */
export function WelcomeForm({ referral }: { referral?: string }) {
  const [state, action] = useActionState(chooseRole, idleState);
  const [role, setRole] = useState<"shipper" | "carrier">("shipper");
  return <form action={action} className="mt-6 space-y-4">
    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="sr-only">Account type</legend>
      {ROLES.map(({ value, title, text, icon: Icon }) => <label key={value} className={cn("cursor-pointer rounded-lg border p-3 transition-colors", role === value ? "border-primary bg-signal-soft ring-1 ring-primary" : "hover:bg-secondary")}>
        <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
        <Icon className="h-5 w-5 text-primary" />
        <span className="mt-2 block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </label>)}
    </fieldset>
    <Field label={role === "carrier" ? "Business or trading name (optional)" : "Company (optional)"} htmlFor="company"><Input id="company" name="company" autoComplete="organization" /></Field>
    <Field label="Mobile number" htmlFor="phone" hint="For trip updates by SMS. We never share it before a trip is paid." error={state.fieldErrors?.phone}><Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" autoComplete="tel" required /></Field>
    <Field label="Referral code (optional)" htmlFor="ref"><Input id="ref" name="ref" defaultValue={referral ?? ""} maxLength={7} className="uppercase" /></Field>
    <FormMessage state={state} />
    <SubmitButton className="w-full" pendingLabel="Setting up…">Continue</SubmitButton>
  </form>;
}
