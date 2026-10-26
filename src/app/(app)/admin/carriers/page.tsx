import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/status-badge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Carrier } from "@/lib/types";

export const metadata: Metadata = { title: "Carriers" };
const TABS = ["pending", "verified", "rejected", "suspended"] as const;
const TONE = { pending: "warning", verified: "success", rejected: "danger", suspended: "danger" } as const;

export default async function AdminCarriersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("admin");
  const { status: raw } = await searchParams;
  const status = TABS.includes(raw as (typeof TABS)[number]) ? raw as (typeof TABS)[number] : "pending";
  const supabase = await createClient();
  const { data } = await supabase.from("carriers").select("*").eq("status", status).order("created_at", { ascending: status === "pending" }).limit(200);
  const carriers = (data ?? []) as Carrier[];
  const { data: docs } = await supabase.from("carrier_documents").select("carrier_id").in("carrier_id", carriers.map((c) => c.id));
  const docCount = new Map<string, number>();
  for (const d of docs ?? []) docCount.set(d.carrier_id, (docCount.get(d.carrier_id) ?? 0) + 1);
  return <div>
    <PageHeader title="Carriers" />
    <nav className="mb-4 flex gap-2 overflow-x-auto scrollbar-none">{TABS.map((t) => <Link key={t} href={`/admin/carriers?status=${t}`} className={`rounded-full border px-3 py-1 text-sm capitalize ${t === status ? "border-primary bg-signal-soft font-semibold" : ""}`}>{t}</Link>)}</nav>
    {carriers.length ? <div className="divide-y rounded-lg border bg-card">{carriers.map((c) => <Link key={c.id} href={`/admin/carriers/${c.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/40">
      <div><p className="font-semibold">{c.business_name}</p><p className="text-xs text-muted-foreground">{c.base_town ?? "?"} · joined {formatDate(c.created_at)} · {docCount.get(c.id) ?? 0} documents</p></div>
      <ToneBadge tone={TONE[c.status]}>{c.status}</ToneBadge>
    </Link>)}</div> : <EmptyState title={`No ${status} carriers`} />}
  </div>;
}
