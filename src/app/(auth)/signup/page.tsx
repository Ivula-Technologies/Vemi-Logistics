import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { GoogleButton } from "@/components/auth/login-form";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string; ref?: string; next?: string }> }) {
  const [{ role, ref, next }, lang] = await Promise.all([searchParams, getLang()]);
  const referral = ref?.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7);
  return <div>
    <h1 className="text-2xl font-bold">{t(lang, "auth.join")}</h1>
    <p className="mt-1 text-sm text-muted-foreground">{t(lang, "auth.joinIntro")}</p>
    {process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "on" ? <GoogleButton next="/welcome" referral={referral} label={t(lang, "auth.googleSignup")} lang={lang} /> : null}
    <SignupForm defaultRole={role === "carrier" ? "carrier" : "shipper"} referral={referral} next={next?.startsWith("/join/") ? next : undefined} lang={lang} />
    <p className="mt-6 text-center text-sm text-muted-foreground">{t(lang, "auth.already")} <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">{t(lang, "auth.signIn")}</Link></p>
  </div>;
}
