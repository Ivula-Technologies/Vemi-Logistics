/** Arrival estimates from the truck's last position. Freight is slow and predictable enough for averages. */

import { roadDistanceKm } from "@/lib/pricing";

/** Loaded trucks on East African highways, including towns, weighbridges and climbs. */
export const AVERAGE_SPEED_KMH = 50;
/** Drivers rest at night: about 11 hours on the road a day. */
export const DRIVING_HOURS_PER_DAY = 11;
/** Clearing a border with documents in order. */
export const BORDER_HOURS = 8;

type Point = { lat: number; lng: number };

/** Hours from here to there, with overnight rests and border time. */
export function travelHours(km: number, borders = 0) {
  const driving = km / AVERAGE_SPEED_KMH;
  const nights = Math.floor(driving / DRIVING_HOURS_PER_DAY);
  return driving + nights * (24 - DRIVING_HOURS_PER_DAY) + borders * BORDER_HOURS;
}

/** The route still ahead, in order (the next stops, then the destination). */
export function eta(from: Point, ahead: Point[], borders: number, now = new Date()) {
  let km = 0;
  let previous = from;
  for (const point of ahead) {
    km += roadDistanceKm(previous, point);
    previous = point;
  }
  // Within a couple of km the truck is there; road factor and minimums would overstate it.
  if (ahead.length === 1 && km <= 6) km = 0;
  const hours = travelHours(km, borders);
  return { km, hours, at: new Date(now.getTime() + hours * 3_600_000) };
}

export function formatDuration(hours: number) {
  if (hours < 0.75) return "under an hour";
  if (hours < 24) return `about ${Math.round(hours)} h`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);
  return `about ${days} day${days > 1 ? "s" : ""}${rest ? ` ${rest} h` : ""}`;
}
