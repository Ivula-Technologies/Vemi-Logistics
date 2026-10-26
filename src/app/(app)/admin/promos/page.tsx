import type { Metadata } from "next";
import { Flash, PageHeader } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/status-badge";
import { Field, selectClass } from "@/components/app/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { savePromo } from "@/app/actions/admin";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatKes } from "@/lib/utils";
import type { PromoCode } from "@/lib/types";

export const metadata: Metadata = { title: "Promo codes" };

export default async function AdminPromosPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; edit?: string }> }) {
  await requireRole("admin");
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
  const promos = (data ?? []) as PromoCode[];
  const edit = promos.find((p) => p.code === query.edit);
  return <div className="max-w-4xl space-y-6">
    <Flash error={query.error} saved={query.saved} savedText={query.saved ? { [query.saved]: `${query.saved}.` } : undefined} />
    <PageHeader title="Promo codes" description="Shippers enter a code on the payment screen. Vemi pays the discount; the carrier's payout doesn't change." />
    <form action={savePromo} className="grid gap-3 rounded-lg border bg-card p-5 sm:grid-cols-3">
      <h2 className="font-semibold sm:col-span-3">{edit ? `Edit ${edit.code}` : "New code"}</h2>
      <Field label="Code" htmlFor="code"><Input id="code" name="code" defaultValue={edit?.code} required className="uppercase" readOnly={Boolean(edit)} /></Field>
      <Field label="Type" htmlFor="kind"><select id="kind" name="kind" className={selectClass} defaultValue={edit?.kind ?? "amount"}><option value="amount">KES off</option><option value="percent">% off</option></select></Field>
      <Field label="Value" htmlFor="value"><Input id="value" name="value" type="number" min="1" defaultValue={edit?.value} required /></Field>
      <Field label="Most off (KES, % codes)" htmlFor="maxDiscount"><Input id="maxDiscount" name="maxDiscount" type="number" min="1" defaultValue={edit?.max_discount_kes ?? ""} /></Field>
      <Field label="Uses allowed" htmlFor="maxUses"><Input id="maxUses" name="maxUses" type="number" min="1" defaultValue={edit?.max_uses ?? ""} placeholder="No limit" /></Field>
      <Field label="Minimum trip price (KES)" htmlFor="minPrice"><Input id="minPrice" name="minPrice" type="number" min="0" defaultValue={edit?.min_price_kes ?? 0} /></Field>
      <Field label="Expires" htmlFor="expiresOn"><Input id="expiresOn" name="expiresOn" type="date" defaultValue={edit?.expires_at?.slice(0, 10) ?? ""} /></Field>
      <Field label="Description (shown to shippers)" htmlFor="description" className="sm:col-span-2"><Input id="description" name="description" defaultValue={edit?.description ?? ""} maxLength={200} /></Field>
      <div className="flex flex-wrap gap-4 text-sm sm:col-span-3">
        <label className="flex items-center gap-2"><input type="checkbox" name="firstTripOnly" defaultChecked={edit?.first_trip_only ?? false} />First trip only</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={edit?.active ?? true} />Active</label>
      </div>
      <div><SubmitButton pendingLabel="Saving…">Save code</SubmitButton></div>
    </form>
    <div className="divide-y rounded-lg border bg-card text-sm">{promos.map((p) => <a key={p.code} href={`?edit=${p.code}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-secondary/40">
      <div><p className="font-mono font-bold">{p.code}</p><p className="text-xs text-muted-foreground">{p.kind === "percent" ? `${p.value}% off${p.max_discount_kes ? `, up to ${formatKes(p.max_discount_kes)}` : ""}` : `${formatKes(p.value)} off`}{p.first_trip_only ? " · first trip" : ""}{p.min_price_kes ? ` · trips over ${formatKes(p.min_price_kes)}` : ""}{p.expires_at ? ` · until ${formatDate(p.expires_at)}` : ""}</p></div>
      <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{p.uses}{p.max_uses ? ` / ${p.max_uses}` : ""} used</span>{p.active ? <ToneBadge tone="success">Active</ToneBadge> : <ToneBadge tone="muted">Off</ToneBadge>}</div>
    </a>)}</div>
  </div>;
}
