import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { EmptyState, Flash, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { markPayoutsPaid } from "@/app/actions/admin";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { displayPhone } from "@/lib/phone";
import { formatDate, formatKes } from "@/lib/utils";

export const metadata: Metadata = { title: "Payouts" };

type Row = { id: string; amount: number; phone: string | null; status: string; reference: string | null; paid_at: string | null; created_at: string; trip_id: string; trips: { ref: string } | null; carriers: { business_name: string } | null };

export default async function AdminPayoutsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireRole("admin");
  const query = await searchParams;
  const supabase = await createClient();
  const select = "id, amount, phone, status, reference, paid_at, created_at, trip_id, trips(ref), carriers(business_name)";
  const [{ data: queued }, { data: recent }] = await Promise.all([
    supabase.from("payouts").select(select).in("status", ["queued", "held"]).order("created_at"),
    supabase.from("payouts").select(select).eq("status", "paid").order("paid_at", { ascending: false }).limit(50),
  ]);
  const rows = (queued ?? []) as unknown as Row[];
  const total = rows.filter((r) => r.status === "queued").reduce((s, r) => s + r.amount, 0);
  return <div className="space-y-6">
    <Flash error={query.error} saved={query.saved} savedText={query.saved ? { [query.saved]: `Done: ${query.saved}.` } : undefined} />
    <PageHeader title="Payouts" description={`${formatKes(total)} to send. Download the bulk file for the M-Pesa org portal, pay, then tick and mark them paid with the batch reference.`}
      actions={<Button asChild variant="outline"><a href="/api/admin/payouts-csv"><Download className="mr-2 h-4 w-4" />Bulk payment CSV</a></Button>} />
    {rows.length ? <form action={markPayoutsPaid} className="space-y-4">
      <div className="divide-y rounded-lg border bg-card">{rows.map((r) => <label key={r.id} className="flex items-center gap-3 p-4">
        <input type="checkbox" name="payoutId" value={r.id} disabled={r.status !== "queued" || !r.phone} defaultChecked={r.status === "queued" && Boolean(r.phone)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
        <div className="min-w-0 flex-1"><p className="font-semibold">{r.carriers?.business_name} · <Link href={`/trips/${r.trip_id}`} className="text-primary">{r.trips?.ref}</Link></p><p className="text-xs text-muted-foreground">{r.phone ? displayPhone(r.phone) : "No payout number: ask the carrier to add one"} · queued {formatDate(r.created_at)}{r.status === "held" ? " · HELD (dispute)" : ""}</p></div>
        <p className="font-bold">{formatKes(r.amount)}</p>
      </label>)}</div>
      <div className="flex flex-col gap-2 sm:flex-row"><Input name="reference" placeholder="M-Pesa bulk payment reference" required /><SubmitButton pendingLabel="Saving…">Mark ticked as paid</SubmitButton></div>
    </form> : <EmptyState title="Nothing to pay right now" />}
    {(recent ?? []).length ? <section><h2 className="mb-3 font-semibold">Recently paid</h2><div className="divide-y rounded-lg border bg-card text-sm">{(recent as unknown as Row[]).map((r) => <div key={r.id} className="flex justify-between gap-3 p-3"><span>{r.carriers?.business_name} · {r.trips?.ref} · ref {r.reference}</span><span className="font-semibold">{formatKes(r.amount)} · {formatDate(r.paid_at)}</span></div>)}</div></section> : null}
  </div>;
}
