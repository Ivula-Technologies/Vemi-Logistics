import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOps, notifyUser, sendSms } from "@/lib/notify";
import { TRIP_STATUS, type TripStatus } from "@/lib/trips";

function site() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

/** Used by the carrier screen and the driver link alike. */
export async function tellShipperAboutStatus(tripId: string, status: TripStatus) {
  if (!["to_pickup", "at_pickup", "loaded", "in_transit", "at_border", "at_dropoff", "delivered"].includes(status)) return;
  const admin = createAdminClient();
  const { data: trip } = await admin.from("trips").select("ref, shipper_id, load_id, share_token, delivery_code").eq("id", tripId).single();
  if (!trip) return;

  // Share my trip: once the goods leave, the receiver gets a live tracking link (no phone numbers on it).
  if (status === "in_transit") {
    const { data: contacts } = await admin.from("load_contacts").select("dropoff_phone, dropoff_name").eq("load_id", trip.load_id).maybeSingle();
    const { data: load } = await admin.from("loads").select("require_codes").eq("id", trip.load_id).single();
    if (contacts?.dropoff_phone) {
      const code = load?.require_codes ? ` Give the driver code ${trip.delivery_code} only when the goods are offloaded and checked.` : "";
      await sendSms(contacts.dropoff_phone, `Vemi: goods are on the way to you (trip ${trip.ref}). Follow the truck live: ${site()}/t/${trip.share_token}.${code}`);
    }
  }
  if (status === "at_pickup" || status === "at_dropoff" || status === "in_transit") {
    await notifyUser(trip.shipper_id, `${trip.ref}: ${TRIP_STATUS[status].label}`, `${trip.ref}: ${TRIP_STATUS[status].label}.`, `/trips/${tripId}`, { pushOnly: true, key: `status-${tripId}-${status}` });
    return;
  }
  const message = status === "delivered"
    ? `The driver marked ${trip.ref} as delivered. Check the goods and confirm, or tell us what is wrong. It confirms automatically after 48 hours.`
    : `${trip.ref}: ${TRIP_STATUS[status].label}.`;
  await notifyUser(trip.shipper_id, `${trip.ref}: ${TRIP_STATUS[status].label}`, message, `/trips/${tripId}`, { sms: status === "delivered", key: `status-${tripId}-${status}` });
}

/** A new chat message: push to everyone else on the trip (email only when they have no app installed). */
export async function tellAboutMessage(tripId: string, from: "shipper" | "carrier" | "driver" | "vemi", body: string, toSupport: boolean) {
  const admin = createAdminClient();
  const { data: trip } = await admin.from("trips").select("ref, shipper_id, carrier_id").eq("id", tripId).single();
  if (!trip) return;
  const label = { shipper: "Shipper", carrier: "Carrier", driver: "Driver", vemi: "Vemi support" }[from];
  const text = `${label}: ${body.slice(0, 140)}`;
  const people = [from !== "shipper" ? trip.shipper_id : null, from !== "carrier" && from !== "driver" ? trip.carrier_id : null].filter(Boolean) as string[];
  if (from === "driver") people.push(trip.carrier_id);
  await Promise.all([...new Set(people)].map((id) => notifyUser(id, `Message on ${trip.ref}`, text, `/trips/${tripId}#chat`, { pushOnly: true })));
  if (toSupport) await notifyOps(`Help request on ${trip.ref}`, text, `/trips/${tripId}#chat`);
}

/** A payment landed: the shipper gets the receipt link by email and push (once per payment). */
export async function sendReceipt(tripId: string, amount: number, method: string, key: string) {
  const { data: trip } = await createAdminClient().from("trips").select("ref, shipper_id, balance").eq("id", tripId).single();
  if (!trip) return;
  const rest = trip.balance > 0 ? ` KES ${trip.balance.toLocaleString("en-KE")} is still to pay.` : " The trip is paid in full.";
  await notifyUser(trip.shipper_id, `Receipt for ${trip.ref}`, `We received KES ${amount.toLocaleString("en-KE")} by ${method} for ${trip.ref}.${rest} Your receipt is ready to print or save as PDF.`, `/trips/${tripId}/receipt`, { key: `receipt-${key}` });
}
