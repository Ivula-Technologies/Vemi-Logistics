/** Truck types, guide rates and the distance estimate behind every guide price. */

export const TRUCK_TYPES = {
  pickup: { label: "Pickup (1 t)", short: "Pickup", tonnes: 1, ratePerKm: 60, minimum: 3000 },
  canter: { label: "Canter (3 t)", short: "Canter", tonnes: 3, ratePerKm: 90, minimum: 5000 },
  lorry_7t: { label: "Lorry (7 t)", short: "7 t lorry", tonnes: 7, ratePerKm: 120, minimum: 8000 },
  lorry_10t: { label: "Lorry (10 t)", short: "10 t lorry", tonnes: 10, ratePerKm: 150, minimum: 10000 },
  lorry_14t: { label: "Lorry (14 t)", short: "14 t lorry", tonnes: 14, ratePerKm: 170, minimum: 12000 },
  trailer: { label: "Trailer / flatbed (28 t)", short: "Trailer", tonnes: 28, ratePerKm: 220, minimum: 18000 },
  tipper: { label: "Tipper (20 t)", short: "Tipper", tonnes: 20, ratePerKm: 160, minimum: 12000 },
  tanker: { label: "Tanker (liquids)", short: "Tanker", tonnes: 30, ratePerKm: 230, minimum: 20000 },
  reefer: { label: "Refrigerated (reefer)", short: "Reefer", tonnes: 20, ratePerKm: 270, minimum: 20000 },
  lowbed: { label: "Low-bed (machinery)", short: "Low-bed", tonnes: 40, ratePerKm: 350, minimum: 30000 },
} as const;

export type TruckType = keyof typeof TRUCK_TYPES;
export const TRUCK_TYPE_KEYS = Object.keys(TRUCK_TYPES) as TruckType[];

export function isTruckType(value: unknown): value is TruckType {
  return typeof value === "string" && value in TRUCK_TYPES;
}

/** Per border crossing: clearing time, permits and agent fees the carrier carries. */
export const BORDER_ALLOWANCE_KES = 15000;
/** Roads are not straight: the road distance is about this much longer than the straight line. */
export const ROAD_FACTOR = 1.25;

export type Place = { id: string; name: string; country: string; lat: number; lng: number; is_border?: boolean };

export function straightLineKm(a: Pick<Place, "lat" | "lng">, b: Pick<Place, "lat" | "lng">) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function roadDistanceKm(a: Pick<Place, "lat" | "lng">, b: Pick<Place, "lat" | "lng">) {
  return Math.max(5, Math.round(straightLineKm(a, b) * ROAD_FACTOR));
}

/** Which countries share a road border that freight uses. */
const ROAD_BORDERS: Record<string, string[]> = {
  KE: ["UG", "TZ", "SS", "ET"],
  UG: ["KE", "RW", "SS", "TZ", "CD"],
  TZ: ["KE", "UG", "RW", "BI", "ZM", "CD"],
  RW: ["UG", "TZ", "BI", "CD"],
  BI: ["RW", "TZ", "CD"],
  SS: ["KE", "UG"],
  CD: ["UG", "RW", "BI", "TZ", "ZM"],
  ET: ["KE"],
  ZM: ["TZ", "CD"],
};

/** Fewest border crossings by road between two countries (0 inside one country). */
export function borderCrossings(from: string, to: string) {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  for (let steps = 1; frontier.length && steps <= 6; steps += 1) {
    const next: string[] = [];
    for (const country of frontier) {
      for (const neighbour of ROAD_BORDERS[country] ?? []) {
        if (neighbour === to) return steps;
        if (!seen.has(neighbour)) { seen.add(neighbour); next.push(neighbour); }
      }
    }
    frontier = next;
  }
  return 1;
}

/** Rounded to the nearest KES 500 so it reads like a real quote. */
export function guidePrice(distanceKm: number, truckType: TruckType, crossings = 0) {
  const type = TRUCK_TYPES[truckType];
  const raw = Math.max(type.minimum, distanceKm * type.ratePerKm) + crossings * BORDER_ALLOWANCE_KES;
  return Math.round(raw / 500) * 500;
}

