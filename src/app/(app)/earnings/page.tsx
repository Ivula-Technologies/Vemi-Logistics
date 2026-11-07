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
import { getLang } from "@/lib/i18n-server";
import { formatDateIn, translator, type MessageKey } from "@/lib/i18n";


export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const [{ user }, lang] = await Promise.all([requireRole("carrier"), getLang()]);
  const tr = translator(lang);
  const kind = (k: PayoutKind) => tr(`earn.kind.${k}` as MessageKey);
  const supabase = await createClient();
  const { data } = await supabase.from("payouts").select("id, amount, phone, status, reference, paid_at, created_at, trip_id, kind, b2c_error, trips(ref, price, commission)").eq("carrier_id", user.id).order("created_at", { ascending: false }).limit(200);
  const payouts = (data ?? []) as unknown as { id: string; amount: number; phone: string | null; status: "queued" | "sending" | "paid" | "held"; kind: PayoutKind; b2c_error: string | null; reference: string | null; paid_at: string | null; created_at: string; trip_id: string; trips: { ref: string; price: number; commission: number } | null }[];
  const total = (...statuses: string[]) => payouts.filter((p) => statuses.includes(p.status)).reduce((sum, p) => sum + p.amount, 0);
  return <div className="space-y-6">
    <PageHeader title={tr("earn.title")} actions={<a href="/api/reports/csv" className="text-sm font-semibold text-primary">{tr("earn.csv")}</a>} description={tr("earn.intro")} />
    <div className="grid gap-3 sm:grid-cols-3">
      {[[tr("earn.onTheWay"), total("queued", "sending")], [tr("earn.paid"), total("paid")], [tr("earn.held"), total("held")]].map(([label, value]) => <div key={label as string} className="rounded-lg border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{formatKes(value as number)}</p></div>)}
    </div>
    {payouts.length ? <div className="divide-y rounded-lg border bg-card">{payouts.map((p) => <Link key={p.id} href={`/trips/${p.trip_id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/40">
      <div><p className="font-semibold">{p.trips?.ref}{p.kind !== "trip" ? <span className="ml-2 text-xs font-normal text-muted-foreground">{kind(p.kind)}</span> : null}</p><p className="text-xs text-muted-foreground">{p.kind === "trip" ? tr("earn.line", { price: formatKes(p.trips?.price), commission: formatKes(p.trips?.commission) }) : kind(p.kind)}{p.phone ? tr("earn.to", { phone: displayPhone(p.phone) }) : ""}{p.reference ? tr("earn.ref", { ref: p.reference }) : ""}</p></div>
      <div className="text-right"><p className="font-bold">{formatKes(p.amount)}</p><div className="mt-1">{p.status === "paid" ? <ToneBadge tone="success">{tr("earn.paidOn", { date: lang === "en" ? formatDate(p.paid_at) : formatDateIn(lang, p.paid_at) })}</ToneBadge> : p.status === "held" ? <ToneBadge tone="danger">{tr("earn.heldShort")}</ToneBadge> : <ToneBadge tone="info">{tr("earn.onTheWay")}</ToneBadge>}</div></div>
    </Link>)}</div> : <EmptyState icon={<Wallet className="h-5 w-5" />} title={tr("earn.none")} description={tr("earn.noneHint")} />}
  </div>;
}
