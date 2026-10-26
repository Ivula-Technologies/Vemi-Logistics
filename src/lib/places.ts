import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import type { PlaceRow } from "@/lib/types";

/** Towns, ports and border posts. Public, small, and the same for everyone. */
export const getPlaces = cache(async (): Promise<PlaceRow[]> => {
  const { data, error } = await createPublicClient().from("places").select("id, name, country, lat, lng, is_border").order("country").order("name");
  if (error) throw new Error(`Could not load places: ${error.message}`);
  return (data ?? []) as PlaceRow[];
});

export async function placeMap() {
  return new Map((await getPlaces()).map((place) => [place.id, place]));
}
