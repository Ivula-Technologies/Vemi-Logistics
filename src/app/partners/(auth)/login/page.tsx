import type { Metadata } from "next";
import { LoginPanel } from "@/components/auth/auth-pages";
import { getLang } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Partner sign-in" };

export default async function PartnerLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, lang] = await Promise.all([searchParams, getLang()]);
  return <LoginPanel portal="partner" lang={lang} next={next} error={error} />;
}
