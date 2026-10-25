import { after, NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal";
import { publicUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notify";
import { sendReceipt } from "@/lib/trip-notify";

/** PayPal sends the shipper back here (?token=<order id>). The payment is captured and checked with PayPal itself. */
export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("token") ?? "";
  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("id, trip_id, usd_amount, status").eq("paypal_order_id", orderId).maybeSingle();
  if (!payment) return NextResponse.redirect(publicUrl("/trips?error=Payment%20not%20found.", request));
  const back = (query: string) => NextResponse.redirect(publicUrl(`/trips/${payment.trip_id}?${query}`, request));
  if (payment.status === "paid") return back("saved=paid");
  const capture = await captureOrder(orderId).catch((error) => { console.error("PayPal capture failed", error); return null; });
  if (!capture || capture.customId !== payment.trip_id || capture.usd + 0.001 < Number(payment.usd_amount)) {
    await admin.from("payments").update({ status: "failed", result_description: "PayPal did not complete the payment." }).eq("id", payment.id).eq("status", "pending");
    return back(`error=${encodeURIComponent("The card payment did not go through. Nothing was charged; try again or pay by M-Pesa.")}`);
  }
  const { data: trip, error } = await admin.rpc("apply_paypal_payment", { p_order_id: orderId, p_capture_id: capture.captureId, p_usd: capture.usd, p_raw: capture.raw });
  if (error) { console.error("Could not record PayPal payment", error); return back(`error=${encodeURIComponent("Paid, but we could not record it yet. Vemi will confirm shortly.")}`); }
  const paid = trip as { id: string; ref: string; status: string; carrier_id: string } | null;
  if (paid) after(() => sendReceipt(paid.id, Math.round(capture.usd * 100) / 100, "card (USD)", orderId));
  if (paid?.status === "scheduled") after(() => notifyUser(paid.carrier_id, `${paid.ref} is paid`, "The shipper paid by card. Dispatch the truck: your driver can start from their trip link.", `/trips/${paid.id}`, { sms: true, key: `paid-${paid.id}` }));
  return back("saved=paid");
}
