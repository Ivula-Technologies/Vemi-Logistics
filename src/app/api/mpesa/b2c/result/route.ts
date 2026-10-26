import { after, NextResponse } from "next/server";
import { callbackTokenMatches, type B2cResult } from "@/lib/mpesa";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOps, notifyUser } from "@/lib/notify";
import { formatKes } from "@/lib/utils";

const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

/** Safaricom's answer for one B2C payout or cash-out. Paid ones are marked paid; failed ones go back to the queue. */
export async function POST(request: Request) {
  if (!callbackTokenMatches(new URL(request.url).searchParams.get("token"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as B2cResult | null;
  const result = body?.Result;
  if (!result?.OriginatorConversationID) return NextResponse.json(ACK);
  const ok = String(result.ResultCode) === "0";
  const { data, error } = await createAdminClient().rpc("b2c_result", { p_conversation: result.OriginatorConversationID, p_ok: ok, p_receipt: result.TransactionID ?? null, p_error: ok ? null : result.ResultDesc ?? "Failed" });
  if (error) { console.error("B2C result not recorded", error); return NextResponse.json({ ResultCode: 1, ResultDesc: "Retry" }, { status: 500 }); }
  const row = data as { kind: "payout" | "refund"; carrier_id?: string; account_id?: string; amount: number; ok: boolean } | null;
  if (row) after(async () => {
    if (!row.ok) { await notifyOps("M-Pesa payout failed", `${formatKes(row.amount)}: ${result.ResultDesc}. It is back in the queue.`, row.kind === "refund" ? "/admin/refunds" : "/admin/payouts"); return; }
    const person = row.carrier_id ?? row.account_id;
    if (person) await notifyUser(person, row.kind === "refund" ? "Wallet cash-out sent" : "Payout sent", `${formatKes(row.amount)} was sent to your M-Pesa (ref ${result.TransactionID}).`, row.kind === "refund" ? "/wallet" : "/earnings", { sms: true });
  });
  return NextResponse.json(ACK);
}
