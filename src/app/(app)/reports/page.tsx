import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { placeMap } from "@/lib/places";
import { formatKes } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

type Row = { status: string; total_due: number; amount_paid: number; balance: number; on_credit: boolean; created_at: string; delivered_at: string | null; expected_delivery: string | null; loads: { origin_id: string; destination_id: string; weight_tonnes: number } | null };

/** Monthly spend, on-time delivery and top lanes for the business account, plus a spreadsheet of every trip. */
export default async function ReportsPage() {
  await requireRole("shipper");
  const supabase = await createClient();
  const since = new Date(); since.setMonth(since.getMonth() - 11, 1);
  const [{ data }, places] = await Promise.all([
    supabase.from("trips").select("status, total_due, amount_paid, balance, on_credit, created_at, delivered_at, expected_delivery, loads(origin_id, destination_id, weight_tonnes)").gte("created_at", since.toISOString().slice(0, 10)).neq("status", "cancelled").limit(5000),
    placeMap(),
  ]);
  const trips = (data ?? []) as unknown as Row[];
  const month = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { month: "short", year: "numeric", timeZone: "Africa/Nairobi" });
  const months: { label: string; spend: number; trips: number; tonnes: number }[] = [];
  for (let i = 0; i < 12; i++) { const d = new Date(since); d.setMonth(since.getMonth() + i); months.push({ label: month(d.toISOString()), spend: 0, trips: 0, tonnes: 0 }); }
  const lanes = new Map<string, { trips: number; spend: number }>();
  let delivered = 0, onTime = 0, owed = 0;
  for (const t of trips) {
    const m = months.find((x) => x.label === month(t.created_at));
    if (m) { m.spend += t.total_due; m.trips += 1; m.tonnes += Number(t.loads?.weight_tonnes ?? 0); }
    if (t.loads) { const key = `${places.get(t.loads.origin_id)?.name} → ${places.get(t.loads.destination_id)?.name}`; const lane = lanes.get(key) ?? { trips: 0, spend: 0 }; lane.trips += 1; lane.spend += t.total_due; lanes.set(key, lane); }
    if (t.delivered_at && t.expected_delivery) { delivered += 1; if (t.delivered_at.slice(0, 10) <= t.expected_delivery) onTime += 1; }
    owed += Math.max(t.balance, 0);
  }
  const max = Math.max(...months.map((m) => m.spend), 1);
  const total = months.reduce((s, m) => s + m.spend, 0);
  const top = [...lanes.entries()].sort((a, b) => b[1].spend - a[1].spend).slice(0, 8);

  return <div className="max-w-4xl space-y-6">
    <PageHeader title="Reports" description="The last 12 months of trips on your account." actions={<Button asChild variant="outline"><a href="/api/reports/csv"><Download className="mr-2 h-4 w-4" />Download all trips (CSV)</a></Button>} />
    <div className="grid gap-3 sm:grid-cols-4">
      {[["Spent", formatKes(total)], ["Trips", String(trips.length)], ["On time", delivered ? `${Math.round((100 * onTime) / delivered)}%` : "—"], ["Still to pay", formatKes(owed)]].map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}
    </div>
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 font-semibold">Spend by month</h2>
      <ol className="space-y-2 text-sm">{months.map((m) => <li key={m.label} className="grid grid-cols-[72px_1fr_auto] items-center gap-3">
        <span className="text-muted-foreground">{m.label}</span>
        <span className="h-3 rounded-full bg-muted"><span className="block h-3 rounded-full bg-primary" style={{ width: `${(100 * m.spend) / max}%` }} /></span>
        <span className="tabular-nums">{m.spend ? `${formatKes(m.spend)} · ${m.trips} trip${m.trips === 1 ? "" : "s"}` : "—"}</span>
      </li>)}</ol>
    </section>
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-3 font-semibold">Top lanes</h2>
      {top.length ? <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 font-medium">Lane</th><th className="py-1 text-right font-medium">Trips</th><th className="py-1 text-right font-medium">Spend</th><th className="py-1 text-right font-medium">Average</th></tr></thead>
        <tbody className="divide-y">{top.map(([lane, v]) => <tr key={lane}><td className="py-2">{lane}</td><td className="py-2 text-right tabular-nums">{v.trips}</td><td className="py-2 text-right tabular-nums">{formatKes(v.spend)}</td><td className="py-2 text-right tabular-nums">{formatKes(Math.round(v.spend / v.trips))}</td></tr>)}</tbody></table>
        : <p className="text-sm text-muted-foreground">Your lanes show here after your first trip.</p>}
    </section>
  </div>;
}
