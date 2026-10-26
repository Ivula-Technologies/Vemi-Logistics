import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callbackTokenMatches } from "@/lib/mpesa";

/** Safaricom timed out a B2C request: put it back in the queue so ops can send it again. */
export async function POST(request: Request) {
  if (!callbackTokenMatches(new URL(request.url).searchParams.get("token"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { OriginatorConversationID?: string; Result?: { OriginatorConversationID?: string } } | null;
  const id = body?.Result?.OriginatorConversationID ?? body?.OriginatorConversationID;
  if (id) await createAdminClient().rpc("b2c_result", { p_conversation: id, p_ok: false, p_receipt: null, p_error: "Timed out at Safaricom" });
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
