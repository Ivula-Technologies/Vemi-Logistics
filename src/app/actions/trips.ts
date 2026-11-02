"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOps, notifyUser, sendSms, smsConfigured } from "@/lib/notify";
import { removePrivateFile, storePrivateFile, uploadProblem } from "@/lib/storage";
import { tellAboutMessage, tellShipperAboutStatus } from "@/lib/trip-notify";
import { startTripCall, type CallTarget } from "@/lib/calls";
import { driverText } from "@/lib/driver-i18n";
import { chargeSchema } from "@/lib/validations";
import { BORDER_PAPERS, BORDER_PAPER_KINDS, COMPLIMENTS, type BorderPaperKind, type TripStatus } from "@/lib/trips";
import { formatKes } from "@/lib/utils";
import type { ActionState } from "@/lib/types";

function back(tripId: string, params: Record<string, string>, hash = "") {
  return `/trips/${tripId}?${new URLSearchParams(params).toString()}${hash}`;
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

function number(value: FormDataEntryValue | null) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function wholeKes(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(/[,\s]/g, ""));
  return Number.isInteger(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------------------------
// Carrier: assign, move the trip, stops, delivery photo, extras, fuel advance, cancel
// ---------------------------------------------------------------------------------------------

export async function assignTrip(formData: FormData) {
  await requireRole("carrier");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_trip", { p_trip: tripId, p_truck: String(formData.get("truckId") ?? ""), p_driver: String(formData.get("driverId") ?? "") });
  if (error) redirect(back(tripId, { error: error.message }));
  // Text the driver their trip link (in their language) when SMS is set up; the carrier can always share it on WhatsApp too.
  if (formData.get("smsDriver") === "on" && smsConfigured()) {
    const [{ data: token }, { data: trip }] = await Promise.all([
      supabase.rpc("trip_driver_token", { p_trip: tripId }),
      supabase.from("trips").select("ref, drivers(phone, language)").eq("id", tripId).single(),
    ]);
    const driver = trip?.drivers as unknown as { phone: string; language: string } | null;
    if (token && driver?.phone) after(() => sendSms(driver.phone, driverText(driver.language).sms(trip!.ref, `${siteUrl()}/d/${token}`)).then(() => undefined));
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "assigned" }));
}

export async function carrierUpdateTrip(formData: FormData) {
  await requireRole("carrier");
  const tripId = String(formData.get("tripId"));
  const status = String(formData.get("status")) as TripStatus;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("carrier_update_trip", {
    p_trip: tripId, p_status: status, p_note: String(formData.get("note") ?? "") || null,
    p_lat: number(formData.get("lat")), p_lng: number(formData.get("lng")), p_code: String(formData.get("code") ?? "") || null,
  });
  const result = data as { ok: boolean; error?: string } | null;
  if (error || !result?.ok) redirect(back(tripId, { error: error?.message ?? result?.error ?? "Could not update the trip." }));
  after(() => tellShipperAboutStatus(tripId, status));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "status" }));
}

export async function carrierStopDone(formData: FormData) {
  await requireRole("carrier");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("carrier_stop_done", { p_trip: tripId, p_seq: Number(formData.get("seq")) });
  if (error) redirect(back(tripId, { error: error.message }));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "stop" }));
}

export async function uploadPodAsCarrier(formData: FormData) {
  await requireRole("carrier");
  const tripId = String(formData.get("tripId"));
  const file = formData.get("file") as File | null;
  const problem = uploadProblem(file);
  if (problem) redirect(back(tripId, { error: problem }));
  const supabase = await createClient();
  const { data: token } = await supabase.rpc("trip_driver_token", { p_trip: tripId });
  if (!token) redirect(back(tripId, { error: "Trip not found." }));
  const path = await storePrivateFile("pod", tripId, file!);
  const { error } = await createAdminClient().rpc("driver_attach_pod", { p_token: token, p_path: path });
  if (error) redirect(back(tripId, { error: error.message }));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "pod" }));
}

