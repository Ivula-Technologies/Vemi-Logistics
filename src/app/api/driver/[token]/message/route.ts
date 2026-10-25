import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tellAboutMessage } from "@/lib/trip-notify";

/** Trip chat from the driver's link. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => null) as { body?: string } | null;
  const text = (body?.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Write a message." }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.rpc("driver_send_message", { p_token: token, p_body: text });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data: trip } = await admin.from("trips").select("id").eq("driver_token", token).single();
  if (trip) after(() => tellAboutMessage(trip.id, "driver", text, false));
  return NextResponse.json({ ok: true });
}
