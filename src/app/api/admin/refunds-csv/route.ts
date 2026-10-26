import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { eatToday } from "@/lib/utils";

/** Queued wallet cash-outs as a bulk payment file for the M-Pesa org portal. Admins only. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { data, error } = await supabase.from("refunds").select("id, amount, phone, account_id").eq("status", "queued").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows: unknown[][] = [["Phone", "Amount", "Reference", "Cash-out ID"]];
  for (const r of data ?? []) rows.push([r.phone, r.amount, "Vemi wallet", r.id]);
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vemi-cashouts-${eatToday()}.csv"`, "Cache-Control": "no-store" },
  });
}
