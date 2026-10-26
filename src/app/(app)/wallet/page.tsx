import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/status-badge";
import { CashoutForm } from "@/components/app/cashout-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { displayPhone } from "@/lib/phone";
import { formatDate, formatDateTime, formatKes } from "@/lib/utils";
import type { Refund, WalletEntry } from "@/lib/types";

export const metadata: Metadata = { title: "Wallet" };

const KIND: Record<string, string> = { referral: "Referral", cancellation: "Refund", claim: "Claim settled", used: "Paid a trip", cashout: "Cash-out", cashout_reversed: "Cash-out returned", admin: "Vemi adjustment" };

/** Vemi credit: refunds from cancellations and claims, referral rewards. Spend it on trips or cash it out to M-Pesa. */
export default async function WalletPage() {
  const { profile, accountAdmin } = await requireRole("shipper");
  const supabase = await createClient();
  const [{ data: balance }, { data: entries }, { data: refunds }] = await Promise.all([
    supabase.rpc("wallet_balance"),
    supabase.from("wallet_entries").select("id, amount, kind, reason, trip_id, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("refunds").select("id, amount, phone, status, reference, created_at, paid_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const total = (balance as number | null) ?? 0;
  const rows = (entries ?? []) as WalletEntry[];
  const cashouts = (refunds ?? []) as Refund[];
  return <div className="max-w-3xl space-y-6">
    <PageHeader title="Vemi wallet" description="Refunds, claim payments and referral rewards land here. Use the credit on your next trip, or cash it out to M-Pesa." />
    <section className="rounded-lg border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
      <p className="text-3xl font-bold">{formatKes(total)}</p>
      <p className="mt-1 text-sm text-muted-foreground">Pay with it on any trip&apos;s payment screen. It never expires.</p>
      {total >= 100 && accountAdmin ? <div className="mt-4 border-t pt-4"><p className="mb-2 text-sm font-semibold">Cash out to M-Pesa</p><CashoutForm balance={total} defaultPhone={displayPhone(profile.phone)} /></div> : null}
      {!accountAdmin ? <p className="mt-3 text-xs text-muted-foreground">Only the account owner or a team admin can cash out.</p> : null}
    </section>
    {cashouts.length ? <section><h2 className="mb-2 font-semibold">Cash-outs</h2><div className="divide-y rounded-lg border bg-card text-sm">{cashouts.map((r) => <div key={r.id} className="flex items-center justify-between gap-3 p-3">
      <div><p className="font-medium">{formatKes(r.amount)} to {displayPhone(r.phone)}</p><p className="text-xs text-muted-foreground">Asked {formatDate(r.created_at)}{r.reference ? ` · ref ${r.reference}` : ""}</p></div>
      {r.status === "paid" ? <ToneBadge tone="success">Sent {formatDate(r.paid_at)}</ToneBadge> : r.status === "cancelled" ? <ToneBadge tone="muted">Returned to wallet</ToneBadge> : <ToneBadge tone="info">On the way</ToneBadge>}
    </div>)}</div></section> : null}
    <section><h2 className="mb-2 font-semibold">History</h2>
      {rows.length ? <div className="divide-y rounded-lg border bg-card text-sm">{rows.map((e) => <div key={e.id} className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0"><p className="font-medium">{KIND[e.kind] ?? e.kind}</p><p className="truncate text-xs text-muted-foreground">{e.reason} · {formatDateTime(e.created_at)}{e.trip_id ? <> · <Link className="text-primary underline" href={`/trips/${e.trip_id}`}>trip</Link></> : null}</p></div>
        <p className={`shrink-0 font-semibold ${e.amount > 0 ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{e.amount > 0 ? "+" : "−"}{formatKes(Math.abs(e.amount))}</p>
      </div>)}</div> : <EmptyState icon={<Wallet className="h-5 w-5" />} title="Nothing here yet" description="Invite another business with your referral code on the Account page and you both get credit." action={<Link className="text-sm font-semibold text-primary" href="/profile#refer">Get my code</Link>} />}
    </section>
  </div>;
}
