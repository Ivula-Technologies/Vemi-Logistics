"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOAD_FIELDS, MAX_STOPS, loadSchema, savedPlaceSchema, stopSchema } from "@/lib/validations";
import { placeMap } from "@/lib/places";
import { isTruckType, quoteRoute, withSurcharge, type RoutePoint } from "@/lib/pricing";
import { eatToday, formatKes } from "@/lib/utils";
import { notifyUser } from "@/lib/notify";
import { announceLoad } from "@/lib/load-alerts";
import { fieldErrors } from "@/lib/forms";
import type { ActionState, LaneSurge } from "@/lib/types";

const CHECK = "Check the highlighted details.";

export async function postLoad(_: ActionState, formData: FormData): Promise<ActionState> {
  const { profile, accountId } = await requireRole("shipper", "admin");
  const parsed = loadSchema.safeParse(Object.fromEntries(LOAD_FIELDS.map((key) => [key, formData.get(key) ?? ""])));
  if (!parsed.success) return { status: "error", message: CHECK, fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  if (input.pickupDate < eatToday()) return { status: "error", message: CHECK, fieldErrors: { pickupDate: ["Pickup can't be in the past."] } };

  // Stops on the way, in the order they were added.
  const stops = [];
  for (let i = 1; i <= MAX_STOPS; i += 1) {
    if (!String(formData.get(`stopPlace_${i}`) ?? "")) continue;
    const stop = stopSchema.safeParse({ placeId: formData.get(`stopPlace_${i}`), kind: formData.get(`stopKind_${i}`) ?? "drop", detail: formData.get(`stopDetail_${i}`) ?? "", name: formData.get(`stopName_${i}`) ?? "", phone: formData.get(`stopPhone_${i}`) ?? "" });
    if (!stop.success) return { status: "error", message: `Check stop ${stops.length + 1}: ${stop.error.issues[0]?.message}` };
    stops.push(stop.data);
  }

  const places = await placeMap();
  const origin = places.get(input.originId);
  const destination = places.get(input.destinationId);
  if (!origin || !destination || !isTruckType(input.truckType) || stops.some((s) => !places.has(s.placeId))) return { status: "error", message: "Choose places from the list." };
  const pin = (lat: number | null, lng: number | null) => (lat !== null && lng !== null ? { lat, lng } : null);
  const points: RoutePoint[] = [
    { ...origin, pin: pin(input.originLat, input.originLng) },
    ...stops.map((s) => places.get(s.placeId)!),
    { ...destination, pin: pin(input.destinationLat, input.destinationLng) },
  ];

  const supabase = await createClient();
  const [{ data: settings }, { data: surge }, { count: favourites }] = await Promise.all([
    supabase.from("platform_settings").select("stop_fee_kes").single(),
    supabase.rpc("lane_surge", { p_origin: origin.id, p_truck_type: input.truckType, p_pickup: input.pickupDate }),
    supabase.from("favourite_carriers").select("carrier_id", { count: "exact", head: true }).eq("account_id", accountId),
  ]);
  const route = quoteRoute(points, input.truckType, settings?.stop_fee_kes);
  const lane = surge as LaneSurge | null;
  const surgeBps = (lane?.urgent_bps ?? 0) + (lane?.busy_bps ?? 0);
  const favouritesFirst = input.favouritesHours > 0 && (favourites ?? 0) > 0;

  const { data: load, error } = await supabase.from("loads").insert({
    shipper_id: accountId, origin_id: origin.id, origin_detail: input.originDetail, destination_id: destination.id, destination_detail: input.destinationDetail,
    pickup_date: input.pickupDate, cargo_type: input.cargoType, cargo_description: input.cargoDescription, weight_tonnes: input.weightTonnes,
    truck_type: input.truckType, distance_km: route.distanceKm, border_crossings: route.crossings, guide_price: withSurcharge(route.price, surgeBps), price: input.price, notes: input.notes,
    instant_book: input.instantBook, pickup_window: input.pickupWindow, origin_lat: input.originLat, origin_lng: input.originLng, destination_lat: input.destinationLat, destination_lng: input.destinationLng,
    favourites_until: favouritesFirst ? new Date(Date.now() + input.favouritesHours * 3_600_000).toISOString() : null,
    surge_bps: surgeBps, stop_count: stops.length, declared_value: input.declaredValue, insure: input.insure, require_codes: input.requireCodes, copied_from: input.copiedFrom,
  }).select("id, ref").single();
  if (error) return { status: "error", message: error.message };

  const contacts = supabase.from("load_contacts").insert({
    load_id: load.id, pickup_name: input.pickupName, pickup_phone: input.pickupPhone ?? profile.phone, dropoff_name: input.dropoffName, dropoff_phone: input.dropoffPhone,
    stops: stops.map((s, i) => ({ seq: i + 1, name: s.name, phone: s.phone })),
  });
  const stopRows = stops.length ? supabase.from("load_stops").insert(stops.map((s, i) => ({ load_id: load.id, seq: i + 1, kind: s.kind, place_id: s.placeId, detail: s.detail }))) : null;
  const [{ error: contactError }, stopResult] = await Promise.all([contacts, stopRows]);
  if (contactError) console.error("Load contacts not saved", contactError);
  if (stopResult?.error) console.error("Load stops not saved", stopResult.error);
  await saveRoutePlaces(accountId, input);

  if (!favouritesFirst) await createAdminClient().from("loads").update({ announced_at: new Date().toISOString() }).eq("id", load.id);
  after(() => announceLoad(load.id, { favourites: favouritesFirst }));
  revalidatePath("/loads");
  redirect(`/loads/${load.id}?posted=${favouritesFirst ? "favourites" : "1"}`);
}

/** "Save as" on the load form: keeps the pickup or drop-off for one-tap reuse. */
async function saveRoutePlaces(accountId: string, input: { savePickupAs: string | null; saveDropoffAs: string | null; originId: string; originDetail: string | null; originLat: number | null; originLng: number | null; pickupName: string | null; pickupPhone: string | null; destinationId: string; destinationDetail: string | null; destinationLat: number | null; destinationLng: number | null; dropoffName: string | null; dropoffPhone: string | null }) {
  const rows = [];
  if (input.savePickupAs) rows.push({ account_id: accountId, label: input.savePickupAs, place_id: input.originId, detail: input.originDetail, lat: input.originLat, lng: input.originLng, contact_name: input.pickupName, contact_phone: input.pickupPhone });
  if (input.saveDropoffAs) rows.push({ account_id: accountId, label: input.saveDropoffAs, place_id: input.destinationId, detail: input.destinationDetail, lat: input.destinationLat, lng: input.destinationLng, contact_name: input.dropoffName, contact_phone: input.dropoffPhone });
  if (!rows.length) return;
  const supabase = await createClient();
  const { error } = await supabase.from("saved_places").insert(rows);
  if (error) console.error("Saved places not saved", error);
}

export async function savePlace(_: ActionState, formData: FormData): Promise<ActionState> {
  const { accountId } = await requireRole("shipper", "admin");
  const parsed = savedPlaceSchema.safeParse({ label: formData.get("label"), placeId: formData.get("placeId"), detail: formData.get("detail") ?? "", contactName: formData.get("contactName") ?? "", contactPhone: formData.get("contactPhone") ?? "" });
  if (!parsed.success) return { status: "error", message: CHECK, fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("saved_places").insert({ account_id: accountId, label: parsed.data.label, place_id: parsed.data.placeId, detail: parsed.data.detail, contact_name: parsed.data.contactName, contact_phone: parsed.data.contactPhone });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/business");
  return { status: "success", message: "Place saved. Pick it on the load form next time." };
}

export async function deletePlace(formData: FormData) {
  await requireRole("shipper", "admin");
  const supabase = await createClient();
  await supabase.from("saved_places").delete().eq("id", String(formData.get("id")));
  revalidatePath("/business");
  redirect("/business?saved=place#places");
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

export async function setInstantBook(formData: FormData) {
  await requireRole("shipper", "admin");
  const loadId = String(formData.get("loadId"));
  const on = formData.get("on") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("loads").update({ instant_book: on }).eq("id", loadId).eq("status", "open");
  if (error) redirect(`/loads/${loadId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/loads/${loadId}`);
  redirect(`/loads/${loadId}?saved=${on ? "instant" : "bids"}`);
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
