import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dialXml, hangupXml } from "@/lib/voice";

function secretMatches(given: string | null) {
  const expected = process.env.AT_VOICE_CALLBACK_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const xml = (body: string) => new NextResponse(body, { headers: { "Content-Type": "application/xml" } });

/**
 * Africa's Talking calls this when the caller picks up (set it as the voice number's callback URL,
 * with ?secret=AT_VOICE_CALLBACK_SECRET). We answer with "dial the other person", so neither sees a real number.
 */
export async function POST(request: Request) {
  if (!secretMatches(new URL(request.url).searchParams.get("secret"))) return new NextResponse("Unauthorized", { status: 401 });
  const form = await request.formData().catch(() => null);
  const sessionId = String(form?.get("sessionId") ?? "");
  const active = String(form?.get("isActive") ?? "1") === "1";
  const admin = createAdminClient();
  const { data: call } = sessionId ? await admin.from("voice_calls").select("id, callee_phone, status").eq("session_id", sessionId).maybeSingle() : { data: null };
  if (!active) {
    if (call) await admin.from("voice_calls").update({ status: String(form?.get("status") ?? "ended").slice(0, 40) }).eq("id", call.id);
    return xml(hangupXml("Goodbye."));
  }
  if (!call) return xml(hangupXml("Sorry, this Vemi call has expired."));
  await admin.from("voice_calls").update({ status: "connecting" }).eq("id", call.id);
  return xml(dialXml(call.callee_phone));
}
