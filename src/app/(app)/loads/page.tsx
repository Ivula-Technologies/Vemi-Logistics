import type { Metadata } from "next";
import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { LoadCard } from "@/components/loads/load-card";
import { requireRole } from "@/lib/auth";
import { placeMap } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";
import type { Load } from "@/lib/types";

export const metadata: Metadata = { title: "My loads" };

export default async function LoadsPage() {
  const { accountId } = await requireRole("shipper", "admin");
  const supabase = await createClient();
  const [{ data }, places] = await Promise.all([
    supabase.from("loads").select("*").eq("shipper_id", accountId).order("created_at", { ascending: false }).limit(100),
    placeMap(),
  ]);
  const loads = (data ?? []) as Load[];
  const { data: bids } = await supabase.from("bids").select("load_id").in("load_id", loads.filter((l) => l.status === "open").map((l) => l.id)).eq("status", "pending");
  const counts = new Map<string, number>();
  for (const b of bids ?? []) counts.set(b.load_id, (counts.get(b.load_id) ?? 0) + 1);
  return <div>
    <PageHeader title="My loads" description="Everything you've posted. Open a load to compare bids and book a truck." actions={<Button asChild><Link href="/loads/new"><PackagePlus className="mr-2 h-4 w-4" />Post a load</Link></Button>} />
    {loads.length ? <div className="space-y-3">{loads.map((load) => <LoadCard key={load.id} load={load} places={places} href={`/loads/${load.id}`}
      extra={load.status === "open" ? <p className="text-sm font-medium text-primary">{counts.get(load.id) ? `${counts.get(load.id)} bid${counts.get(load.id)! > 1 ? "s" : ""} to compare` : "Waiting for bids"}</p> : null} />)}</div>
      : <EmptyState icon={<PackagePlus className="h-5 w-5" />} title="No loads yet" description="Post a load in about a minute. You'll see a guide price straight away." action={<Button asChild><Link href="/loads/new">Post a load</Link></Button>} />}
  </div>;
}
