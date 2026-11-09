import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton, LoginForm, PhoneLogin } from "@/components/auth/login-form";
import { phoneLoginConfigured } from "@/lib/phone-login";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, lang] = await Promise.all([searchParams, getLang()]);
  return <div>
    <h1 className="text-2xl font-bold">{t(lang, "auth.welcomeBack")}</h1>
    <p className="mt-1 text-sm text-muted-foreground">{t(lang, "auth.signInIntro")}</p>
    {error ? <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
    {process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "on" ? <GoogleButton next={next} label={t(lang, "auth.google")} lang={lang} /> : null}
    {phoneLoginConfigured() ? <PhoneLogin next={next} lang={lang} /> : null}
    <LoginForm next={next} lang={lang} />
    <p className="mt-6 text-center text-sm text-muted-foreground">{t(lang, "auth.newHere")} <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">{t(lang, "auth.createFree")}</Link></p>
  </div>;
}
