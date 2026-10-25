import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Subscription = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Saves (POST) or forgets (DELETE) this phone's push subscription for the signed-in person. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const body = await request.json().catch(() => null) as Subscription | null;
  if (!body?.endpoint?.startsWith("https://") || !body.keys?.p256dh || !body.keys.auth || body.endpoint.length > 1000) return NextResponse.json({ error: "Bad subscription." }, { status: 400 });
  const admin = createAdminClient();
  // Keep the ten newest phones and browsers per person.
  const { data: existing } = await admin.from("push_subscriptions").select("id, endpoint").eq("user_id", user.id).order("created_at");
  const stale = (existing ?? []).filter((s) => s.endpoint !== body.endpoint).slice(0, Math.max(0, (existing ?? []).length - 9)).map((s) => s.id);
  if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);
  const { error } = await admin.from("push_subscriptions").upsert({ user_id: user.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const body = await request.json().catch(() => null) as Subscription | null;
  if (body?.endpoint) await createAdminClient().from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}
