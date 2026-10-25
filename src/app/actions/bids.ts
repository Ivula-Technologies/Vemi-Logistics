"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bidSchema } from "@/lib/validations";
import { formatKes } from "@/lib/utils";
import { notifyUser } from "@/lib/notify";
import { fieldErrors } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

export async function placeBid(_: ActionState, formData: FormData): Promise<ActionState> {
  const { carrier } = await requireRole("carrier");
  const parsed = bidSchema.safeParse({ loadId: formData.get("loadId"), amount: formData.get("amount"), note: formData.get("note") ?? "" });
  if (!parsed.success) return { status: "error", message: "Check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("place_bid", { p_load: parsed.data.loadId, p_amount: parsed.data.amount, p_note: parsed.data.note });
  if (error) return { status: "error", message: error.message };
  after(async () => {
    const { data: load } = await createAdminClient().from("loads").select("shipper_id, ref").eq("id", parsed.data.loadId).single();
    if (load) await notifyUser(load.shipper_id, `New bid on ${load.ref}`, `${carrier?.business_name ?? "A verified carrier"} bid ${formatKes(parsed.data.amount)}. Compare bids and book the truck you want.`, `/loads/${parsed.data.loadId}`);
  });
  revalidatePath(`/board/${parsed.data.loadId}`);
  return { status: "success", message: "Bid sent. We'll tell you if the shipper books you." };
}

export async function withdrawBid(formData: FormData) {
  await requireRole("carrier");
  const bidId = String(formData.get("bidId"));
  const loadId = String(formData.get("loadId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_bid", { p_bid: bidId });
  if (error) redirect(`/board/${loadId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/board/${loadId}`);
  redirect(`/board/${loadId}`);
}

/** Uber Freight "Book now": take an instant-book load at the shipper's price. The first verified truck wins. */
export async function instantBook(formData: FormData) {
  const { carrier } = await requireRole("carrier");
  const loadId = String(formData.get("loadId"));
  const supabase = await createClient();
  const { data: tripId, error } = await supabase.rpc("instant_book", { p_load: loadId });
  if (error || !tripId) redirect(`/board/${loadId}?error=${encodeURIComponent(error?.message ?? "Could not book this load.")}`);
  after(async () => {
    const { data: trip } = await createAdminClient().from("trips").select("ref, shipper_id, price").eq("id", tripId).single();
    if (trip) await notifyUser(trip.shipper_id, `Truck booked: ${trip.ref}`, `${carrier?.business_name ?? "A verified carrier"} booked your load at ${formatKes(trip.price)}. Pay now so they can dispatch the truck.`, `/trips/${tripId}`, { sms: true, key: `instant-${tripId}` });
  });
  revalidatePath("/board");
  redirect(`/trips/${tripId}?booked=instant`);
}
