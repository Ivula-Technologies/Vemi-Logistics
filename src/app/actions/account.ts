"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, getSession, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessSchema, kenyanPhone } from "@/lib/validations";
import { fieldErrors } from "@/lib/forms";
import { notifyOps, sendEmail } from "@/lib/notify";
import { formatKes } from "@/lib/utils";
import type { ActionState } from "@/lib/types";

/** First-time setup after Google sign-in: shipper or carrier, and a phone for trip texts. */
export async function chooseRole(_: ActionState, formData: FormData): Promise<ActionState> {
  await getCurrentUser();
  const role = formData.get("role") === "carrier" ? "carrier" : "shipper";
  const phone = kenyanPhone.safeParse(String(formData.get("phone") ?? ""));
  if (!phone.success) return { status: "error", message: "Check the highlighted details.", fieldErrors: { phone: [phone.error.issues[0]?.message ?? "Enter your mobile number."] } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("choose_role", { p_role: role, p_phone: phone.data, p_company: String(formData.get("company") ?? "") || null, p_ref: String(formData.get("ref") ?? "") || null });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/", "layout");
  redirect(role === "carrier" ? "/profile?welcome=1" : "/loads/new?welcome=1");
}

// ---------------------------------------------------------------------------------------------
// Business accounts (Uber for Business): company details, team logins, credit terms
// ---------------------------------------------------------------------------------------------

export async function saveBusiness(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, accountId, accountAdmin, profile } = await requireRole("shipper");
  if (!accountAdmin) return { status: "error", message: "Only the account owner or an admin can change these details." };
  const parsed = businessSchema.safeParse({ legalName: formData.get("legalName"), kraPin: formData.get("kraPin") ?? "", billingEmail: formData.get("billingEmail") ?? "", billingPhone: formData.get("billingPhone") ?? "" });
  if (!parsed.success) return { status: "error", message: "Check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  const details = { legal_name: parsed.data.legalName, kra_pin: parsed.data.kraPin, billing_email: parsed.data.billingEmail, billing_phone: parsed.data.billingPhone };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("business_accounts").select("owner_id").eq("owner_id", accountId).maybeSingle();
  const { error } = existing
    ? await supabase.from("business_accounts").update(details).eq("owner_id", accountId)
    : await supabase.from("business_accounts").insert({ owner_id: user.id, ...details });
  if (error) return { status: "error", message: error.message };
  if (!existing) after(() => notifyOps("New business account", `${parsed.data.legalName} (${profile.full_name}) set up a business account.`, "/admin/business"));
  revalidatePath("/business");
  return { status: "success", message: existing ? "Saved." : "Business account ready. Invite your team and ask for credit terms below." };
}

export async function inviteTeamMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireRole("shipper");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { status: "error", message: "Enter their work email.", fieldErrors: { email: ["Enter a valid email."] } };
  const role = formData.get("role") === "admin" ? "admin" : "booker";
  const supabase = await createClient();
  const { data: inviteId, error } = await supabase.rpc("create_team_invite", { p_email: email, p_role: role });
  if (error) return { status: "error", message: error.message };
  // The token is never readable through the API; the server reads it once to build the link.
  const admin = createAdminClient();
  const [{ data: invite }, { data: business }] = await Promise.all([
    admin.from("team_invites").select("token, account_id").eq("id", inviteId).single(),
    supabase.from("business_accounts").select("legal_name").limit(1).maybeSingle(),
  ]);
  const company = business?.legal_name ?? profile.company ?? "your company";
  const sent = invite ? await sendEmail(email, `Join ${company} on Vemi`, `${profile.full_name} invited you to book trucks for ${company} on Vemi Logistics. The invite works for 7 days. Sign up or sign in with this email, then open the link.`, `/join/${invite.token}`, `invite-${inviteId}`) : false;
  revalidatePath("/business");
  return { status: "success", message: sent ? `Invite sent to ${email}.` : `Invite created. Email isn't set up, so share this link: ${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/join/${invite?.token}` };
}

export async function revokeInvite(formData: FormData) {
  await requireRole("shipper");
  const supabase = await createClient();
  await supabase.from("team_invites").delete().eq("id", String(formData.get("id")));
  revalidatePath("/business");
  redirect("/business?saved=revoked#team");
}

export async function removeTeamMember(formData: FormData) {
  const { user } = await requireRole("shipper");
  const memberId = String(formData.get("memberId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_team_member", { p_member: memberId });
  if (error) redirect("/business?error=" + encodeURIComponent(error.message) + "#team");
  revalidatePath("/", "layout");
  redirect(memberId === user.id ? "/home" : "/business?saved=removed#team");
}

export async function acceptInvite(formData: FormData) {
  await getCurrentUser();
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_team_invite", { p_token: token });
  if (error) redirect(`/join/${token}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect("/home?joined=1");
}

export async function requestCredit() {
  const { profile } = await requireRole("shipper");
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_credit");
  if (error) redirect("/business?error=" + encodeURIComponent(error.message) + "#credit");
  after(() => notifyOps("Credit terms requested", `${profile.company || profile.full_name} asked to pay on invoice. Check them and set a limit.`, "/admin/business"));
  revalidatePath("/business");
  redirect("/business?saved=credit#credit");
}

// ---------------------------------------------------------------------------------------------
// Wallet: cash out to M-Pesa
// ---------------------------------------------------------------------------------------------

export async function requestCashout(_: ActionState, formData: FormData): Promise<ActionState> {
  await getSession();
  const phone = kenyanPhone.safeParse(String(formData.get("phone") ?? ""));
  if (!phone.success) return { status: "error", message: "Enter a Safaricom number like 0712 345 678." };
  const amount = Number(String(formData.get("amount") ?? "").replace(/[,\s]/g, ""));
  if (!Number.isInteger(amount)) return { status: "error", message: "Enter a whole number of shillings." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_cashout", { p_amount: amount, p_phone: phone.data });
  if (error) return { status: "error", message: error.message };
  after(() => notifyOps("Wallet cash-out", `Send ${formatKes(amount)} to ${phone.data}.`, "/admin/refunds"));
  revalidatePath("/wallet");
  return { status: "success", message: `${formatKes(amount)} is on its way to your M-Pesa, usually within one working day.` };
}
