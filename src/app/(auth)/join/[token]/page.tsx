import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "@/app/actions/account";

export const metadata: Metadata = { title: "Join your team", robots: { index: false, follow: false } };

/** A team invite link: sign in (or sign up), then join the business account to book trucks for it. */
export default async function JoinPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ token }, { error }] = await Promise.all([params, searchParams]);
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const next = encodeURIComponent(`/join/${token}`);
  return <div>
    <div className="grid h-12 w-12 place-items-center rounded-full bg-signal-soft text-primary"><Users className="h-6 w-6" /></div>
    <h1 className="mt-4 text-2xl font-bold">Join your team on Vemi</h1>
    <p className="mt-1 text-sm text-muted-foreground">You&apos;ve been invited to book trucks for a business account. Trips you book are paid and invoiced to the business, and your team sees them too.</p>
    {error ? <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
    {user ? <form action={acceptInvite} className="mt-6"><input type="hidden" name="token" value={token} /><SubmitButton className="w-full" pendingLabel="Joining…">Join the team</SubmitButton></form>
      : <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button asChild><Link href={`/signup?next=${next}`}>Create my login</Link></Button>
        <Button asChild variant="outline"><Link href={`/login?next=${next}`}>I already have one</Link></Button>
      </div>}
    <p className="mt-4 text-xs text-muted-foreground">Use the email address the invite was sent to.</p>
  </div>;
}
