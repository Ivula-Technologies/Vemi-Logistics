import { TRUCK_TYPES, straightLineKm, type TruckType } from "@/lib/pricing";
import type { PlaceRow } from "@/lib/types";

/** How far apart two pickups (or two drop-offs) can be and still share one truck. */
export const SHARE_PICKUP_KM = 100;
export const SHARE_DROPOFF_KM = 150;

type LoadLike = { origin_id: string; destination_id: string; pickup_date: string; weight_tonnes: number; truck_type: TruckType };

function daysApart(a: string, b: string) {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/** Whether a truck of this type and capacity can carry the other load's goods (reefer goods need a reefer). */
export function truckSuits(truckType: TruckType, capacityTonnes: number, wanted: TruckType) {
  if (wanted === truckType) return true;
  if (wanted === "reefer" || truckType === "reefer") return false;
  return TRUCK_TYPES[wanted].tonnes <= capacityTonnes;
}

/**
 * Whether another part load can ride on the same truck as this one: it fits in the space left, picks up within
 * a day and near this pickup, and goes near this drop-off.
 */
export function canRideAlong(mine: LoadLike, other: LoadLike, places: Map<string, Pick<PlaceRow, "lat" | "lng">>, spaceTonnes: number, capacityTonnes: number) {
  if (Number(other.weight_tonnes) > spaceTonnes) return false;
  if (daysApart(mine.pickup_date, other.pickup_date) > 1) return false;
  if (!truckSuits(mine.truck_type, capacityTonnes, other.truck_type)) return false;
  const [a, b, c, d] = [places.get(mine.origin_id), places.get(other.origin_id), places.get(mine.destination_id), places.get(other.destination_id)];
  if (!a || !b || !c || !d) return false;
  return straightLineKm(a, b) <= SHARE_PICKUP_KM && straightLineKm(c, d) <= SHARE_DROPOFF_KM;
}
