import { NextResponse } from "next/server";
import { createOrder, kesToUsd, paypalConfigured } from "@/lib/paypal";
import { publicOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Card or PayPal for the trip balance, in USD at the rate ops set. Returns the PayPal page to send the shipper to. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });
  if (!paypalConfigured()) return NextResponse.json({ error: "Card payments are not switched on yet." }, { status: 503 });
  const body = await request.json().catch(() => null) as { tripId?: string } | null;
  const { data: trip } = await supabase.from("trips").select("id, ref, balance, carrier_id").eq("id", body?.tripId ?? "").maybeSingle();
  if (!trip || trip.carrier_id === user.id) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  if (trip.balance <= 0) return NextResponse.json({ error: "Nothing is owed on this trip." }, { status: 409 });
  const { data: settings } = await supabase.from("platform_settings").select("usd_rate").single();
  const usd = kesToUsd(trip.balance, Number(settings?.usd_rate ?? 129));
  const origin = publicOrigin(request);
  const admin = createAdminClient();
  const { data: owner } = await admin.from("trips").select("shipper_id").eq("id", trip.id).single();
  const requestId = crypto.randomUUID();
  try {
    const order = await createOrder({ usd, customId: trip.id, description: `Vemi trip ${trip.ref}`, requestId,
      returnUrl: `${origin}/api/paypal/return`, cancelUrl: `${origin}/trips/${trip.id}?error=${encodeURIComponent("Card payment cancelled. Nothing was charged.")}` });
    const { error } = await admin.from("payments").insert({ trip_id: trip.id, shipper_id: owner!.shipper_id, method: "paypal", amount: trip.balance, usd_amount: usd, paypal_order_id: order.id, recorded_by: user.id });
    if (error) throw error;
    return NextResponse.json({ approveUrl: order.approveUrl, usd });
  } catch (error) {
    console.error("PayPal checkout failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal could not start the payment." }, { status: 502 });
  }
}
