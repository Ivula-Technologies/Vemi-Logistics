import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { daysAgoIso, formatKes } from "@/lib/utils";

export const metadata: Metadata = { title: "Vemi ops" };

export default async function AdminPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const since = daysAgoIso(30);
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [pendingCarriers, verifiedCarriers, openLoads, awaitingPayment, live, delivered, disputed, { data: recent }, { data: queued }, alerts, creditAsks, cashouts] = await Promise.all([
    count(supabase.from("carriers").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(supabase.from("carriers").select("id", { count: "exact", head: true }).eq("status", "verified")),
    count(supabase.from("loads").select("id", { count: "exact", head: true }).eq("status", "open")),
    count(supabase.from("trips").select("id", { count: "exact", head: true }).eq("status", "awaiting_payment")),
    count(supabase.from("trips").select("id", { count: "exact", head: true }).in("status", ["scheduled", "to_pickup", "loaded", "in_transit", "at_border"])),
    count(supabase.from("trips").select("id", { count: "exact", head: true }).eq("status", "delivered")),
    count(supabase.from("trips").select("id", { count: "exact", head: true }).eq("status", "disputed")),
    supabase.from("trips").select("price, commission").eq("status", "completed").gte("completed_at", since),
    supabase.from("payouts").select("amount").eq("status", "queued"),
    count(supabase.from("trips").select("id", { count: "exact", head: true }).or("sos_at.not.is.null,alert.not.is.null")),
    count(supabase.from("business_accounts").select("owner_id", { count: "exact", head: true }).eq("credit_status", "requested")),
    count(supabase.from("refunds").select("id", { count: "exact", head: true }).eq("status", "queued")),
  ]);
  const gmv = (recent ?? []).reduce((s, t) => s + t.price, 0);
  const revenue = (recent ?? []).reduce((s, t) => s + t.commission, 0);
  const owed = (queued ?? []).reduce((s, p) => s + p.amount, 0);
  const tiles: [string, string, string][] = [
    ["SOS and truck alerts", String(alerts), "/admin/map"],
    ["Carriers to verify", String(pendingCarriers), "/admin/carriers?status=pending"],
    ["Verified carriers", String(verifiedCarriers), "/admin/carriers?status=verified"],
    ["Open loads", String(openLoads), "/admin/trips"],
    ["Waiting for payment", String(awaitingPayment), "/admin/trips?status=awaiting_payment"],
    ["On the road", String(live), "/admin/trips?status=live"],
    ["Delivered, unconfirmed", String(delivered), "/admin/trips?status=delivered"],
    ["Disputes", String(disputed), "/admin/trips?status=disputed"],
    ["Payouts to send", formatKes(owed), "/admin/payouts"],
    ["Wallet cash-outs", String(cashouts), "/admin/refunds"],
    ["Credit requests", String(creditAsks), "/admin/business"],
    ["Trip value, 30 days", formatKes(gmv), "/admin/trips?status=completed"],
    ["Vemi commission, 30 days", formatKes(revenue), "/admin/trips?status=completed"],
  ];
  return <div>
    <PageHeader title="Vemi ops" description="Verify carriers, watch every trip, settle disputes and send payouts." />
    <div className="mb-4 flex flex-wrap gap-2 text-sm">{[["/admin/map", "Live map"], ["/admin/settings", "Prices and fees"], ["/admin/promos", "Promo codes"], ["/admin/business", "Business accounts"], ["/admin/refunds", "Cash-outs"]].map(([href, label]) => <Link key={href} href={href} className="rounded-full border bg-card px-3 py-1.5 font-medium hover:border-primary/50">{label}</Link>)}</div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{tiles.map(([label, value, href]) => <Link key={label} href={href} className="rounded-lg border bg-card p-4 hover:border-primary/50"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></Link>)}</div>
  </div>;
}