export async function requestCharge(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("carrier");
  const parsed = chargeSchema.safeParse({ tripId: formData.get("tripId"), kind: formData.get("kind"), amount: formData.get("amount"), note: formData.get("note") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the charge." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_charge", { p_trip: parsed.data.tripId, p_kind: parsed.data.kind, p_amount: parsed.data.amount, p_note: parsed.data.note });
  if (error) return { status: "error", message: error.message };
  after(async () => {
    const { data: trip } = await createAdminClient().from("trips").select("ref, shipper_id").eq("id", parsed.data.tripId).single();
    if (trip) await notifyUser(trip.shipper_id, `Extra charge asked on ${trip.ref}`, `The carrier asks for ${formatKes(parsed.data.amount)}: ${parsed.data.note}. Approve or decline it on the trip.`, `/trips/${parsed.data.tripId}#charges`);
  });
  revalidatePath(`/trips/${parsed.data.tripId}`);
  return { status: "success", message: "Sent to the shipper to approve." };
}

export async function requestFuelAdvance(formData: FormData) {
  await requireRole("carrier");
  const tripId = String(formData.get("tripId"));
  const amount = wholeKes(formData.get("amount"));
  const supabase = await createClient();
  const { data: net, error } = await supabase.rpc("request_fuel_advance", { p_trip: tripId, p_amount: amount ?? 0 });
  if (error) redirect(back(tripId, { error: error.message }));
  after(async () => {
    const { data: trip } = await createAdminClient().from("trips").select("ref").eq("id", tripId).single();
    await notifyOps(`Fuel advance on ${trip?.ref ?? "a trip"}`, `Send ${formatKes(net as number)} with the next payout batch.`, "/admin/payouts");
  });
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "advance" }));
}

export async function carrierCancelTrip(formData: FormData) {
  await requireRole("carrier");
  const tripId = String(formData.get("tripId"));
  const reason = String(formData.get("reason") ?? "");
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("ref, shipper_id, load_id").eq("id", tripId).single();
  const { error } = await supabase.rpc("carrier_cancel_trip", { p_trip: tripId, p_reason: reason });
  if (error) redirect(back(tripId, { error: error.message }));
  if (trip) after(() => notifyUser(trip.shipper_id, `${trip.ref}: the carrier cancelled`, `The carrier can't do this trip (${reason}). Your load is back on the board and anything you paid is in your Vemi wallet.`, `/loads/${trip.load_id}`, { sms: true }));
  revalidatePath("/trips");
  redirect("/trips?saved=cancelled");
}

// ---------------------------------------------------------------------------------------------
// Shipper: pay (promo, wallet, credit, bank), confirm, dispute with a claim, cancel, extras
// ---------------------------------------------------------------------------------------------

export async function applyPromo(formData: FormData) {
  await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { data: discount, error } = await supabase.rpc("apply_promo", { p_trip: tripId, p_code: String(formData.get("code") ?? "") });
  if (error) redirect(back(tripId, { error: error.message }));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "promo", off: String(discount) }));
}

export async function payWithWallet(formData: FormData) {
  await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("pay_with_wallet", { p_trip: tripId });
  if (error) redirect(back(tripId, { error: error.message }));
  after(() => tellCarrierIfPaid(tripId));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "wallet" }));
}

export async function bookOnCredit(formData: FormData) {
  await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("book_on_credit", { p_trip: tripId });
  if (error) redirect(back(tripId, { error: error.message }));
  after(() => tellCarrierIfPaid(tripId));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "credit" }));
}

async function tellCarrierIfPaid(tripId: string) {
  const { data: trip } = await createAdminClient().from("trips").select("ref, carrier_id, status, on_credit").eq("id", tripId).single();
  if (trip?.status === "scheduled") await notifyUser(trip.carrier_id, `${trip.ref} is ready to go`, trip.on_credit ? "The shipper booked on account. Dispatch the truck: Vemi guarantees your payout." : "The shipper has paid. Dispatch the truck.", `/trips/${tripId}`, { sms: true, key: `paid-${tripId}` });
}

export async function chooseBankTransfer(formData: FormData) {
  const { profile } = await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("ref, balance").eq("id", tripId).single();
  if (!trip) redirect("/trips");
  after(() => notifyOps(`Bank transfer coming for ${trip.ref}`, `${profile.company || profile.full_name} will pay ${formatKes(trip.balance)} by bank for ${trip.ref}. Record it in Admin → Trips when it lands.`, `/admin/trips?q=${trip.ref}`));
  redirect(back(tripId, { pay: "bank" }));
}

export async function decideCharge(formData: FormData) {
  await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const approve = formData.get("approve") === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_charge", { p_charge: String(formData.get("chargeId")), p_approve: approve });
  if (error) redirect(back(tripId, { error: error.message }, "#charges"));
  after(async () => {
    const { data: trip } = await createAdminClient().from("trips").select("ref, carrier_id").eq("id", tripId).single();
    if (trip) await notifyUser(trip.carrier_id, `Extra charge ${approve ? "approved" : "declined"} on ${trip.ref}`, approve ? "The shipper approved your extra charge. It is added to your payout." : "The shipper declined your extra charge. Message them on the trip if you think it's wrong.", `/trips/${tripId}`);
  });
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: approve ? "charge-approved" : "charge-declined" }, "#charges"));
}

