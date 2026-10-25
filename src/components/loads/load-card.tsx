import Link from "next/link";
import { ArrowRight, CalendarDays, Package, Truck } from "lucide-react";
import { LoadStatusBadge } from "@/components/app/status-badge";
import { TRUCK_TYPES } from "@/lib/pricing";
import { formatDate, formatKes } from "@/lib/utils";
import type { Load, PlaceRow } from "@/lib/types";

export function RouteLine({ from, to, className }: { from?: PlaceRow; to?: PlaceRow; className?: string }) {
  return <p className={className ?? "flex flex-wrap items-center gap-1.5 font-semibold"}><span>{from?.name ?? "?"}</span><ArrowRight className="h-4 w-4 text-primary" /><span>{to?.name ?? "?"}</span></p>;
}

export function LoadCard({ load, places, href, extra, showStatus = true }: { load: Load; places: Map<string, PlaceRow>; href: string; extra?: React.ReactNode; showStatus?: boolean }) {
  return <Link href={href} className="block rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-secondary/40">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <RouteLine from={places.get(load.origin_id)} to={places.get(load.destination_id)} />
        <p className="mt-0.5 text-xs text-muted-foreground">{load.ref} · about {load.distance_km.toLocaleString()} km{load.border_crossings ? ` · ${load.border_crossings} border${load.border_crossings > 1 ? "s" : ""}` : ""}</p>
      </div>
      <div className="text-right"><p className="font-bold">{formatKes(load.price)}</p>{showStatus ? <div className="mt-1"><LoadStatusBadge status={load.status} /></div> : null}</div>
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatDate(load.pickup_date)}</span>
      <span className="inline-flex items-center gap-1.5"><Truck className="h-4 w-4" />{TRUCK_TYPES[load.truck_type]?.short ?? load.truck_type}</span>
      <span className="inline-flex min-w-0 items-center gap-1.5"><Package className="h-4 w-4 shrink-0" /><span className="truncate">{Number(load.weight_tonnes)} t · {load.cargo_description}</span></span>
    </div>
    {extra ? <div className="mt-3">{extra}</div> : null}
  </Link>;
}
