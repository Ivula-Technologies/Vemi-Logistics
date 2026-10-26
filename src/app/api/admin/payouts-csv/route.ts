import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { eatToday } from "@/lib/utils";

/**
 * Queued payouts as a bulk payment file for the M-Pesa org portal (B2C bulk upload):
 * phone, amount, name, reference. Admins only (row-level security limits what others see anyway).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { data, error } = await supabase.from("payouts").select("id, amount, phone, trips(ref), carriers(business_name)").eq("status", "queued").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows: unknown[][] = [["Phone", "Amount", "Name", "Reference", "Payout ID"]];
  for (const payout of data ?? []) {
    rows.push([payout.phone ?? "MISSING", payout.amount, (payout.carriers as unknown as { business_name: string } | null)?.business_name ?? "", (payout.trips as unknown as { ref: string } | null)?.ref ?? "", payout.id]);
  }
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vemi-payouts-${eatToday()}.csv"`, "Cache-Control": "no-store" },
  });
}
