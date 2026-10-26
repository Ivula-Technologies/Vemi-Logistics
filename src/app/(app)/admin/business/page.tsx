import type { Metadata } from "next";
import Link from "next/link";
import { Flash, PageHeader, EmptyState } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/status-badge";
import { Field, selectClass } from "@/components/app/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { adjustWallet, decideCredit } from "@/app/actions/admin";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { eatToday, formatDate, formatKes } from "@/lib/utils";
import type { BusinessAccount } from "@/lib/types";

export const metadata: Metadata = { title: "Business accounts" };

const TONE = { none: "muted", requested: "warning", approved: "success", declined: "danger", suspended: "danger" } as const;

/** Credit decisions, what each business owes on account, and wallet adjustments (goodwill credit, claim settlements). */
export default async function AdminBusinessPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireRole("admin");
  const query = await searchParams;
  const supabase = await createClient();
  const [{ data: accounts }, { data: owed }, { data: wallet }] = await Promise.all([
    supabase.from("business_accounts").select("*").order("requested_at", { ascending: false, nullsFirst: false }).limit(300),
    supabase.from("trips").select("id, ref, shipper_id, balance, credit_due_on").eq("on_credit", true).gt("balance", 0).neq("status", "cancelled"),
    supabase.from("wallet_entries").select("account_id, amount").limit(10000),
  ]);
  const rows = ((accounts ?? []) as BusinessAccount[]).sort((a, b) => Number(b.credit_status === "requested") - Number(a.credit_status === "requested"));
  const today = eatToday();
  const owedBy = (id: string) => (owed ?? []).filter((t) => t.shipper_id === id);
  const walletOf = (id: string) => (wallet ?? []).filter((w) => w.account_id === id).reduce((s, w) => s + w.amount, 0);
  return <div className="max-w-4xl space-y-6">
    <Flash error={query.error} saved={query.saved} savedText={query.saved ? { [query.saved]: `${query.saved}.` } : undefined} />
    <PageHeader title="Business accounts" description="Approve pay-on-invoice for regular shippers, chase what's overdue, and adjust wallets." />
    {rows.length ? rows.map((b) => {
      const trips = owedBy(b.owner_id);
      const overdue = trips.filter((t) => t.credit_due_on && t.credit_due_on < today);
      return <section key={b.owner_id} className="space-y-3 rounded-lg border bg-card p-5 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="font-semibold">{b.legal_name}</p><p className="text-xs text-muted-foreground">{b.kra_pin ? `KRA ${b.kra_pin} · ` : "No KRA PIN · "}{b.billing_email ?? "no accounts email"} · since {formatDate(b.created_at)}</p></div>
          <ToneBadge tone={TONE[b.credit_status]}>{b.credit_status === "approved" ? `Credit ${formatKes(b.credit_limit)} / ${b.terms_days} days` : b.credit_status}</ToneBadge>
        </div>
        {trips.length ? <p>On account: {formatKes(trips.reduce((s, t) => s + t.balance, 0))} across {trips.length} trip{trips.length > 1 ? "s" : ""}{overdue.length ? <span className="font-semibold text-destructive"> · {overdue.length} overdue ({overdue.map((t) => <Link key={t.id} href={`/trips/${t.id}`} className="underline">{t.ref} </Link>)})</span> : null}</p> : null}
        <p>Wallet: {formatKes(walletOf(b.owner_id))}</p>
        <details open={b.credit_status === "requested"}><summary className="cursor-pointer font-semibold">Credit decision</summary>
          <form action={decideCredit} className="mt-2 grid gap-2 sm:grid-cols-4 sm:items-end"><input type="hidden" name="ownerId" value={b.owner_id} />
            <Field label="Decision" htmlFor={`s-${b.owner_id}`}><select id={`s-${b.owner_id}`} name="status" className={selectClass} defaultValue={b.credit_status === "requested" ? "approved" : b.credit_status}><option value="approved">Approve</option><option value="declined">Decline</option><option value="suspended">Suspend</option></select></Field>
            <Field label="Limit (KES)" htmlFor={`l-${b.owner_id}`}><Input id={`l-${b.owner_id}`} name="limit" type="number" min="0" defaultValue={b.credit_limit || 200000} /></Field>
            <Field label="Days to pay" htmlFor={`t-${b.owner_id}`}><Input id={`t-${b.owner_id}`} name="terms" type="number" min="7" max="90" defaultValue={b.terms_days} /></Field>
            <SubmitButton size="sm" pendingLabel="…">Save</SubmitButton>
            <Input name="note" placeholder="Note to the shipper (optional)" className="sm:col-span-4" defaultValue={b.credit_note ?? ""} maxLength={500} />
          </form></details>
        <details><summary className="cursor-pointer font-semibold">Adjust wallet</summary>
          <form action={adjustWallet} className="mt-2 grid gap-2 sm:grid-cols-[140px_1fr_auto] sm:items-end"><input type="hidden" name="accountId" value={b.owner_id} />
            <Input name="amount" type="number" placeholder="+500 or -500" required aria-label="Amount" />
            <Input name="reason" placeholder="Reason (the shipper sees it)" required maxLength={200} aria-label="Reason" />
            <SubmitButton size="sm" variant="outline" pendingLabel="…">Adjust</SubmitButton>
          </form></details>
      </section>;
    }) : <EmptyState title="No business accounts yet" />}
  </div>;
}
