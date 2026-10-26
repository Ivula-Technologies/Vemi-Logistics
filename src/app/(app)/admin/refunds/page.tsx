import type { Metadata } from "next";
import { Download } from "lucide-react";
import { EmptyState, Flash, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { cancelRefund, markRefundsPaid, sendByMpesa } from "@/app/actions/admin";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { b2cConfigured } from "@/lib/mpesa";
import { displayPhone } from "@/lib/phone";
import { formatDate, formatKes } from "@/lib/utils";
import type { Refund } from "@/lib/types";

export const metadata: Metadata = { title: "Wallet cash-outs" };

export default async function AdminRefundsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireRole("admin");
  const query = await searchParams;
  const supabase = await createClient();
  const [{ data: open }, { data: recent }] = await Promise.all([
    supabase.from("refunds").select("id, account_id, amount, phone, status, reference, created_at, paid_at").in("status", ["queued", "sending"]).order("created_at"),
    supabase.from("refunds").select("id, account_id, amount, phone, status, reference, created_at, paid_at").eq("status", "paid").order("paid_at", { ascending: false }).limit(30),
  ]);
  const rows = (open ?? []) as Refund[];
  const ids = [...new Set([...rows, ...((recent ?? []) as Refund[])].map((r) => r.account_id))];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name, company").in("id", ids) : { data: [] };
  const who = (id: string) => { const p = people?.find((x) => x.id === id); return p ? p.company || p.full_name : "Shipper"; };
  const total = rows.filter((r) => r.status === "queued").reduce((s, r) => s + r.amount, 0);
  return <div className="space-y-6">
    <Flash error={query.error} saved={query.saved} savedText={query.saved ? { [query.saved]: `${query.saved}.` } : undefined} />
    <PageHeader title="Wallet cash-outs" description={`${formatKes(total)} to send to shippers' M-Pesa.`} actions={<Button asChild variant="outline"><a href="/api/admin/refunds-csv"><Download className="mr-2 h-4 w-4" />Bulk payment CSV</a></Button>} />
    {rows.length ? <form action={markRefundsPaid} className="space-y-4"><input type="hidden" name="kind" value="refund" />
      <div className="divide-y rounded-lg border bg-card">{rows.map((r) => <div key={r.id} className="flex items-center gap-3 p-4">
        <input type="checkbox" name="refundId" value={r.id} disabled={r.status !== "queued"} defaultChecked={r.status === "queued"} aria-label={`Select ${who(r.account_id)}`} className="h-4 w-4 accent-[hsl(var(--primary))]" />
        <div className="min-w-0 flex-1"><p className="font-semibold">{who(r.account_id)}</p><p className="text-xs text-muted-foreground">{displayPhone(r.phone)} · asked {formatDate(r.created_at)}{r.status === "sending" ? " · sending by M-Pesa" : ""}</p></div>
        <p className="font-bold">{formatKes(r.amount)}</p>
        {r.status === "queued" ? <SubmitButton formAction={cancelRefund} formNoValidate name="cancelId" value={r.id} size="sm" variant="ghost" pendingLabel="…">Return to wallet</SubmitButton> : null}
      </div>)}</div>
      {b2cConfigured() ? <SubmitButton formAction={sendByMpesa} formNoValidate pendingLabel="Sending…">Send ticked by M-Pesa</SubmitButton> : null}
      <div className="flex flex-col gap-2 sm:flex-row"><Input name="reference" placeholder="M-Pesa bulk payment reference" required /><SubmitButton variant="outline" pendingLabel="Saving…">Mark ticked as paid</SubmitButton></div>
    </form> : <EmptyState title="No cash-outs waiting" />}
    {(recent ?? []).length ? <section><h2 className="mb-3 font-semibold">Recently paid</h2><div className="divide-y rounded-lg border bg-card text-sm">{((recent ?? []) as Refund[]).map((r) => <div key={r.id} className="flex justify-between gap-3 p-3"><span>{who(r.account_id)} · ref {r.reference}</span><span className="font-semibold">{formatKes(r.amount)} · {formatDate(r.paid_at)}</span></div>)}</div></section> : null}
  </div>;
}