export async function confirmDelivery(formData: FormData) {
  await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_delivery", { p_trip: tripId });
  if (error) redirect(back(tripId, { error: error.message }));
  after(async () => {
    const { data: trip } = await createAdminClient().from("trips").select("ref, carrier_id, carrier_payout, extras, extras_commission, advance_amount").eq("id", tripId).single();
    if (trip) await notifyUser(trip.carrier_id, `${trip.ref} confirmed`, `The shipper confirmed delivery. Your payout of ${formatKes(trip.carrier_payout + trip.extras - trip.extras_commission - trip.advance_amount)} is queued and goes to your M-Pesa within 24 hours.`, `/earnings`, { sms: true, key: `confirmed-${tripId}` });
  });
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "confirmed" }));
}

/** A dispute can carry a claim for damage or loss, with up to three photos. */
export async function raiseDispute(formData: FormData) {
  await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const reason = String(formData.get("reason") ?? "");
  const claimText = String(formData.get("claim") ?? "").trim();
  const claim = claimText ? wholeKes(claimText) : null;
  if (claimText && (!claim || claim <= 0)) redirect(back(tripId, { error: "Enter the claim as a whole number of shillings, or leave it empty." }));
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
  for (const file of files) { const problem = uploadProblem(file); if (problem) redirect(back(tripId, { error: problem })); }
  const supabase = await createClient();
  const { error } = await supabase.rpc("raise_dispute", { p_trip: tripId, p_reason: reason, p_claim: claim });
  if (error) redirect(back(tripId, { error: error.message }));
  const admin = createAdminClient();
  for (const file of files) {
    const path = await storePrivateFile("pod", `${tripId}/dispute`, file);
    await admin.rpc("attach_dispute_file", { p_trip: tripId, p_path: path });
  }
  after(async () => {
    const { data: trip } = await admin.from("trips").select("ref, carrier_id").eq("id", tripId).single();
    await notifyOps("Dispute raised", `${trip?.ref}: ${reason}${claim ? ` (claim ${formatKes(claim)})` : ""}`, `/trips/${tripId}`);
    if (trip) await notifyUser(trip.carrier_id, `${trip.ref}: the shipper reported a problem`, `The shipper says: ${reason}. Your payout is on hold while Vemi checks. Vemi will call you.`, `/trips/${tripId}`, { sms: true });
  });
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "disputed" }));
}

export async function cancelBooking(formData: FormData) {
  await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { data: before } = await supabase.from("trips").select("load_id, carrier_id, ref, status").eq("id", tripId).single();
  const { error } = await supabase.rpc("cancel_booking", { p_trip: tripId, p_reason: String(formData.get("reason") ?? "") || null });
  if (error) redirect(back(tripId, { error: error.message }));
  const { data: cancelled } = await supabase.from("trips").select("cancel_fee").eq("id", tripId).single();
  const fee = cancelled?.cancel_fee ?? 0;
  if (before) after(() => notifyUser(before.carrier_id, `${before.ref} cancelled`, fee > 0
    ? `The shipper cancelled after the truck set off. You get a cancellation fee: ${formatKes(fee)} less commission, with the next payouts.`
    : "The shipper cancelled this booking before the truck set off. Nothing is owed either way.", "/trips", { sms: before.status !== "awaiting_payment" }));
  revalidatePath("/loads");
  if (before?.status === "awaiting_payment") redirect(`/loads/${before.load_id}?saved=reopened`);
  redirect(back(tripId, { saved: "cancelled" }));
}

export async function rateTrip(formData: FormData) {
  await getSession();
  const tripId = String(formData.get("tripId"));
  const stars = Number.parseInt(String(formData.get("stars") ?? ""), 10);
  if (!(stars >= 1 && stars <= 5)) redirect(back(tripId, { error: "Choose 1 to 5 stars." }));
  const allowed = new Set<string>([...Object.keys(COMPLIMENTS.carrier), ...Object.keys(COMPLIMENTS.shipper)]);
  const tags = formData.getAll("tags").map(String).filter((tag) => allowed.has(tag));
  const supabase = await createClient();
  const { error } = await supabase.rpc("rate_trip", { p_trip: tripId, p_stars: stars, p_comment: String(formData.get("comment") ?? "") || null, p_tags: tags });
  if (error) redirect(back(tripId, { error: error.message }));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "rated" }));
}

