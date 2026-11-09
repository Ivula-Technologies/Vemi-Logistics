"use client";
import { useActionState, useState } from "react";
import { Building2, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/app/field";
import { chooseRole } from "@/app/actions/account";
import { idleState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { t, type AppLang } from "@/lib/i18n";

const ROLES = [
  { value: "shipper", title: "auth.welcome.shipper", text: "auth.welcome.shipperText", icon: Building2 },
  { value: "carrier", title: "auth.role.carrier", text: "auth.welcome.carrierText", icon: Truck },
] as const;

/** One step after Google sign-in: what you do, and a mobile number for trip texts. */
export function WelcomeForm({ referral, lang = "en" }: { referral?: string; lang?: AppLang }) {
  const [state, action] = useActionState(chooseRole, idleState);
  const [role, setRole] = useState<"shipper" | "carrier">("shipper");
  return <form action={action} className="mt-6 space-y-4">
    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="sr-only">{t(lang, "auth.accountType")}</legend>
      {ROLES.map(({ value, title, text, icon: Icon }) => <label key={value} className={cn("cursor-pointer rounded-lg border p-3 transition-colors", role === value ? "border-primary bg-signal-soft ring-1 ring-primary" : "hover:bg-secondary")}>
        <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
        <Icon className="h-5 w-5 text-primary" />
        <span className="mt-2 block text-sm font-semibold">{t(lang, title)}</span>
        <span className="block text-xs text-muted-foreground">{t(lang, text)}</span>
      </label>)}
    </fieldset>
    <Field label={t(lang, role === "carrier" ? "auth.businessName" : "auth.company")} htmlFor="company"><Input id="company" name="company" autoComplete="organization" /></Field>
    <Field label={t(lang, "auth.mobile")} htmlFor="phone" hint={t(lang, "auth.phoneHint")} error={state.fieldErrors?.phone}><Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" autoComplete="tel" required /></Field>
    <Field label={t(lang, "auth.referral")} htmlFor="ref"><Input id="ref" name="ref" defaultValue={referral ?? ""} maxLength={7} className="uppercase" /></Field>
    <FormMessage state={state} />
    <SubmitButton className="w-full" pendingLabel={t(lang, "auth.settingUp")}>{t(lang, "auth.continue")}</SubmitButton>
  </form>;
}
