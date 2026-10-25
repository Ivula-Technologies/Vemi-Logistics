import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { eatToday } from "@/lib/utils";
import { TRIP_STATUS } from "@/lib/trips";

/** Every trip of the signed-in shipper account (or carrier) as a spreadsheet, for accounts and month-end. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const from = new URL(request.url).searchParams.get("from");
  let query = supabase.from("trips").select("id, ref, status, price, insurance_fee, extras, discount, total_due, amount_paid, balance, tip, on_credit, credit_due_on, created_at, delivered_at, expected_delivery, carrier_id, carrier_payout, loads(origin_id, destination_id, cargo_description, weight_tonnes, truck_type), carriers(business_name)")
    .order("created_at", { ascending: false }).limit(5000);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("created_at", from);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows: unknown[][] = [["Trip", "Booked", "Status", "From", "To", "Goods", "Tonnes", "Truck", "Carrier", "Trip price", "Cargo cover", "Extras", "Discount", "Total", "Paid", "Owed", "Tip", "On account", "Invoice due", "Expected", "Delivered", "Your payout (carriers)"]];
  for (const t of data ?? []) {
    const load = t.loads as unknown as { origin_id: string; destination_id: string; cargo_description: string; weight_tonnes: number; truck_type: string } | null;
    const carrier = t.carriers as unknown as { business_name: string } | null;
    const mine = t.carrier_id === user.id;
    rows.push([t.ref, t.created_at.slice(0, 10), TRIP_STATUS[t.status as keyof typeof TRIP_STATUS]?.label ?? t.status, load?.origin_id, load?.destination_id, load?.cargo_description, load?.weight_tonnes, load?.truck_type, carrier?.business_name,
      t.price, t.insurance_fee, t.extras, t.discount, t.total_due, t.amount_paid, t.balance, t.tip, t.on_credit ? "yes" : "", t.credit_due_on ?? "", t.expected_delivery ?? "", t.delivered_at?.slice(0, 10) ?? "", mine ? t.carrier_payout : ""]);
  }
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vemi-trips-${eatToday()}.csv"`, "Cache-Control": "no-store" },
  });
}
