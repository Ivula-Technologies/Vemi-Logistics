import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTruckType } from "@/lib/pricing";
import type { LaneSurge } from "@/lib/types";

/** For the load form: busy-lane and urgent surcharges, and how many free trucks are near the pickup. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const origin = params.get("origin") ?? "";
  const truck = params.get("truck") ?? "";
  const pickup = params.get("pickup") ?? "";
  if (!origin || !isTruckType(truck) || !/^\d{4}-\d{2}-\d{2}$/.test(pickup)) return NextResponse.json({ error: "Choose the route, truck and date." }, { status: 400 });
  const [{ data: surge }, { data: near }] = await Promise.all([
    supabase.rpc("lane_surge", { p_origin: origin, p_truck_type: truck, p_pickup: pickup }),
    supabase.rpc("trucks_near", { p_place: origin, p_truck_type: truck }),
  ]);
  return NextResponse.json({ ...(surge as LaneSurge), trucks_near: near ?? 0 }, { headers: { "Cache-Control": "private, max-age=60" } });
}
