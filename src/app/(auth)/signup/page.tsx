import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { GoogleButton } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string; ref?: string; next?: string }> }) {
  const { role, ref, next } = await searchParams;
  const referral = ref?.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7);
  return <div>
    <h1 className="text-2xl font-bold">Join Vemi</h1>
    <p className="mt-1 text-sm text-muted-foreground">Free to join. Shippers pay only for trips; carriers pay a small commission only when they earn.</p>
    {process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "on" ? <GoogleButton next="/welcome" referral={referral} label="Sign up with Google" /> : null}
    <SignupForm defaultRole={role === "carrier" ? "carrier" : "shipper"} referral={referral} next={next?.startsWith("/join/") ? next : undefined} />
    <p className="mt-6 text-center text-sm text-muted-foreground">Already on Vemi? <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">Sign in</Link></p>
  </div>;
}
