import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tellShipperAboutStatus } from "@/lib/trip-notify";
import type { TripStatus } from "@/lib/trips";

/** The driver's trip link moves the trip forward. The token in the link is the only credential. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => null) as { status?: string; note?: string; lat?: number; lng?: number } | null;
  if (!body?.status) return NextResponse.json({ error: "Choose a step." }, { status: 400 });
  const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;
  const { data, error } = await createAdminClient().rpc("driver_update_trip", { p_token: token, p_status: body.status, p_note: body.note?.slice(0, 500) || null, p_lat: lat, p_lng: lng });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const trip = data as { id: string } | null;
  if (trip) after(() => tellShipperAboutStatus(trip.id, body.status as TripStatus));
  return NextResponse.json({ ok: true });
}
