"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { accountSchema, kenyanPhone, signInSchema, signUpSchema } from "@/lib/validations";
import { checkLoginCode, phoneLoginConfigured, sendLoginCode } from "@/lib/phone-login";
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
  const requested = formData.get("next");
  const next = typeof requested === "string" && requested ? safeNextPath(requested) : parsed.data.role === "carrier" ? "/profile?welcome=1" : "/loads/new?welcome=1";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { role: parsed.data.role, full_name: parsed.data.fullName, company: parsed.data.company ?? "", phone: parsed.data.phone, ref: String(formData.get("ref") ?? "").trim().toUpperCase().slice(0, 7) },
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

// ---------------------------------------------------------------------------------------------
// Sign in with a phone number (SMS code) and with Google
// ---------------------------------------------------------------------------------------------

export async function sendPhoneCode(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!phoneLoginConfigured()) return { status: "error", message: "Phone sign-in isn't switched on yet. Use your email." };
  const phone = kenyanPhone.safeParse(String(formData.get("phone") ?? ""));
  if (!phone.success) return { status: "error", message: "Enter your mobile number like 0712 345 678." };
  try {
    await sendLoginCode(phone.data);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not send a code." };
  }
  return { status: "success", message: "If that number has a Vemi account, a 6-digit code is on its way by SMS." };
}

export async function verifyPhoneCode(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!phoneLoginConfigured()) return { status: "error", message: "Phone sign-in isn't switched on yet. Use your email." };
  const phone = kenyanPhone.safeParse(String(formData.get("phone") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!phone.success || !/^\d{6}$/.test(code)) return { status: "error", message: "Enter the 6-digit code from the SMS." };
  const result = await checkLoginCode(phone.data, code);
  if ("error" in result) return { status: "error", message: result.error };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: "magiclink" });
  if (error || !data.user) return { status: "error", message: "Could not sign you in. Ask for a new code." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  redirect(profile?.role === "admin" ? "/admin" : safeNextPath(formData.get("next")));
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const next = safeNextPath(formData.get("next"));
  const ref = String(formData.get("ref") ?? "").trim().toUpperCase().slice(0, 7);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.message ?? "Google sign-in is not available.")}`);
  redirect(data.url);
}
