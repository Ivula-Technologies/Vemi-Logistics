import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <div>
    <h1 className="text-2xl font-bold">Welcome back</h1>
    <p className="mt-1 text-sm text-muted-foreground">Sign in to post loads, bid, or follow your trips.</p>
    {error ? <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
    <LoginForm next={next} />
    <p className="mt-6 text-center text-sm text-muted-foreground">New to Vemi? <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">Create a free account</Link></p>
  </div>;
}
