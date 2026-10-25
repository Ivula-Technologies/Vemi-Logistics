"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notify";

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
      await notifyUser(trip.shipper_id, `Payment received for ${trip.ref}`, "We received your bank transfer. The truck is being dispatched.", `/trips/${tripId}`);
    }
  });
  revalidatePath(`/trips/${tripId}`);
  redirect(withMessage(`/trips/${tripId}`, "saved", "payment"));
}

export async function resolveDispute(formData: FormData) {
  await requireRole("admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_resolve_dispute", { p_trip: tripId, p_outcome: String(formData.get("outcome")), p_note: String(formData.get("note") ?? "") || null });
  if (error) redirect(withMessage(`/trips/${tripId}`, "error", error.message));
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
