import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WelcomeForm } from "@/components/auth/welcome-form";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [{ profile }, { ref }] = await Promise.all([getSession(), searchParams]);
  if (profile.onboarded || profile.role === "admin") redirect(profile.role === "admin" ? "/admin" : "/home");
  return <div>
    <h1 className="text-2xl font-bold">Karibu, {profile.full_name.split(" ")[0] || "and welcome"}</h1>
    <p className="mt-1 text-sm text-muted-foreground">One last step: tell us how you&apos;ll use Vemi.</p>
    <WelcomeForm referral={ref?.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7)} />
  </div>;
}
