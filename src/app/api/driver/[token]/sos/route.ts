import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOps, notifyUser } from "@/lib/notify";

/** The driver's emergency button: ops get an SMS and email with the location, the carrier and shipper are told. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => null) as { note?: string; lat?: number; lng?: number } | null;
  const lat = typeof body?.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body?.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;
  const admin = createAdminClient();
  const { data: tripId, error } = await admin.rpc("driver_sos", { p_token: token, p_note: body?.note?.slice(0, 500) || null, p_lat: lat, p_lng: lng });
  if (error || !tripId) return NextResponse.json({ error: error?.message ?? "Could not send the SOS." }, { status: 400 });
  after(async () => {
    const { data: trip } = await admin.from("trips").select("ref, carrier_id, shipper_id, drivers(full_name, phone)").eq("id", tripId).single();
    const driver = trip?.drivers as unknown as { full_name: string; phone: string } | null;
    const where = lat !== null && lng !== null ? ` Location: https://maps.google.com/?q=${lat},${lng}` : " No location from the phone.";
    await notifyOps(`SOS from the driver on ${trip?.ref}`, `${driver?.full_name ?? "The driver"} (${driver?.phone ?? "?"}) pressed SOS.${body?.note ? ` "${body.note}"` : ""}${where}`, `/trips/${tripId}`, { urgent: true });
    if (trip) await notifyUser(trip.carrier_id, `SOS from your driver on ${trip.ref}`, `${driver?.full_name ?? "Your driver"} pressed the emergency button. Vemi ops are calling them. Call them too.${where}`, `/trips/${tripId}`, { sms: true });
  });
  return NextResponse.json({ ok: true });
}
