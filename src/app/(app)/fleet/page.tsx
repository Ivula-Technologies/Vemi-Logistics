import type { Metadata } from "next";
import Link from "next/link";
import { Truck, UserRound } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/status-badge";
import { DriverForm, TruckForm } from "@/components/carrier/forms";
import { Button } from "@/components/ui/button";
import { toggleFleetItem } from "@/app/actions/carrier";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TRUCK_TYPES } from "@/lib/pricing";
import { displayPhone } from "@/lib/phone";
import type { Driver, Truck as TruckRow } from "@/lib/types";

export const metadata: Metadata = { title: "Fleet" };

export default async function FleetPage() {
  const { user, carrier } = await requireRole("carrier");
  if (!carrier) return <div><PageHeader title="Fleet" /><EmptyState title="Save your business details first" action={<Button asChild><Link href="/profile">Go to profile</Link></Button>} /></div>;
  const supabase = await createClient();
  const [{ data: trucks }, { data: drivers }] = await Promise.all([
    supabase.from("trucks").select("*").eq("carrier_id", user.id).order("created_at"),
    supabase.from("drivers").select("*").eq("carrier_id", user.id).order("created_at"),
  ]);
  return <div className="space-y-8">
    <PageHeader title="Fleet" description="Your trucks decide which loads you see. Drivers get a trip link by SMS or WhatsApp; they don't need an account." />
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-semibold"><Truck className="h-5 w-5 text-primary" />Trucks</h2>
      {(trucks as TruckRow[] ?? []).map((t) => <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div><p className="font-semibold">{t.plate}</p><p className="text-sm text-muted-foreground">{TRUCK_TYPES[t.truck_type]?.label} · {Number(t.capacity_tonnes)} t{t.make_model ? ` · ${t.make_model}` : ""}</p></div>
        <FleetToggle kind="truck" id={t.id} active={t.active} />
      </div>)}
      <div className="rounded-lg border border-dashed p-4"><TruckForm /></div>
    </section>
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-semibold"><UserRound className="h-5 w-5 text-primary" />Drivers</h2>
      {(drivers as Driver[] ?? []).map((d) => <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div><p className="font-semibold">{d.full_name}</p><p className="text-sm text-muted-foreground">{displayPhone(d.phone)}{d.licence_no ? ` · licence ${d.licence_no}` : ""}</p></div>
        <FleetToggle kind="driver" id={d.id} active={d.active} />
      </div>)}
      <div className="rounded-lg border border-dashed p-4"><DriverForm /></div>
    </section>
  </div>;
}

function FleetToggle({ kind, id, active }: { kind: "truck" | "driver"; id: string; active: boolean }) {
  return <form action={toggleFleetItem} className="flex items-center gap-2">
    <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={String(!active)} />
    {active ? <ToneBadge tone="success">Active</ToneBadge> : <ToneBadge tone="muted">Off</ToneBadge>}
    <Button size="sm" variant="ghost">{active ? "Turn off" : "Turn on"}</Button>
  </form>;
}
