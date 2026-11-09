import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WelcomeForm } from "@/components/auth/welcome-form";
import { getSession } from "@/lib/auth";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [{ profile }, { ref }, lang] = await Promise.all([getSession(), searchParams, getLang()]);
  const first = profile.full_name.split(" ")[0];
  if (profile.onboarded || profile.role === "admin") redirect(profile.role === "admin" ? "/admin" : "/home");
  return <div>
    <h1 className="text-2xl font-bold">{first ? t(lang, "auth.karibu", { name: first }) : t(lang, "auth.karibuNoName")}</h1>
    <p className="mt-1 text-sm text-muted-foreground">{t(lang, "auth.oneStep")}</p>
    <WelcomeForm referral={ref?.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7)} lang={lang} />
  </div>;
}
