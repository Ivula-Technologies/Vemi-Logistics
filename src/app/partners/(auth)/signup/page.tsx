import type { Metadata } from "next";
import { SignupPanel, cleanReferral } from "@/components/auth/auth-pages";
import { getLang } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Become a partner" };

/** Truck owners, fleets and logistics companies sign up here as carriers. */
export default async function PartnerSignupPage({ searchParams }: { searchParams: Promise<{ ref?: string; next?: string }> }) {
  const [{ ref, next }, lang] = await Promise.all([searchParams, getLang()]);
  return <SignupPanel portal="partner" lang={lang} referral={cleanReferral(ref)} next={next} />;
}
