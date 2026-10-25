import { NextResponse } from "next/server";
import { getPlaces } from "@/lib/places";
import { isTruckType, quote, TRUCK_TYPES } from "@/lib/pricing";
import { travelHours } from "@/lib/eta";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Cache-Control": "public, max-age=300" };

/**
 * Public quote API for partners and websites: GET /api/v1/quote?from=mombasa&to=kampala&truck=trailer
 * Returns the guide price (before busy-lane surcharges), distance, borders and a rough transit time.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const truck = params.get("truck") ?? "trailer";
  const places = await getPlaces();
  const origin = places.find((p) => p.id === from);
  const destination = places.find((p) => p.id === to);
  if (!origin || !destination || origin.id === destination.id || !isTruckType(truck)) {
    return NextResponse.json({
      error: "Use ?from=<place id>&to=<place id>&truck=<type>.",
      truck_types: Object.keys(TRUCK_TYPES),
      places: places.map((p) => ({ id: p.id, name: p.name, country: p.country })),
    }, { status: 400, headers: CORS });
  }
  const result = quote(origin, destination, truck);
  return NextResponse.json({
    from: { id: origin.id, name: origin.name, country: origin.country },
    to: { id: destination.id, name: destination.name, country: destination.country },
    truck_type: truck,
    currency: "KES",
    guide_price: result.price,
    distance_km: result.distanceKm,
    border_crossings: result.crossings,
    transit_hours: Math.round(travelHours(result.distanceKm, result.crossings)),
    book_url: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/signup`,
  }, { headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
