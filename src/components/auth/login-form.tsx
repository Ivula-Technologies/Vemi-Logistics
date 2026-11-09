"use client";
import { useActionState, useState } from "react";
import { Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/app/field";
import { sendMagicLink, sendPhoneCode, signIn, signInWithGoogle, verifyPhoneCode } from "@/app/actions/auth";
import { idleState } from "@/lib/types";
import { t, type AppLang } from "@/lib/i18n";

export function LoginForm({ next, lang = "en" }: { next?: string; lang?: AppLang }) {
  const [state, action] = useActionState(signIn, idleState);
  const [linkState, linkAction] = useActionState(sendMagicLink, idleState);
  return <form action={action} className="mt-6 space-y-4">
    <input type="hidden" name="next" value={next ?? ""} />
    <Field label={t(lang, "auth.email")} htmlFor="email" error={state.fieldErrors?.email}><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
    <Field label={t(lang, "auth.password")} htmlFor="password" error={state.fieldErrors?.password}><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
    <FormMessage state={state} />
    <SubmitButton className="w-full" pendingLabel={t(lang, "auth.signingIn")}>{t(lang, "auth.signIn")}</SubmitButton>
    <div className="text-center"><button type="submit" formAction={linkAction} formNoValidate data-magic className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{t(lang, "auth.magic")}</button></div>
    <FormMessage state={linkState} />
  </form>;
}

/** Sign in with a 6-digit SMS code: most drivers and many truck owners don't use email. */
export function PhoneLogin({ next, lang = "en" }: { next?: string; lang?: AppLang }) {
  const [sent, sendAction] = useActionState(sendPhoneCode, idleState);
  const [checked, checkAction] = useActionState(verifyPhoneCode, idleState);
  const [phone, setPhone] = useState("");
  return <details className="mt-6 rounded-lg border bg-card p-4" open={sent.status === "success"}>
    <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4 text-primary" />{t(lang, "auth.phoneSignIn")}</summary>
    <form action={sendAction} className="mt-3 space-y-3">
      <Field label={t(lang, "auth.mobile")} htmlFor="loginPhone"><Input id="loginPhone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
      <SubmitButton variant="outline" className="w-full" pendingLabel={t(lang, "auth.sending")}>{sent.status === "success" ? t(lang, "auth.newCode") : t(lang, "auth.textCode")}</SubmitButton>
      <FormMessage state={sent} />
    </form>
    {sent.status === "success" ? <form action={checkAction} className="mt-3 space-y-3 border-t pt-3">
      <input type="hidden" name="phone" value={phone} /><input type="hidden" name="next" value={next ?? ""} />
      <Field label={t(lang, "auth.code")} htmlFor="loginCode"><Input id="loginCode" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} className="text-center text-lg tracking-[0.4em]" required /></Field>
      <FormMessage state={checked} />
      <SubmitButton className="w-full" pendingLabel={t(lang, "auth.signingIn")}>{t(lang, "auth.signIn")}</SubmitButton>
    </form> : null}
  </details>;
}

export function GoogleButton({ next, referral, label, lang = "en" }: { next?: string; referral?: string; label: string; lang?: AppLang }) {
  return <form action={signInWithGoogle} className="mt-6">
    <input type="hidden" name="next" value={next ?? ""} /><input type="hidden" name="ref" value={referral ?? ""} />
    <SubmitButton variant="outline" className="w-full" pendingLabel={t(lang, "auth.openingGoogle")}><svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" /><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" /></svg>{label}</SubmitButton>
  </form>;
}
