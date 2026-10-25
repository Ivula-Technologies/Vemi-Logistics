"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { accountSchema, signInSchema, signUpSchema } from "@/lib/validations";
import { safeNextPath } from "@/lib/utils";
import { fieldErrors } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

async function origin() {
  return (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", message: "Check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: error.message === "Invalid login credentials" ? "That email and password do not match." : error.message };
  const requested = formData.get("next");
  if (typeof requested === "string" && requested) redirect(safeNextPath(requested));
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  redirect(profile?.role === "admin" ? "/admin" : "/home");
}

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    role: formData.get("role"), fullName: formData.get("fullName"), company: formData.get("company") ?? "", phone: formData.get("phone"),
    email: formData.get("email"), password: formData.get("password"), terms: formData.get("terms"),
  });
  if (!parsed.success) return { status: "error", message: "Check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  const next = parsed.data.role === "carrier" ? "/profile?welcome=1" : "/loads/new?welcome=1";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { role: parsed.data.role, full_name: parsed.data.fullName, company: parsed.data.company ?? "", phone: parsed.data.phone },
    },
  });
  if (error) return { status: "error", message: error.message };
  if (data.session) redirect(next);
  return { status: "success", message: "Check your email and tap the link to confirm your account. It brings you straight back to Vemi." };
}

export async function sendMagicLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { status: "error", message: "Enter your email address first." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${await origin()}/auth/callback?next=/home` } });
  if (error) return { status: "error", message: error.message };
  return { status: "success", message: "If that email has a Vemi account, a sign-in link is on its way." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = accountSchema.safeParse({ fullName: formData.get("fullName"), company: formData.get("company") ?? "", phone: formData.get("phone") });
  if (!parsed.success) return { status: "error", message: "Check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName, company: parsed.data.company, phone: parsed.data.phone }).eq("id", user.id);
  if (error) return { status: "error", message: error.message };
  revalidatePath("/", "layout");
  return { status: "success", message: "Saved." };
}
