import type { Metadata } from "next";
import { LoginPanel } from "@/components/auth/auth-pages";
import { getLang } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, lang] = await Promise.all([searchParams, getLang()]);
  return <LoginPanel portal="customer" lang={lang} next={next} error={error} />;
}
