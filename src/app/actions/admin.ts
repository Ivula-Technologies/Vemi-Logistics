"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notify";
import { b2cConfigured, b2cPay } from "@/lib/mpesa";
import { promoSchema } from "@/lib/validations";
import { formatKes } from "@/lib/utils";
import { sendReceipt } from "@/lib/trip-notify";

function withMessage(path: string, key: "error" | "saved", value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

export async function reviewCarrier(formData: FormData) {
  await requireRole("admin");
  const carrierId = String(formData.get("carrierId"));
  const status = String(formData.get("status"));
  const note = String(formData.get("note") ?? "");
  const path = `/admin/carriers/${carrierId}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_carrier", { p_carrier: carrierId, p_status: status, p_note: note || null });
  if (error) redirect(withMessage(path, "error", error.message));
  after(() => notifyUser(carrierId,
    status === "verified" ? "You're verified on Vemi" : `Your Vemi carrier account: ${status}`,
    status === "verified" ? "You can now bid on loads. Open the load board to find your next trip." : `Your carrier account is ${status}.${note ? ` Note from Vemi: ${note}` : ""}`,
    status === "verified" ? "/board" : "/profile", { sms: status === "verified" }));
  revalidatePath("/admin/carriers");
  redirect(withMessage(path, "saved", "Saved"));
}

export async function recordBankPayment(formData: FormData) {
  await requireRole("admin");
  const tripId = String(formData.get("tripId"));
  const amount = Number.parseInt(String(formData.get("amount") ?? ""), 10);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_record_bank_payment", { p_trip: tripId, p_amount: amount, p_reference: String(formData.get("reference") ?? "") });
  if (error) redirect(withMessage(`/trips/${tripId}`, "error", error.message));
  after(async () => {
    const { data: trip } = await createAdminClient().from("trips").select("ref, carrier_id, shipper_id, status").eq("id", tripId).single();
    if (trip?.status === "scheduled") {
      await notifyUser(trip.carrier_id, `${trip.ref} is paid`, "The shipper has paid. You can dispatch the truck.", `/trips/${tripId}`, { sms: true });
    }
    if (trip) await sendReceipt(tripId, amount, "bank transfer", `bank-${tripId}-${amount}-${Date.now()}`);
  });
  revalidatePath(`/trips/${tripId}`);
  redirect(withMessage(`/trips/${tripId}`, "saved", "payment"));
}

export async function resolveDispute(formData: FormData) {
  await requireRole("admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const amount = Number.parseInt(String(formData.get("amount") ?? ""), 10);
  const outcome = String(formData.get("outcome"));
  const { error } = await supabase.rpc("admin_resolve_dispute", { p_trip: tripId, p_outcome: outcome, p_note: String(formData.get("note") ?? "") || null, p_amount: Number.isFinite(amount) ? amount : null });
  if (error) redirect(withMessage(`/trips/${tripId}`, "error", error.message));
  if (outcome === "split") after(async () => {
    const { data: trip } = await createAdminClient().from("trips").select("ref, shipper_id").eq("id", tripId).single();
    if (trip) await notifyUser(trip.shipper_id, `Your claim on ${trip.ref} is settled`, `${formatKes(amount)} is in your Vemi wallet. Use it on your next trip or cash it out to M-Pesa.`, "/wallet");
  });
  revalidatePath(`/trips/${tripId}`);
  redirect(withMessage(`/trips/${tripId}`, "saved", "dispute"));
}

export async function cancelTripAsAdmin(formData: FormData) {
  await requireRole("admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_trip", { p_trip: tripId, p_reason: String(formData.get("reason") ?? "") || "Cancelled by Vemi", p_reopen_load: formData.get("reopen") === "on" });
  if (error) redirect(withMessage(`/trips/${tripId}`, "error", error.message));
  revalidatePath(`/trips/${tripId}`);
  redirect(withMessage(`/trips/${tripId}`, "saved", "cancelled"));
}

export async function markPayoutsPaid(formData: FormData) {
  await requireRole("admin");
  const ids = formData.getAll("payoutId").map(String);
  if (!ids.length) redirect(withMessage("/admin/payouts", "error", "Tick the payouts you paid."));
  const supabase = await createClient();
  const { data: count, error } = await supabase.rpc("admin_mark_payouts_paid", { p_ids: ids, p_reference: String(formData.get("reference") ?? "") });
  if (error) redirect(withMessage("/admin/payouts", "error", error.message));
  after(async () => {
    const { data } = await createAdminClient().from("payouts").select("carrier_id, amount, reference, trips(ref)").in("id", ids).eq("status", "paid");
    for (const payout of data ?? []) {
      const ref = (payout.trips as unknown as { ref: string } | null)?.ref ?? "";
      await notifyUser(payout.carrier_id, `Payout sent for ${ref}`, `KES ${payout.amount.toLocaleString("en-KE")} was sent to your M-Pesa (ref ${payout.reference}).`, "/earnings", { sms: true });
    }
  });
  revalidatePath("/admin/payouts");
  redirect(withMessage("/admin/payouts", "saved", `${count} marked paid`));
}

const SETTING_KEYS = ["commission_bps", "founding_commission_bps", "auto_confirm_hours", "mpesa_max_kes", "urgent_surcharge_bps", "busy_lane_max_bps", "stop_fee_kes",
  "free_waiting_hours", "waiting_kes_per_hour", "cancel_fee_bps", "cancel_fee_min_kes", "insurance_bps", "insurance_min_kes", "fuel_advance_max_bps", "fuel_advance_fee_bps",
  "referral_reward_kes", "referee_credit_kes", "usd_rate"] as const;

export async function updateSettings(formData: FormData) {
  await requireRole("admin");
  const values: Record<string, number> = {};
  for (const key of SETTING_KEYS) {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) redirect(withMessage("/admin/settings", "error", `Check ${key.replaceAll("_", " ")}.`));
    values[key] = value;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_settings", { p: values });
  if (error) redirect(withMessage("/admin/settings", "error", error.message));
  revalidatePath("/admin/settings");
  redirect(withMessage("/admin/settings", "saved", "Settings saved"));
}

export async function savePromo(formData: FormData) {
  await requireRole("admin");
  const parsed = promoSchema.safeParse({
    code: formData.get("code"), description: formData.get("description") ?? "", kind: formData.get("kind"), value: formData.get("value"),
    maxDiscount: formData.get("maxDiscount") ?? "", maxUses: formData.get("maxUses") ?? "", minPrice: formData.get("minPrice") ?? "",
    expiresOn: formData.get("expiresOn") ?? "", firstTripOnly: formData.get("firstTripOnly") ?? "", active: formData.get("active") ?? "",
  });
  if (!parsed.success) redirect(withMessage("/admin/promos", "error", parsed.error.issues[0]?.message ?? "Check the promo code."));
  const p = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_promo", {
    p_code: p.code, p_description: p.description, p_kind: p.kind, p_value: p.value, p_max_discount: p.maxDiscount, p_max_uses: p.maxUses,
    p_first_trip_only: p.firstTripOnly, p_min_price: p.minPrice ?? 0, p_expires_at: p.expiresOn ? `${p.expiresOn}T23:59:59+03:00` : null, p_active: p.active,
  });
  if (error) redirect(withMessage("/admin/promos", "error", error.message));
  revalidatePath("/admin/promos");
  redirect(withMessage("/admin/promos", "saved", `${p.code} saved`));
}

export async function decideCredit(formData: FormData) {
  await requireRole("admin");
  const owner = String(formData.get("ownerId"));
  const status = String(formData.get("status"));
  const limit = Number.parseInt(String(formData.get("limit") ?? ""), 10);
  const terms = Number.parseInt(String(formData.get("terms") ?? ""), 10);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_decide_credit", { p_owner: owner, p_status: status, p_limit: Number.isFinite(limit) ? limit : null, p_terms: Number.isFinite(terms) ? terms : null, p_note: String(formData.get("note") ?? "") || null });
  if (error) redirect(withMessage("/admin/business", "error", error.message));
  after(() => notifyUser(owner, status === "approved" ? "Pay on invoice is on" : `Your credit request: ${status}`,
    status === "approved" ? `You can now book trips on account and pay monthly, up to ${formatKes(limit)} at a time, ${terms} days to pay.` : "Vemi could not offer credit terms right now. You can still pay per trip by M-Pesa, card or bank.", "/business#credit"));
  revalidatePath("/admin/business");
  redirect(withMessage("/admin/business", "saved", "Credit decision saved"));
}

export async function adjustWallet(formData: FormData) {
  await requireRole("admin");
  const account = String(formData.get("accountId"));
  const amount = Number.parseInt(String(formData.get("amount") ?? ""), 10);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_wallet_adjust", { p_account: account, p_amount: Number.isFinite(amount) ? amount : 0, p_reason: String(formData.get("reason") ?? "") });
  if (error) redirect(withMessage("/admin/business", "error", error.message));
  revalidatePath("/admin/business");
  redirect(withMessage("/admin/business", "saved", "Wallet adjusted"));
}

export async function markRefundsPaid(formData: FormData) {
  await requireRole("admin");
  const ids = formData.getAll("refundId").map(String);
  if (!ids.length) redirect(withMessage("/admin/refunds", "error", "Tick the cash-outs you paid."));
  const supabase = await createClient();
  const { data: count, error } = await supabase.rpc("admin_mark_refunds_paid", { p_ids: ids, p_reference: String(formData.get("reference") ?? "") });
  if (error) redirect(withMessage("/admin/refunds", "error", error.message));
  revalidatePath("/admin/refunds");
  redirect(withMessage("/admin/refunds", "saved", `${count} marked paid`));
}

export async function cancelRefund(formData: FormData) {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_refund", { p_id: String(formData.get("cancelId") ?? formData.get("id")), p_note: String(formData.get("note") ?? "") || null });
  if (error) redirect(withMessage("/admin/refunds", "error", error.message));
  revalidatePath("/admin/refunds");
  redirect(withMessage("/admin/refunds", "saved", "Cash-out cancelled and returned to the wallet"));
}

export async function clearSos(formData: FormData) {
  await requireRole("admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_clear_sos", { p_trip: tripId, p_note: String(formData.get("note") ?? "") || "Handled by Vemi ops" });
  if (error) redirect(withMessage(`/trips/${tripId}`, "error", error.message));
  revalidatePath("/admin/map");
  redirect(withMessage(String(formData.get("back") ?? `/trips/${tripId}`), "saved", "Alert cleared"));
}

/**
 * Sends ticked payouts or cash-outs straight to M-Pesa (B2C). Each one is marked "sending" first, so a
 * double click or a retry can never pay twice; Safaricom's result marks it paid (or back to queued).
 */
export async function sendByMpesa(formData: FormData) {
  await requireRole("admin");
  const kind = formData.get("kind") === "refund" ? "refund" : "payout";
  const page = kind === "refund" ? "/admin/refunds" : "/admin/payouts";
  if (!b2cConfigured()) redirect(withMessage(page, "error", "M-Pesa B2C is not set up yet. Use the bulk CSV."));
  const ids = formData.getAll(kind === "refund" ? "refundId" : "payoutId").map(String);
  if (!ids.length) redirect(withMessage(page, "error", "Tick what to send."));
  const admin = createAdminClient();
  const { data: rows } = await admin.from(kind === "refund" ? "refunds" : "payouts").select("id, amount, phone, status").in("id", ids).eq("status", "queued");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const secret = encodeURIComponent(process.env.MPESA_CALLBACK_SECRET ?? "");
  let sent = 0;
  const failures: string[] = [];
  for (const row of rows ?? []) {
    if (!row.phone) { failures.push("missing phone"); continue; }
    const conversationId = randomUUID();
    const { data: claimed } = await admin.rpc("b2c_sending", { p_kind: kind, p_id: row.id, p_conversation: conversationId });
    if (!claimed) continue;
    try {
      await b2cPay({ phone: row.phone, amount: row.amount, conversationId, remarks: kind === "refund" ? "Vemi wallet cash-out" : "Vemi trip payout",
        resultUrl: `${site}/api/mpesa/b2c/result?token=${secret}`, timeoutUrl: `${site}/api/mpesa/b2c/timeout?token=${secret}` });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "M-Pesa refused the payment";
      await admin.rpc("b2c_result", { p_conversation: conversationId, p_ok: false, p_receipt: null, p_error: message });
      failures.push(message);
    }
  }
  revalidatePath(page);
  if (failures.length) redirect(withMessage(page, "error", `${sent} sent. ${failures.length} not sent: ${failures[0]}`));
  redirect(withMessage(page, "saved", `${sent} sent to M-Pesa. They show as paid when Safaricom confirms`));
}
