import { NextResponse } from "next/server";
import { mpesaConfigured, stkPush } from "@/lib/mpesa";
import { normalizeKenyanPhone } from "@/lib/phone";
import { publicOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_TIP = 50_000;

/**
 * Sends an M-Pesa prompt to the shipper's phone: the balance of a trip (or part of it, for trips above the
 * M-Pesa limit), or a tip for the driver after delivery.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });
  if (!mpesaConfigured()) return NextResponse.json({ error: "M-Pesa payments are not switched on yet. Choose another way to pay or call Vemi." }, { status: 503 });
  const body = await request.json().catch(() => null) as { tripId?: string; phone?: string; amount?: number; purpose?: string } | null;
  const phone = normalizeKenyanPhone(body?.phone ?? "");
  const purpose = body?.purpose === "tip" ? "tip" : "trip";
  if (!body?.tripId) return NextResponse.json({ error: "Trip missing." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Enter a Safaricom number like 0712 345 678." }, { status: 400 });

  // Read through the user's own session: row-level security proves the trip belongs to their (business) account.
  const { data: trip } = await supabase.from("trips").select("id, ref, status, balance, carrier_id").eq("id", body.tripId).maybeSingle();
  if (!trip || trip.carrier_id === user.id) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  const { data: settings } = await supabase.from("platform_settings").select("mpesa_max_kes").single();
  const limit = settings?.mpesa_max_kes ?? 250000;

  let amount: number;
  if (purpose === "tip") {
    if (!["delivered", "completed"].includes(trip.status)) return NextResponse.json({ error: "You can tip once the goods are delivered." }, { status: 409 });
    amount = Math.round(Number(body.amount));
    if (!(amount >= 50 && amount <= MAX_TIP)) return NextResponse.json({ error: `Tip between KES 50 and KES ${MAX_TIP.toLocaleString("en-KE")}.` }, { status: 400 });
  } else {
    if (trip.balance <= 0) return NextResponse.json({ error: "Nothing is owed on this trip." }, { status: 409 });
    // Pay in parts: any amount up to the balance and the M-Pesa limit.
    const asked = body.amount === undefined ? Math.min(trip.balance, limit) : Math.round(Number(body.amount));
    if (!(asked >= 10 && asked <= trip.balance)) return NextResponse.json({ error: `Enter an amount between KES 10 and KES ${trip.balance.toLocaleString("en-KE")}.` }, { status: 400 });
    if (asked > limit) return NextResponse.json({ error: `M-Pesa takes up to KES ${limit.toLocaleString("en-KE")} at a time. Pay in parts, by card, or by bank transfer.` }, { status: 400 });
    amount = asked;
  }

  const admin = createAdminClient();
  const { count } = await admin.from("payments").select("id", { count: "exact", head: true }).eq("trip_id", trip.id).gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  if ((count ?? 0) >= 5) return NextResponse.json({ error: "Too many payment prompts. Wait a few minutes and try again." }, { status: 429 });
  const { data: owner } = await admin.from("trips").select("shipper_id").eq("id", trip.id).single();

  const callbackUrl = `${publicOrigin(request)}/api/mpesa/callback?token=${encodeURIComponent(process.env.MPESA_CALLBACK_SECRET!)}`;
  let prompt;
  try {
    prompt = await stkPush({ phone, amount, callbackUrl, reference: trip.ref.replace(/[^A-Z0-9]/gi, ""), description: purpose === "tip" ? "Vemi tip" : "Vemi freight" });
  } catch (error) {
    console.error("M-Pesa STK push failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "M-Pesa could not send the payment prompt." }, { status: 502 });
  }
  const { data: payment, error } = await admin.from("payments").insert({
    trip_id: trip.id, shipper_id: owner!.shipper_id, method: "mpesa", amount, phone, purpose, recorded_by: user.id,
    checkout_request_id: prompt.checkoutRequestId, merchant_request_id: prompt.merchantRequestId,
  }).select("id").single();
  if (error) { console.error("Could not record M-Pesa payment", error); return NextResponse.json({ error: "Could not record the payment. Please try again." }, { status: 500 }); }
  return NextResponse.json({ paymentId: payment.id, amount, message: prompt.customerMessage });
}
