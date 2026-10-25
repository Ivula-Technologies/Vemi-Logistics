import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, PackagePlus, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flash, PageHeader, EmptyState } from "@/components/app/page-header";
import { TripCard } from "@/components/trips/trip-card";
import { LoadCard } from "@/components/loads/load-card";
import { InstallAppButton } from "@/components/pwa/install-app";
import { getSession } from "@/lib/auth";
import { placeMap } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";
import { REQUIRED_DOCUMENTS, DOCUMENT_KINDS, TRIP_COLUMNS } from "@/lib/trips";
import { formatKes } from "@/lib/utils";
import type { Load, Trip } from "@/lib/types";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ joined?: string }> }) {
  const [{ user, profile, carrier, accountId }, query] = await Promise.all([getSession(), searchParams]);
  if (!profile.onboarded && profile.role !== "admin") redirect("/welcome");
  if (profile.role === "admin") redirect("/admin");
  const supabase = await createClient();
  const places = await placeMap();
  const firstName = profile.full_name.split(" ")[0] || "there";

  const { data: activeTrips } = await supabase.from("trips").select(`${TRIP_COLUMNS}, loads(origin_id, destination_id, pickup_date, cargo_description)`)
    .eq(profile.role === "carrier" ? "carrier_id" : "shipper_id", profile.role === "carrier" ? user.id : accountId).not("status", "in", "(completed,cancelled)").order("created_at", { ascending: false }).limit(10);
  const trips = (activeTrips ?? []) as unknown as (Trip & { loads: Pick<Load, "origin_id" | "destination_id" | "pickup_date" | "cargo_description"> })[];

  if (profile.role === "carrier") {
    const [{ data: docs }, { count: trucks }, { count: drivers }, { data: openLoads }, { data: payouts }] = await Promise.all([
      supabase.from("carrier_documents").select("kind").eq("carrier_id", user.id),
      supabase.from("trucks").select("id", { count: "exact", head: true }).eq("carrier_id", user.id),
      supabase.from("drivers").select("id", { count: "exact", head: true }).eq("carrier_id", user.id),
      carrier?.status === "verified" ? supabase.from("loads").select("*").eq("status", "open").order("pickup_date").limit(3) : Promise.resolve({ data: [] }),
      supabase.from("payouts").select("amount, status").eq("carrier_id", user.id),
    ]);
    const have = new Set((docs ?? []).map((d) => d.kind));
    const missingDocs = REQUIRED_DOCUMENTS.filter((kind) => !have.has(kind));
    const steps = [
      { done: Boolean(carrier), label: "Business details and M-Pesa payout number", href: "/profile" },
      { done: (trucks ?? 0) > 0, label: "Add at least one truck", href: "/fleet" },
      { done: (drivers ?? 0) > 0, label: "Add a driver (you can add yourself)", href: "/fleet" },
      { done: missingDocs.length === 0, label: missingDocs.length ? `Upload documents: ${missingDocs.map((k) => DOCUMENT_KINDS[k]).join(", ")}` : "Documents uploaded", href: "/profile#documents" },
    ];
    const queued = (payouts ?? []).filter((p) => p.status === "queued").reduce((sum, p) => sum + p.amount, 0);
    const paid = (payouts ?? []).filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
    return <div className="space-y-8">
      <PageHeader title={`Habari, ${firstName}`} description={carrier?.status === "verified" ? "Find your next load and keep your trucks moving." : "Finish setting up so we can verify you and you can start bidding."}
        actions={carrier?.status === "verified" ? <Button asChild><Link href="/board"><Search className="mr-2 h-4 w-4" />Find loads</Link></Button> : null} />
      {carrier?.status !== "verified" ? <section className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="font-semibold">{carrier?.status === "rejected" ? "Verification needs changes" : carrier?.status === "suspended" ? "Account suspended" : "Get verified"}</h2></div>
        {carrier?.review_note ? <p className="mt-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm">Note from Vemi: {carrier.review_note}</p> : null}
        <ol className="mt-4 space-y-2">{steps.map((step) => <li key={step.label}><Link href={step.href} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-secondary">{step.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <span className="h-5 w-5 shrink-0 rounded-full border-2" />}<span className={step.done ? "text-muted-foreground line-through" : "font-medium"}>{step.label}</span></Link></li>)}</ol>
        <p className="mt-3 text-sm text-muted-foreground">{steps.every((s) => s.done) ? "All done. Vemi checks documents within one working day and texts you when you're verified." : "Vemi checks documents within one working day of the last upload."}</p>
      </section> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active trips" value={String(trips.length)} />
        <Stat label="Payouts on the way" value={formatKes(queued)} />
        <Stat label="Paid to you so far" value={formatKes(paid)} />
      </div>
      <section><h2 className="mb-3 font-semibold">Your trips</h2>{trips.length ? <div className="space-y-3">{trips.map((t) => <TripCard key={t.id} trip={t} places={places} viewer="carrier" />)}</div> : <EmptyState title="No active trips" description="Trips you win appear here, with the next step for each." />}</section>
      {(openLoads ?? []).length ? <section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Newest loads</h2><Link href="/board" className="text-sm font-semibold text-primary">See all</Link></div><div className="space-y-3">{(openLoads as Load[]).map((l) => <LoadCard key={l.id} load={l} places={places} href={`/board/${l.id}`} showStatus={false} />)}</div></section> : null}
      <InstallAppButton label="Install the Vemi app on this phone" />
    </div>;
  }

  const { data: loads } = await supabase.from("loads").select("*").eq("shipper_id", accountId).eq("status", "open").order("created_at", { ascending: false }).limit(5);
  const { data: bidCounts } = await supabase.from("bids").select("load_id").in("load_id", (loads ?? []).map((l) => l.id)).eq("status", "pending");
  const counts = new Map<string, number>();
  for (const b of bidCounts ?? []) counts.set(b.load_id, (counts.get(b.load_id) ?? 0) + 1);
  const unpaid = trips.filter((t) => t.status === "awaiting_payment");
  const toConfirm = trips.filter((t) => t.status === "delivered");
  const { data: wallet } = await supabase.rpc("wallet_balance");
  return <div className="space-y-8">
    {query.joined ? <Flash saved="joined" savedText={{ joined: "You've joined the team. Loads and trips you book now go on the business account." }} /> : null}
    <PageHeader title={`Habari, ${firstName}`} description="Move goods with verified trucks across East Africa." actions={<Button asChild><Link href="/loads/new"><PackagePlus className="mr-2 h-4 w-4" />Post a load</Link></Button>} />
    {[...unpaid, ...toConfirm].map((t) => <Link key={t.id} href={`/trips/${t.id}`} className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" /><span><strong>{t.ref}</strong>: {t.status === "awaiting_payment" ? `pay ${formatKes(t.balance)} so the truck can be dispatched.` : "the driver says it's delivered. Confirm or tell us what's wrong."}</span></Link>)}
    {(wallet as number | null) ? <Link href="/wallet" className="flex items-center justify-between rounded-lg border bg-card p-4 text-sm hover:border-primary/50"><span>Vemi wallet credit, ready to use on your next trip</span><strong>{formatKes(wallet as number)}</strong></Link> : null}
    <section><h2 className="mb-3 font-semibold">Trips in progress</h2>{trips.length ? <div className="space-y-3">{trips.map((t) => <TripCard key={t.id} trip={t} places={places} viewer="shipper" />)}</div> : <EmptyState icon={<PackagePlus className="h-5 w-5" />} title="Nothing on the road yet" description="Post a load. Verified trucks bid within hours, and you pick the one you want." action={<Button asChild><Link href="/loads/new">Post your first load</Link></Button>} />}</section>
    {(loads ?? []).length ? <section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Open loads</h2><Link href="/loads" className="text-sm font-semibold text-primary">All loads</Link></div><div className="space-y-3">{(loads as Load[]).map((l) => <LoadCard key={l.id} load={l} places={places} href={`/loads/${l.id}`} extra={<p className="text-sm font-medium text-primary">{counts.get(l.id) ? `${counts.get(l.id)} bid${counts.get(l.id)! > 1 ? "s" : ""} waiting` : "Waiting for bids"}</p>} />)}</div></section> : null}
    <InstallAppButton label="Install the Vemi app on this phone" />
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}
