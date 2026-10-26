import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Location from the driver's phone while the trip page is open. At most one point a minute is kept. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => null) as { lat?: number; lng?: number; accuracy?: number } | null;
  const { lat, lng } = body ?? {};
  if (typeof lat !== "number" || typeof lng !== "number" || Math.abs(lat) > 90 || Math.abs(lng) > 180) return NextResponse.json({ error: "Bad position." }, { status: 400 });
  const accuracy = typeof body?.accuracy === "number" ? Math.min(Math.round(body.accuracy), 100000) : null;
  const { data, error } = await createAdminClient().rpc("driver_ping", { p_token: token, p_lat: lat, p_lng: lng, p_accuracy: accuracy });
  if (error) return NextResponse.json({ error: "Could not save the position." }, { status: 500 });
  return NextResponse.json({ saved: Boolean(data) });
}
