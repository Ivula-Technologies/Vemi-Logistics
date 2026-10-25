import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Flash, PageHeader } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/status-badge";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { reviewCarrier } from "@/app/actions/admin";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_KINDS, REQUIRED_DOCUMENTS } from "@/lib/trips";
import { COUNTRY_NAMES, TRUCK_TYPES } from "@/lib/pricing";
import { displayPhone } from "@/lib/phone";
import { formatDate } from "@/lib/utils";
import type { Carrier, CarrierPrivate, Driver, Profile, Truck } from "@/lib/types";

export const metadata: Metadata = { title: "Carrier" };

export default async function AdminCarrierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireRole("admin");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: carrier }, { data: details }, { data: profile }, { data: docs }, { data: trucks }, { data: drivers }, { count: trips }] = await Promise.all([
    supabase.from("carriers").select("*").eq("id", id).maybeSingle(),
    supabase.from("carrier_private").select("*").eq("carrier_id", id).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("carrier_documents").select("id, kind, file_name, expires_on, created_at").eq("carrier_id", id).order("kind"),
    supabase.from("trucks").select("*").eq("carrier_id", id),
    supabase.from("drivers").select("*").eq("carrier_id", id),
    supabase.from("trips").select("id", { count: "exact", head: true }).eq("carrier_id", id),
  ]);
  if (!carrier) notFound();
  const c = carrier as Carrier;
  const p = details as CarrierPrivate | null;
  const owner = profile as Profile | null;
  const have = new Set((docs ?? []).map((d) => d.kind));
  return <div className="max-w-4xl space-y-6">
    <Flash error={query.error} saved={query.saved} />
    <PageHeader title={c.business_name} description={<span className="inline-flex items-center gap-2"><ToneBadge tone={c.status === "verified" ? "success" : c.status === "pending" ? "warning" : "danger"}>{c.status}</ToneBadge>{trips ?? 0} trips · joined {formatDate(c.created_at)}</span>} />
    <section className="grid gap-4 rounded-lg border bg-card p-5 text-sm sm:grid-cols-2">
      <p><span className="text-muted-foreground">Owner:</span> {owner?.full_name} · {displayPhone(owner?.phone)}</p>
      <p><span className="text-muted-foreground">Based in:</span> {c.base_town ?? "?"}</p>
      <p><span className="text-muted-foreground">KRA PIN:</span> {p?.kra_pin ?? "missing"}</p>
      <p><span className="text-muted-foreground">ID:</span> {p?.id_number ?? "missing"}</p>
      <p><span className="text-muted-foreground">Payout M-Pesa:</span> {displayPhone(p?.payout_phone) || "missing"} ({p?.payout_name ?? "no name"})</p>
      <p><span className="text-muted-foreground">Countries:</span> {c.countries.map((x) => COUNTRY_NAMES[x] ?? x).join(", ")}{c.cross_border ? " (has cross-border permits)" : ""}</p>
    </section>
    <section className="rounded-lg border bg-card p-5 text-sm">
      <h2 className="mb-3 font-semibold">Documents</h2>
      <p className="mb-3">Required: {REQUIRED_DOCUMENTS.map((k) => <span key={k} className="mr-2 inline-block">{have.has(k) ? "✓" : "✗"} {DOCUMENT_KINDS[k]}</span>)}</p>
      <ul className="divide-y rounded-md border">{(docs ?? []).map((d) => <li key={d.id} className="flex justify-between gap-2 px-3 py-2"><a className="font-medium text-primary underline-offset-4 hover:underline" href={`/api/files/doc/${d.id}`} target="_blank" rel="noreferrer">{DOCUMENT_KINDS[d.kind as keyof typeof DOCUMENT_KINDS]}: {d.file_name}</a><span className="text-muted-foreground">{d.expires_on ? `expires ${formatDate(d.expires_on)}` : formatDate(d.created_at)}</span></li>)}</ul>
    </section>
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border bg-card p-5 text-sm"><h2 className="mb-2 font-semibold">Trucks</h2>{((trucks ?? []) as Truck[]).map((t) => <p key={t.id}>{t.plate} · {TRUCK_TYPES[t.truck_type]?.short} · {Number(t.capacity_tonnes)} t{t.active ? "" : " (off)"}</p>)}</div>
      <div className="rounded-lg border bg-card p-5 text-sm"><h2 className="mb-2 font-semibold">Drivers</h2>{((drivers ?? []) as Driver[]).map((d) => <p key={d.id}>{d.full_name} · {displayPhone(d.phone)}{d.licence_no ? ` · ${d.licence_no}` : ""}</p>)}</div>
    </section>
    <form action={reviewCarrier} className="space-y-3 rounded-lg border border-primary/30 bg-card p-5">
      <input type="hidden" name="carrierId" value={c.id} />
      <h2 className="font-semibold">Decision</h2>
      <p className="text-sm text-muted-foreground">Check the ID and KRA PIN match the owner, the logbook matches a truck plate, and inspection and goods-in-transit cover are in date. Call the owner if anything is unclear.</p>
      <Input name="note" placeholder="Note to the carrier (required when asking for changes)" defaultValue={c.review_note ?? ""} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="status" value="verified" pendingLabel="…">Verify</SubmitButton>
        <SubmitButton name="status" value="rejected" variant="outline" pendingLabel="…">Ask for changes</SubmitButton>
        <SubmitButton name="status" value="suspended" variant="destructive" pendingLabel="…">Suspend</SubmitButton>
      </div>
    </form>
  </div>;
}
