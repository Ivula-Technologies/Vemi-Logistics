import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { callbackItem, type StkCallback } from "@/lib/mpesa";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notify";

/** Safaricom retries a callback that does not get this exact acknowledgement. */
const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

function tokenMatches(token: string | null) {
  const expected = process.env.MPESA_CALLBACK_SECRET;
  if (!expected || !token) return false;
  const a = Buffer.from(token); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!tokenMatches(new URL(request.url).searchParams.get("token"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { Body?: { stkCallback?: StkCallback } } | null;
  const callback = body?.Body?.stkCallback;
  if (!callback?.CheckoutRequestID) return NextResponse.json(ACK);

  const admin = createAdminClient();
  try {
    const { data: payment } = await admin.from("payments").select("id, amount, status").eq("checkout_request_id", callback.CheckoutRequestID).maybeSingle();
    if (!payment || payment.status !== "pending") return NextResponse.json(ACK);
    if (String(callback.ResultCode) !== "0") {
      await admin.rpc("fail_mpesa_payment", { p_checkout_request_id: callback.CheckoutRequestID, p_description: callback.ResultDesc ?? "Payment not completed.", p_raw: body });
      return NextResponse.json(ACK);
    }
    const paid = Number(callbackItem(callback, "Amount"));
    if (!(paid >= payment.amount)) {
      console.error("M-Pesa callback amount below the expected amount", callback.CheckoutRequestID, paid, payment.amount);
      await admin.rpc("fail_mpesa_payment", { p_checkout_request_id: callback.CheckoutRequestID, p_description: `Paid ${paid}, expected ${payment.amount}. Vemi will contact you.`, p_raw: body });
      return NextResponse.json(ACK);
    }
    const receipt = callbackItem(callback, "MpesaReceiptNumber");
    const { data: trip, error } = await admin.rpc("apply_mpesa_payment", { p_checkout_request_id: callback.CheckoutRequestID, p_receipt: receipt ? String(receipt) : null, p_amount: payment.amount, p_raw: body });
    if (error) throw error;
    const paidTrip = trip as { id: string; ref: string; status: string; carrier_id: string } | null;
    if (paidTrip?.status === "scheduled") {
      after(() => notifyUser(paidTrip.carrier_id, `${paidTrip.ref} is paid`, "The shipper paid by M-Pesa. Dispatch the truck: your driver can start from their trip link.", `/trips/${paidTrip.id}`, { sms: true, key: `paid-${paidTrip.id}` }));
    }
  } catch (error) {
    console.error("M-Pesa callback processing failed", callback.CheckoutRequestID, error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Retry" }, { status: 500 });
  }
  return NextResponse.json(ACK);
}
