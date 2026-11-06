import { TRUCK_TYPES, roadDistanceKm, straightLineKm, type TruckType } from "@/lib/pricing";
import { travelHours } from "@/lib/eta";
import { truckSuits } from "@/lib/part-loads";
import type { PlaceRow } from "@/lib/types";

/** How far from where the truck unloads a return load may pick up. */
export const RETURN_PICKUP_KM = 100;
/** Return loads pick up from the day the truck arrives to this many days after. */
export const RETURN_WAIT_DAYS = 3;
/** A return load "goes home" when it drops off this close to where the truck started. */
export const HOME_KM = 150;

type Places = Map<string, Pick<PlaceRow, "lat" | "lng">>;
type TripLoad = { id?: string; origin_id: string; destination_id: string; pickup_date: string; truck_type: TruckType; distance_km?: number | null; border_crossings?: number | null };
type OpenLoad = { id: string; origin_id: string; destination_id: string; pickup_date: string; truck_type: TruckType; weight_tonnes: number };

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The day the truck should unload: pickup day plus the driving days (with rests and borders), at least the next day for long trips. */
export function arrivalDate(load: TripLoad, places: Places) {
  const a = places.get(load.origin_id);
  const b = places.get(load.destination_id);
  const km = Number(load.distance_km) || (a && b ? roadDistanceKm(a, b) : 0);
  const hours = travelHours(km, Number(load.border_crossings) || 0);
  return addDays(load.pickup_date, Math.floor(hours / 24) + (hours % 24 > 12 ? 1 : 0));
}

/** The pickup dates a return load can have: arrival day to RETURN_WAIT_DAYS later. */
export function returnWindow(load: TripLoad, places: Places) {
  const from = arrivalDate(load, places);
  return { from, to: addDays(from, RETURN_WAIT_DAYS) };
}

/** Whether an open load suits this truck on its way back: picks up near the drop-off, in the window, and fits the truck. */
export function isReturnLoad(trip: TripLoad, other: OpenLoad, places: Places, truck: { truck_type: TruckType; capacity_tonnes?: number | null }) {
  if (other.id === trip.id) return false;
  const { from, to } = returnWindow(trip, places);
  if (other.pickup_date < from || other.pickup_date > to) return false;
  const capacity = Number(truck.capacity_tonnes ?? TRUCK_TYPES[truck.truck_type].tonnes);
  if (Number(other.weight_tonnes) > capacity || !truckSuits(truck.truck_type, capacity, other.truck_type)) return false;
  const unload = places.get(trip.destination_id);
  const pickup = places.get(other.origin_id);
  return Boolean(unload && pickup && straightLineKm(unload, pickup) <= RETURN_PICKUP_KM);
}

/** How far the return load leaves the truck from where it started (smaller is better). */
export function kmFromHome(trip: TripLoad, other: OpenLoad, places: Places) {
  const home = places.get(trip.origin_id);
  const end = places.get(other.destination_id);
  return home && end ? straightLineKm(home, end) : Number.POSITIVE_INFINITY;
}

/** Return loads for this trip, the ones that bring the truck closest to home first. */
export function returnLoadsFor<T extends OpenLoad>(trip: TripLoad, open: T[], places: Places, truck: { truck_type: TruckType; capacity_tonnes?: number | null }) {
  return open.filter((o) => isReturnLoad(trip, o, places, truck))
    .map((o) => ({ load: o, homeKm: kmFromHome(trip, o, places) }))
    .sort((a, b) => a.homeKm - b.homeKm || a.load.pickup_date.localeCompare(b.load.pickup_date));
}