export function quote(origin: Place, destination: Place, truckType: TruckType) {
  const distanceKm = roadDistanceKm(origin, destination);
  const crossings = borderCrossings(origin.country, destination.country);
  return { distanceKm, crossings, price: guidePrice(distanceKm, truckType, crossings) };
}

/** A stop on the route: a town, optionally pinned to an exact spot. */
export type RoutePoint = Place & { pin?: { lat: number; lng: number } | null };

function at(point: RoutePoint) {
  return point.pin ?? point;
}

/** Fee per extra stop, the same default as platform_settings.stop_fee_kes. */
export const STOP_FEE_KES = 2000;

/**
 * Guide price for a route with optional stops on the way: distance through every point in order,
 * every border crossed between them, and a fee for each extra stop.
 */
export function quoteRoute(points: RoutePoint[], truckType: TruckType, stopFee = STOP_FEE_KES) {
  let distanceKm = 0;
  let crossings = 0;
  for (let i = 1; i < points.length; i += 1) {
    distanceKm += roadDistanceKm(at(points[i - 1]), at(points[i]));
    crossings += borderCrossings(points[i - 1].country, points[i].country);
  }
  const stops = Math.max(0, points.length - 2);
  return { distanceKm, crossings, stops, price: guidePrice(distanceKm, truckType, crossings) + stops * stopFee };
}

/** Adds a surcharge in basis points (1500 = 15%) and rounds to the nearest KES 500 again. */
export function withSurcharge(price: number, bps: number) {
  if (!bps) return price;
  return Math.round((price * (10000 + bps)) / 10000 / 500) * 500;
}

/** The smallest truck type that carries this weight, for a sensible default on the load form. */
export function suggestTruckType(weightTonnes: number): TruckType {
  const order: TruckType[] = ["pickup", "canter", "lorry_7t", "lorry_10t", "lorry_14t", "trailer"];
  return order.find((key) => TRUCK_TYPES[key].tonnes >= weightTonnes) ?? "trailer";
}

/** Trucks that can carry goods for several shippers at once (closed or flatbed lorries, not tankers or tippers). */
export const SHAREABLE_TRUCKS: TruckType[] = ["lorry_7t", "lorry_10t", "lorry_14t", "trailer", "reefer"];
/** A part load fills at most this share of the truck; more than that and it should book a whole truck. */
export const PART_LOAD_MAX_SHARE = 0.6;
/** Each shipper pays for at least a quarter of the truck, plus 20% for the extra pickups and waiting. */
export const PART_LOAD_MIN_SHARE = 0.25;
export const PART_LOAD_PREMIUM = 1.2;

export function canSharePart(weightTonnes: number, truckType: TruckType) {
  return SHAREABLE_TRUCKS.includes(truckType) && weightTonnes > 0 && weightTonnes <= TRUCK_TYPES[truckType].tonnes * PART_LOAD_MAX_SHARE;
}

/** The guide price for a part load: the shipper's share of a whole-truck price, never below KES 3,000. */
export function partLoadPrice(wholeTruckPrice: number, weightTonnes: number, truckType: TruckType) {
  const share = Math.max(PART_LOAD_MIN_SHARE, weightTonnes / TRUCK_TYPES[truckType].tonnes);
  return Math.max(3000, Math.round((wholeTruckPrice * share * PART_LOAD_PREMIUM) / 500) * 500);
}

/** Space left on a truck after the loads it already carries, in tonnes (never negative). */
export function spaceLeft(capacityTonnes: number, carried: number[]) {
  return Math.max(0, Math.round((capacityTonnes - carried.reduce((sum, t) => sum + Number(t), 0)) * 10) / 10);
}

export const COUNTRY_NAMES: Record<string, string> = {
  KE: "Kenya", UG: "Uganda", TZ: "Tanzania", RW: "Rwanda", BI: "Burundi", SS: "South Sudan", CD: "DR Congo", ET: "Ethiopia", ZM: "Zambia",
};
