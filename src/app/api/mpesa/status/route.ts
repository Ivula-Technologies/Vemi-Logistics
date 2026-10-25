import { NextResponse } from "next/server";
import { stkQuery } from "@/lib/mpesa";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** The pay screen polls this. If the callback is late, ask Safaricom directly once the prompt is a minute old. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("paymentId");
  if (!id) return NextResponse.json({ error: "Payment missing." }, { status: 400 });
  const { data: payment } = await supabase.from("payments").select("id, status, result_description, created_at, trip_id").eq("id", id).maybeSingle();
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (payment.status !== "pending" || Date.now() - new Date(payment.created_at).getTime() < 45_000) {
    return NextResponse.json({ status: payment.status, message: payment.result_description });
  }
  const admin = createAdminClient();
  const { data: full } = await admin.from("payments").select("checkout_request_id, amount").eq("id", id).single();
  if (!full?.checkout_request_id) return NextResponse.json({ status: "pending" });
  try {
    const result = await stkQuery(full.checkout_request_id);
    if (result.state === "paid") {
      await admin.rpc("apply_mpesa_payment", { p_checkout_request_id: full.checkout_request_id, p_receipt: null, p_amount: full.amount, p_raw: null });
      return NextResponse.json({ status: "paid" });
    }
    if (result.state === "failed") {
      await admin.rpc("fail_mpesa_payment", { p_checkout_request_id: full.checkout_request_id, p_description: result.description, p_raw: null });
      return NextResponse.json({ status: "failed", message: result.description });
    }
  } catch (error) {
    console.error("M-Pesa status check failed", error);
  }
  return NextResponse.json({ status: "pending" });
}
