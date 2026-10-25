"use client";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/app/field";
import { sendMagicLink, signIn } from "@/app/actions/auth";
import { idleState } from "@/lib/types";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, idleState);
  const [linkState, linkAction] = useActionState(sendMagicLink, idleState);
  return <form action={action} className="mt-6 space-y-4">
    <input type="hidden" name="next" value={next ?? ""} />
    <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
    <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
    <FormMessage state={state} />
    <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
    <div className="text-center"><button type="submit" formAction={linkAction} formNoValidate data-magic className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Forgot your password? Email me a sign-in link</button></div>
    <FormMessage state={linkState} />
  </form>;
}
