import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** The driver ticks off a stop on the way. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => null) as { seq?: number } | null;
  if (!Number.isInteger(body?.seq)) return NextResponse.json({ error: "Choose the stop." }, { status: 400 });
  const { error } = await createAdminClient().rpc("driver_stop_done", { p_token: token, p_seq: body!.seq });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
