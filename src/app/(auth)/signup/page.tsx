import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupPanel, cleanReferral } from "@/components/auth/auth-pages";
import { getLang } from "@/lib/i18n-server";
import { partnerSignupUrl } from "@/lib/portal";

export const metadata: Metadata = { title: "Create an account" };

/** Customer sign-up. Truck owners have their own sign-up in the partner portal; old ?role=carrier links go there. */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string; ref?: string; next?: string }> }) {
  const [{ role, ref, next }, lang] = await Promise.all([searchParams, getLang()]);
  const referral = cleanReferral(ref);
  if (role === "carrier") redirect(partnerSignupUrl({ ref: referral, next }));
  return <SignupPanel portal="customer" lang={lang} referral={referral} next={next} />;
}
