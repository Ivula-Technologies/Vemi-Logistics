import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notify";
import { TRIP_STATUS, type TripStatus } from "@/lib/trips";

/** Used by the carrier screen and the driver link alike. */
export async function tellShipperAboutStatus(tripId: string, status: TripStatus) {
  if (!["to_pickup", "loaded", "at_border", "delivered"].includes(status)) return;
  const { data: trip } = await createAdminClient().from("trips").select("ref, shipper_id").eq("id", tripId).single();
  if (!trip) return;
  const message = status === "delivered"
    ? `The driver marked ${trip.ref} as delivered. Check the goods and confirm, or tell us what is wrong. It confirms automatically after 48 hours.`
    : `${trip.ref}: ${TRIP_STATUS[status].label}.`;
  await notifyUser(trip.shipper_id, `${trip.ref}: ${TRIP_STATUS[status].label}`, message, `/trips/${tripId}`, { sms: status === "delivered", key: `status-${tripId}-${status}` });
}
