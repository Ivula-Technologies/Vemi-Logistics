import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startTripCall, type CallTarget } from "@/lib/calls";
import { rateLimit } from "@/lib/ops";

/** The driver calls the carrier or a contact through Vemi: Vemi rings the driver, then connects them. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await rateLimit(`driver-call:${token}`, 10, 3600))) return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  const body = await request.json().catch(() => null) as { to?: CallTarget } | null;
  const { data: trip } = await createAdminClient().from("trips").select("id, drivers(phone)").eq("driver_token", token).maybeSingle();
  if (!trip) return NextResponse.json({ error: "This trip link is not valid." }, { status: 404 });
  const phone = (trip.drivers as unknown as { phone: string } | null)?.phone ?? null;
  const error = await startTripCall(trip.id, "driver", phone, body?.to ?? "carrier");
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
