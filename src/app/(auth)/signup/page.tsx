import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  return <div>
    <h1 className="text-2xl font-bold">Join Vemi</h1>
    <p className="mt-1 text-sm text-muted-foreground">Free to join. Shippers pay only for trips; carriers pay a small commission only when they earn.</p>
    <SignupForm defaultRole={role === "carrier" ? "carrier" : "shipper"} />
    <p className="mt-6 text-center text-sm text-muted-foreground">Already on Vemi? <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">Sign in</Link></p>
  </div>;
}
