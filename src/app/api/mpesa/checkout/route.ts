import { NextResponse } from "next/server";
import { mpesaConfigured, stkPush } from "@/lib/mpesa";
import { normalizeKenyanPhone } from "@/lib/phone";
import { publicOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Sends an M-Pesa prompt to the shipper's phone for the unpaid balance of a trip. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });
  if (!mpesaConfigured()) return NextResponse.json({ error: "M-Pesa payments are not switched on yet. Choose bank transfer or call Vemi." }, { status: 503 });
  const body = await request.json().catch(() => null) as { tripId?: string; phone?: string } | null;
  const phone = normalizeKenyanPhone(body?.phone ?? "");
  if (!body?.tripId) return NextResponse.json({ error: "Trip missing." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Enter a Safaricom number like 0712 345 678." }, { status: 400 });

  // Read through the user's own session: row-level security proves this is their trip.
  const { data: trip } = await supabase.from("trips").select("id, ref, price, amount_paid, status, shipper_id").eq("id", body.tripId).maybeSingle();
  if (!trip || trip.shipper_id !== user.id) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  if (trip.status !== "awaiting_payment") return NextResponse.json({ error: "This trip is already paid." }, { status: 409 });
  const amount = trip.price - trip.amount_paid;
  const { data: settings } = await supabase.from("platform_settings").select("mpesa_max_kes").single();
  const limit = settings?.mpesa_max_kes ?? 250000;
  if (amount > limit) return NextResponse.json({ error: `M-Pesa takes up to KES ${limit.toLocaleString("en-KE")} at a time. Pay this trip by bank transfer.` }, { status: 400 });

  const admin = createAdminClient();
  const { count } = await admin.from("payments").select("id", { count: "exact", head: true }).eq("trip_id", trip.id).gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  if ((count ?? 0) >= 5) return NextResponse.json({ error: "Too many payment prompts. Wait a few minutes and try again." }, { status: 429 });

  const callbackUrl = `${publicOrigin(request)}/api/mpesa/callback?token=${encodeURIComponent(process.env.MPESA_CALLBACK_SECRET!)}`;
  let prompt;
  try {
    prompt = await stkPush({ phone, amount, callbackUrl, reference: trip.ref.replace(/[^A-Z0-9]/gi, ""), description: "Vemi freight" });
  } catch (error) {
    console.error("M-Pesa STK push failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "M-Pesa could not send the payment prompt." }, { status: 502 });
  }
  const { data: payment, error } = await admin.from("payments").insert({
    trip_id: trip.id, shipper_id: user.id, method: "mpesa", amount, phone,
    checkout_request_id: prompt.checkoutRequestId, merchant_request_id: prompt.merchantRequestId,
  }).select("id").single();
  if (error) { console.error("Could not record M-Pesa payment", error); return NextResponse.json({ error: "Could not record the payment. Please try again." }, { status: 500 }); }
  return NextResponse.json({ paymentId: payment.id, amount, message: prompt.customerMessage });
}
