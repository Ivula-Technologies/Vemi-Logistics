import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/status-badge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatKes } from "@/lib/utils";
import { displayPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const { user } = await requireRole("carrier");
  const supabase = await createClient();
  const { data } = await supabase.from("payouts").select("id, amount, phone, status, reference, paid_at, created_at, trip_id, trips(ref, price, commission)").eq("carrier_id", user.id).order("created_at", { ascending: false }).limit(200);
  const payouts = (data ?? []) as unknown as { id: string; amount: number; phone: string | null; status: "queued" | "paid" | "held"; reference: string | null; paid_at: string | null; created_at: string; trip_id: string; trips: { ref: string; price: number; commission: number } | null }[];
  const total = (status: string) => payouts.filter((p) => p.status === status).reduce((sum, p) => sum + p.amount, 0);
  return <div className="space-y-6">
    <PageHeader title="Earnings" description="Payouts go to your M-Pesa within 24 hours of the shipper confirming delivery." />
    <div className="grid gap-3 sm:grid-cols-3">
      {[["On the way", total("queued")], ["Paid", total("paid")], ["Held (dispute)", total("held")]].map(([label, value]) => <div key={label as string} className="rounded-lg border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{formatKes(value as number)}</p></div>)}
    </div>
    {payouts.length ? <div className="divide-y rounded-lg border bg-card">{payouts.map((p) => <Link key={p.id} href={`/trips/${p.trip_id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/40">
      <div><p className="font-semibold">{p.trips?.ref}</p><p className="text-xs text-muted-foreground">Trip {formatKes(p.trips?.price)} − commission {formatKes(p.trips?.commission)}{p.phone ? ` · to ${displayPhone(p.phone)}` : ""}{p.reference ? ` · ref ${p.reference}` : ""}</p></div>
      <div className="text-right"><p className="font-bold">{formatKes(p.amount)}</p><div className="mt-1">{p.status === "paid" ? <ToneBadge tone="success">Paid {formatDate(p.paid_at)}</ToneBadge> : p.status === "held" ? <ToneBadge tone="danger">Held</ToneBadge> : <ToneBadge tone="info">On the way</ToneBadge>}</div></div>
    </Link>)}</div> : <EmptyState icon={<Wallet className="h-5 w-5" />} title="No payouts yet" description="Finish a trip and your first payout shows here." />}
  </div>;
}