export async function toggleFavourite(formData: FormData) {
  await requireRole("shipper");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { data: on, error } = await supabase.rpc("toggle_favourite", { p_carrier: String(formData.get("carrierId")) });
  if (error) redirect(back(tripId, { error: error.message }));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: on ? "favourite" : "unfavourite" }));
}

// ---------------------------------------------------------------------------------------------
// Everyone on the trip: chat, SOS, calls through Vemi
// ---------------------------------------------------------------------------------------------

export async function sendTripMessage(tripId: string, body: string, toSupport = false): Promise<{ error?: string }> {
  const { profile, user } = await getSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_message", { p_trip: tripId, p_body: body, p_to_support: toSupport });
  if (error) return { error: error.message };
  const { data: trip } = await supabase.from("trips").select("carrier_id").eq("id", tripId).single();
  const from = profile.role === "admin" ? "vemi" : trip?.carrier_id === user.id ? "carrier" : "shipper";
  after(() => tellAboutMessage(tripId, from, body, toSupport));
  return {};
}

export async function raiseSos(tripId: string, note: string, lat: number | null, lng: number | null): Promise<{ error?: string }> {
  const { profile } = await getSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc("raise_sos", { p_trip: tripId, p_note: note || null, p_lat: lat, p_lng: lng });
  if (error) return { error: error.message };
  after(async () => {
    const { data: trip } = await createAdminClient().from("trips").select("ref").eq("id", tripId).single();
    const where = lat !== null && lng !== null ? ` Location: https://maps.google.com/?q=${lat},${lng}` : "";
    await notifyOps(`SOS on ${trip?.ref}`, `${profile.full_name} (${profile.phone ?? "no phone"}) pressed SOS.${note ? ` "${note}"` : ""}${where}`, `/trips/${tripId}`, { urgent: true });
  });
  revalidatePath(`/trips/${tripId}`);
  return {};
}

export async function callThroughVemi(tripId: string, target: CallTarget): Promise<{ error?: string }> {
  const { profile, user } = await getSession();
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("carrier_id").eq("id", tripId).maybeSingle();
  if (!trip) return { error: "Trip not found." };
  const error = await startTripCall(tripId, trip.carrier_id === user.id ? "carrier" : "shipper", profile.phone, target);
  return error ? { error } : {};
}

/** A customs or transit paper on a cross-border trip: a reference number, a file, or both. */
export async function addTripPaper(formData: FormData) {
  await getSession();
  const tripId = String(formData.get("tripId"));
  const kind = String(formData.get("kind") ?? "");
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 80);
  const raw = formData.get("file");
  const file = raw instanceof File && raw.size > 0 ? raw : null;
  if (!(BORDER_PAPER_KINDS as string[]).includes(kind)) redirect(back(tripId, { error: "Choose which paper this is." }, "#papers"));
  if (!reference && !file) redirect(back(tripId, { error: "Add a reference number or a file." }, "#papers"));
  const problem = file ? uploadProblem(file) : null;
  if (problem) redirect(back(tripId, { error: problem }, "#papers"));
  const supabase = await createClient();
  // Only store the file once we know this person is on the trip (row-level security hides other trips).
  const { data: trip } = await supabase.from("trips").select("id, ref, shipper_id, carrier_id").eq("id", tripId).maybeSingle();
  if (!trip) redirect(back(tripId, { error: "Trip not found." }));
  const path = file ? await storePrivateFile("trip-docs", tripId, file) : null;
  const { error } = await supabase.rpc("add_trip_document", { p_trip: tripId, p_kind: kind, p_reference: reference || null, p_path: path });
  if (error) {
    if (path) await removePrivateFile("trip-docs", path);
    redirect(back(tripId, { error: error.message }, "#papers"));
  }
  const { user } = await getSession();
  const other = user.id === trip.carrier_id ? trip.shipper_id : trip.carrier_id;
  const label = BORDER_PAPERS[kind as BorderPaperKind].en;
  after(() => notifyUser(other, `Border paper added: trip ${trip.ref}`, `${label} was added to trip ${trip.ref}${reference ? ` (${reference})` : ""}.`, `/trips/${tripId}#papers`, { key: `paper-${tripId}-${kind}-${Date.now()}`, pushOnly: true }));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "paper" }, "#papers"));
}

export async function removeTripPaper(formData: FormData) {
  await getSession();
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("remove_trip_document", { p_id: String(formData.get("paperId")) });
  if (error) redirect(back(tripId, { error: error.message }, "#papers"));
  if (path) await removePrivateFile("trip-docs", path as string);
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "paper-removed" }, "#papers"));
}
