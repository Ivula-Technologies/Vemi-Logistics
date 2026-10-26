import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notify";
import { straightLineKm } from "@/lib/pricing";
import { formatKes } from "@/lib/utils";

/** How close a free truck must be to the pickup to get the "near you" SMS first. */
const NEAR_KM = 150;

/**
 * Tells carriers about a new load, Uber-style: the free trucks closest to the pickup get an SMS and push
 * first, then other verified carriers with that truck type get push or email. With favourites=true only the
 * shipper's favourite carriers hear about it (everyone else is told when the favourites window closes).
 */
export async function announceLoad(loadId: string, options: { favourites?: boolean } = {}) {
  if (!process.env.SUPABASE_SECRET_KEY) return;
  try {
    const admin = createAdminClient();
    const { data: load } = await admin.from("loads").select("id, ref, shipper_id, origin_id, destination_id, truck_type, price, pickup_date, instant_book, status").eq("id", loadId).single();
    if (!load || load.status !== "open") return;
    const { data: places } = await admin.from("places").select("id, name, lat, lng").in("id", [load.origin_id, load.destination_id]);
    const origin = places?.find((p) => p.id === load.origin_id);
    const destination = places?.find((p) => p.id === load.destination_id);
    const route = `${origin?.name ?? ""} → ${destination?.name ?? ""}`;
    const offer = load.instant_book ? `Book now at ${formatKes(load.price)}` : `Offered ${formatKes(load.price)}. Bid now`;
    const path = `/board/${loadId}`;

    if (options.favourites) {
      const { data: favourites } = await admin.from("favourite_carriers").select("carrier_id").eq("account_id", load.shipper_id);
      await Promise.all((favourites ?? []).map((f) => notifyUser(f.carrier_id, `A shipper you worked with has a load: ${route}`,
        `${route}, pickup ${load.pickup_date}. You see it before anyone else for a few hours. ${offer}.`, path, { sms: true, key: `fav-${loadId}-${f.carrier_id}` })));
      return;
    }

    // Free trucks of the right type near the pickup: SMS first.
    const { data: free } = await admin.from("truck_availability").select("carrier_id, lat, lng, place_id, trucks!inner(truck_type, active), carriers!inner(status)")
      .eq("trucks.truck_type", load.truck_type).eq("trucks.active", true).eq("carriers.status", "verified").gt("expires_at", new Date().toISOString()).limit(500);
    const { data: availabilityPlaces } = await admin.from("places").select("id, lat, lng").in("id", [...new Set((free ?? []).map((f) => f.place_id as string))]);
    const placeById = new Map((availabilityPlaces ?? []).map((p) => [p.id, p]));
    const near = new Set<string>();
    for (const row of free ?? []) {
      const at = row.lat !== null && row.lng !== null ? { lat: row.lat as number, lng: row.lng as number } : placeById.get(row.place_id as string);
      if (origin && at && straightLineKm(at, origin) <= NEAR_KM) near.add(row.carrier_id as string);
    }
    await Promise.all([...near].slice(0, 30).map((id) => notifyUser(id, `Load near your free truck: ${route}`,
      `${route}, pickup ${load.pickup_date}. Your truck is close. ${offer} before another truck does.`, path, { sms: true, key: `near-${loadId}-${id}` })));

    // Everyone else with that truck type: push, or email when the app isn't installed.
    const { data: trucks } = await admin.from("trucks").select("carrier_id, carriers!inner(status)").eq("truck_type", load.truck_type).eq("active", true).eq("carriers.status", "verified").limit(300);
    const others = [...new Set((trucks ?? []).map((row) => row.carrier_id as string))].filter((id) => !near.has(id) && id !== load.shipper_id).slice(0, 60);
    await Promise.all(others.map((id) => notifyUser(id, `New load: ${route}`, `${route}, pickup ${load.pickup_date}. ${offer}.`, path, { key: `load-${loadId}-${id}` })));
  } catch (error) {
    console.error("Carrier alerts failed", error);
  }
}
