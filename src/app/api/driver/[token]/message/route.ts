import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tellAboutMessage } from "@/lib/trip-notify";
import { rateLimit } from "@/lib/ops";

/** Trip chat from the driver's link. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await rateLimit(`driver-message:${token}`, 30, 600))) return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
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
