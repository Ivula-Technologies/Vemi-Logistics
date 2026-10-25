"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOps, notifyUser, sendSms, smsConfigured } from "@/lib/notify";
import { storePrivateFile, uploadProblem } from "@/lib/storage";
import { tellShipperAboutStatus } from "@/lib/trip-notify";
import type { TripStatus } from "@/lib/trips";

function back(tripId: string, params: Record<string, string>) {
  return `/trips/${tripId}?${new URLSearchParams(params).toString()}`;
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

export async function assignTrip(formData: FormData) {
  await requireRole("carrier");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_trip", { p_trip: tripId, p_truck: String(formData.get("truckId") ?? ""), p_driver: String(formData.get("driverId") ?? "") });
  if (error) redirect(back(tripId, { error: error.message }));
  // Text the driver their trip link when SMS is set up; the carrier can always share it on WhatsApp too.
  if (formData.get("smsDriver") === "on" && smsConfigured()) {
    const [{ data: token }, { data: trip }] = await Promise.all([
      supabase.rpc("trip_driver_token", { p_trip: tripId }),
      supabase.from("trips").select("ref, drivers(phone)").eq("id", tripId).single(),
    ]);
    const phone = (trip?.drivers as unknown as { phone: string } | null)?.phone;
    if (token && phone) after(() => sendSms(phone, `Vemi trip ${trip!.ref}: open this link for pickup details and to update the trip: ${siteUrl()}/d/${token}`).then(() => undefined));
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "assigned" }));
}

export async function carrierUpdateTrip(formData: FormData) {
  await requireRole("carrier");
  const tripId = String(formData.get("tripId"));
  const status = String(formData.get("status")) as TripStatus;
  const lat = Number.parseFloat(String(formData.get("lat") ?? ""));
  const lng = Number.parseFloat(String(formData.get("lng") ?? ""));
  const supabase = await createClient();
  const { error } = await supabase.rpc("carrier_update_trip", {
    p_trip: tripId, p_status: status, p_note: String(formData.get("note") ?? "") || null,
    p_lat: Number.isFinite(lat) ? lat : null, p_lng: Number.isFinite(lng) ? lng : null,
  });
  if (error) redirect(back(tripId, { error: error.message }));
  after(() => tellShipperAboutStatus(tripId, status));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "status" }));
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

export async function confirmDelivery(formData: FormData) {
  await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_delivery", { p_trip: tripId });
  if (error) redirect(back(tripId, { error: error.message }));
  after(async () => {
    const { data: trip } = await createAdminClient().from("trips").select("ref, carrier_id, carrier_payout").eq("id", tripId).single();
    if (trip) await notifyUser(trip.carrier_id, `${trip.ref} confirmed`, `The shipper confirmed delivery. Your payout of KES ${trip.carrier_payout.toLocaleString("en-KE")} is queued and goes to your M-Pesa within 24 hours.`, `/earnings`, { sms: true, key: `confirmed-${tripId}` });
  });
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "confirmed" }));
}

export async function raiseDispute(formData: FormData) {
  await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const reason = String(formData.get("reason") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("raise_dispute", { p_trip: tripId, p_reason: reason });
  if (error) redirect(back(tripId, { error: error.message }));
  after(() => notifyOps("Dispute raised", `A shipper disputed a delivery: ${reason}`, `/admin/trips?status=disputed`));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "disputed" }));
}

export async function cancelBooking(formData: FormData) {
  await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("load_id, carrier_id, ref").eq("id", tripId).single();
  const { error } = await supabase.rpc("cancel_booking", { p_trip: tripId, p_reason: String(formData.get("reason") ?? "") || null });
  if (error) redirect(back(tripId, { error: error.message }));
  if (trip) after(() => notifyUser(trip.carrier_id, `${trip.ref} cancelled`, "The shipper cancelled this booking before paying. Nothing is owed either way.", "/trips"));
  revalidatePath("/loads");
  redirect(trip ? `/loads/${trip.load_id}?saved=reopened` : "/loads");
}

export async function rateTrip(formData: FormData) {
  await getSession();
  const tripId = String(formData.get("tripId"));
  const stars = Number.parseInt(String(formData.get("stars") ?? ""), 10);
  if (!(stars >= 1 && stars <= 5)) redirect(back(tripId, { error: "Choose 1 to 5 stars." }));
  const supabase = await createClient();
  const { error } = await supabase.rpc("rate_trip", { p_trip: tripId, p_stars: stars, p_comment: String(formData.get("comment") ?? "") || null });
  if (error) redirect(back(tripId, { error: error.message }));
  revalidatePath(`/trips/${tripId}`);
  redirect(back(tripId, { saved: "rated" }));
}

export async function chooseBankTransfer(formData: FormData) {
  const { profile } = await requireRole("shipper", "admin");
  const tripId = String(formData.get("tripId"));
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("ref, price").eq("id", tripId).single();
  if (!trip) redirect("/trips");
  after(() => notifyOps(`Bank transfer coming for ${trip.ref}`, `${profile.company || profile.full_name} will pay KES ${trip.price.toLocaleString("en-KE")} by bank for ${trip.ref}. Record it in Admin → Trips when it lands.`, `/admin/trips?q=${trip.ref}`));
  redirect(back(tripId, { pay: "bank" }));
}
