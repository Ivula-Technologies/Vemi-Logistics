"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSchema } from "@/lib/validations";
import { placeMap } from "@/lib/places";
import { isTruckType, quote } from "@/lib/pricing";
import { eatToday, formatKes } from "@/lib/utils";
import { notifyUser } from "@/lib/notify";
import { fieldErrors } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

export async function postLoad(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, profile } = await requireRole("shipper", "admin");
  const parsed = loadSchema.safeParse(Object.fromEntries(["originId", "originDetail", "destinationId", "destinationDetail", "pickupDate", "cargoType", "cargoDescription", "weightTonnes", "truckType", "price", "notes", "pickupName", "pickupPhone", "dropoffName", "dropoffPhone"].map((key) => [key, formData.get(key) ?? ""])));
  if (!parsed.success) return { status: "error", message: "Check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  if (input.pickupDate < eatToday()) return { status: "error", message: "Check the highlighted details.", fieldErrors: { pickupDate: ["Pickup can't be in the past."] } };
  const places = await placeMap();
  const origin = places.get(input.originId);
  const destination = places.get(input.destinationId);
  if (!origin || !destination || !isTruckType(input.truckType)) return { status: "error", message: "Choose places from the list." };
  const { distanceKm, crossings, price: guide } = quote(origin, destination, input.truckType);

  const supabase = await createClient();
  const { data: load, error } = await supabase.from("loads").insert({
    shipper_id: user.id, origin_id: origin.id, origin_detail: input.originDetail, destination_id: destination.id, destination_detail: input.destinationDetail,
    pickup_date: input.pickupDate, cargo_type: input.cargoType, cargo_description: input.cargoDescription, weight_tonnes: input.weightTonnes,
    truck_type: input.truckType, distance_km: distanceKm, border_crossings: crossings, guide_price: guide, price: input.price, notes: input.notes,
  }).select("id, ref").single();
  if (error) return { status: "error", message: error.message };
  const { error: contactError } = await supabase.from("load_contacts").insert({
    load_id: load.id, pickup_name: input.pickupName, pickup_phone: input.pickupPhone ?? profile.phone, dropoff_name: input.dropoffName, dropoff_phone: input.dropoffPhone,
  });
  if (contactError) console.error("Load contacts not saved", contactError);

  after(() => alertCarriers(load.id, `${origin.name} → ${destination.name}`, input.truckType, input.price, input.pickupDate));
  revalidatePath("/loads");
  redirect(`/loads/${load.id}?posted=1`);
}

/** New load: email verified carriers who run that truck type (at most 50, newest first). */
async function alertCarriers(loadId: string, route: string, truckType: string, price: number, pickupDate: string) {
  if (!process.env.SUPABASE_SECRET_KEY) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("trucks").select("carrier_id, carriers!inner(status)").eq("truck_type", truckType).eq("active", true).eq("carriers.status", "verified").limit(200);
    const carriers = [...new Set((data ?? []).map((row) => row.carrier_id as string))].slice(0, 50);
    await Promise.all(carriers.map((id) => notifyUser(id, `New load: ${route}`, `${route}, pickup ${pickupDate}, offered ${formatKes(price)}. Bid before another truck does.`, `/board/${loadId}`, { key: `load-${loadId}-${id}` })));
  } catch (error) {
    console.error("Carrier alerts failed", error);
  }
}

export async function cancelLoad(formData: FormData) {
  await requireRole("shipper", "admin");
  const loadId = String(formData.get("loadId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_load", { p_load: loadId });
  if (error) redirect(`/loads/${loadId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/loads");
  redirect("/loads");
}

export async function updateLoadPrice(formData: FormData) {
  await requireRole("shipper", "admin");
  const loadId = String(formData.get("loadId"));
  const price = Number.parseInt(String(formData.get("price") ?? ""), 10);
  if (!Number.isFinite(price) || price < 1000) redirect(`/loads/${loadId}?error=${encodeURIComponent("Enter a price of at least KES 1,000.")}`);
  const supabase = await createClient();
  const { error } = await supabase.from("loads").update({ price }).eq("id", loadId).eq("status", "open");
  if (error) redirect(`/loads/${loadId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/loads/${loadId}`);
  redirect(`/loads/${loadId}?saved=1`);
}

export async function acceptBid(formData: FormData) {
  await requireRole("shipper", "admin");
  const bidId = String(formData.get("bidId"));
  const loadId = String(formData.get("loadId"));
  const supabase = await createClient();
  const { data: tripId, error } = await supabase.rpc("accept_bid", { p_bid: bidId });
  if (error || !tripId) redirect(`/loads/${loadId}?error=${encodeURIComponent(error?.message ?? "Could not book this bid.")}`);
  after(async () => {
    const { data: bid } = await createAdminClient().from("bids").select("carrier_id, amount").eq("id", bidId).single();
    if (bid) await notifyUser(bid.carrier_id, "You won a load", `Your bid of ${formatKes(bid.amount)} was accepted. Assign a truck and driver now; you can dispatch once the shipper pays.`, `/trips/${tripId}`, { sms: true, key: `won-${tripId}` });
  });
  revalidatePath("/loads");
  redirect(`/trips/${tripId}?booked=1`);
}
