"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Package, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/app/field";
import { signUp } from "@/app/actions/auth";
import { idleState } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "shipper", title: "I need goods moved", text: "Post loads, compare bids, track trips.", icon: Package },
  { value: "carrier", title: "I own trucks", text: "Find loads, bid, get paid to M-Pesa.", icon: Truck },
] as const;

export function SignupForm({ defaultRole, referral, next }: { defaultRole: "shipper" | "carrier"; referral?: string; next?: string }) {
  const [state, action] = useActionState(signUp, idleState);
  const [role, setRole] = useState<"shipper" | "carrier">(defaultRole);
  if (state.status === "success") return <div className="mt-6 rounded-lg border bg-card p-6"><p className="font-semibold">Almost there</p><p className="mt-1 text-sm text-muted-foreground">{state.message}</p></div>;
  return <form action={action} className="mt-6 space-y-4">
    <input type="hidden" name="next" value={next ?? ""} />
    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="sr-only">Account type</legend>
      {ROLES.map(({ value, title, text, icon: Icon }) => <label key={value} className={cn("cursor-pointer rounded-lg border p-3 transition-colors", role === value ? "border-primary bg-signal-soft ring-1 ring-primary" : "hover:bg-secondary")}>
        <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
        <Icon className="h-5 w-5 text-primary" />
        <span className="mt-2 block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </label>)}
    </fieldset>
    <Field label="Your name" htmlFor="fullName" error={state.fieldErrors?.fullName}><Input id="fullName" name="fullName" autoComplete="name" required /></Field>
    <Field label={role === "carrier" ? "Business or trading name (optional)" : "Company (optional)"} htmlFor="company" error={state.fieldErrors?.company}><Input id="company" name="company" autoComplete="organization" /></Field>
    <Field label="Mobile number" htmlFor="phone" hint="For trip updates by SMS. We never share it before a trip is paid." error={state.fieldErrors?.phone}><Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" autoComplete="tel" required /></Field>
    <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
    <Field label="Password" htmlFor="password" hint="At least 8 characters." error={state.fieldErrors?.password}><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
    <Field label="Referral code (optional)" htmlFor="ref" hint={role === "shipper" ? "Got a code from a friend? You both get Vemi credit after your first trip." : "Who told you about Vemi?"}><Input id="ref" name="ref" defaultValue={referral ?? ""} maxLength={7} autoCapitalize="characters" className="uppercase" /></Field>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="terms" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" required /><span>I agree to the <Link href="/terms" className="font-semibold underline" target="_blank">terms</Link> and <Link href="/privacy" className="font-semibold underline" target="_blank">privacy notice</Link>.</span></label>
    {state.fieldErrors?.terms ? <p className="text-xs text-destructive">{state.fieldErrors.terms[0]}</p> : null}
    <FormMessage state={state} />
    <SubmitButton className="w-full" pendingLabel="Creating your account…">{role === "carrier" ? "Join as a carrier" : "Join as a shipper"}</SubmitButton>
  </form>;
}
