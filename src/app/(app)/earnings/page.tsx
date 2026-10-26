import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/status-badge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatKes } from "@/lib/utils";
import { displayPhone } from "@/lib/phone";
import type { PayoutKind } from "@/lib/types";

const KIND: Record<PayoutKind, string> = { trip: "Trip payout", advance: "Fuel advance", tip: "Tip from the shipper", cancellation: "Cancellation fee", bonus: "Bonus" };

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const { user } = await requireRole("carrier");
  const supabase = await createClient();
  const { data } = await supabase.from("payouts").select("id, amount, phone, status, reference, paid_at, created_at, trip_id, kind, b2c_error, trips(ref, price, commission)").eq("carrier_id", user.id).order("created_at", { ascending: false }).limit(200);
  const payouts = (data ?? []) as unknown as { id: string; amount: number; phone: string | null; status: "queued" | "sending" | "paid" | "held"; kind: PayoutKind; b2c_error: string | null; reference: string | null; paid_at: string | null; created_at: string; trip_id: string; trips: { ref: string; price: number; commission: number } | null }[];
  const total = (...statuses: string[]) => payouts.filter((p) => statuses.includes(p.status)).reduce((sum, p) => sum + p.amount, 0);
  return <div className="space-y-6">
    <PageHeader title="Earnings" actions={<a href="/api/reports/csv" className="text-sm font-semibold text-primary">Download statement (CSV)</a>} description="Payouts go to your M-Pesa within 24 hours of the shipper confirming delivery. Tips go 100% to you, and fuel advances are taken off the trip payout." />
    <div className="grid gap-3 sm:grid-cols-3">
      {[["On the way", total("queued", "sending")], ["Paid", total("paid")], ["Held (dispute)", total("held")]].map(([label, value]) => <div key={label as string} className="rounded-lg border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{formatKes(value as number)}</p></div>)}
    </div>
    {payouts.length ? <div className="divide-y rounded-lg border bg-card">{payouts.map((p) => <Link key={p.id} href={`/trips/${p.trip_id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/40">
      <div><p className="font-semibold">{p.trips?.ref}{p.kind !== "trip" ? <span className="ml-2 text-xs font-normal text-muted-foreground">{KIND[p.kind]}</span> : null}</p><p className="text-xs text-muted-foreground">{p.kind === "trip" ? `Trip ${formatKes(p.trips?.price)} − commission ${formatKes(p.trips?.commission)}` : KIND[p.kind]}{p.phone ? ` · to ${displayPhone(p.phone)}` : ""}{p.reference ? ` · ref ${p.reference}` : ""}</p></div>
      <div className="text-right"><p className="font-bold">{formatKes(p.amount)}</p><div className="mt-1">{p.status === "paid" ? <ToneBadge tone="success">Paid {formatDate(p.paid_at)}</ToneBadge> : p.status === "held" ? <ToneBadge tone="danger">Held</ToneBadge> : <ToneBadge tone="info">On the way</ToneBadge>}</div></div>
    </Link>)}</div> : <EmptyState icon={<Wallet className="h-5 w-5" />} title="No payouts yet" description="Finish a trip and your first payout shows here." />}
  </div>;
}
