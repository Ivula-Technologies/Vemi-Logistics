import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { TripStatusBadge } from "@/components/app/status-badge";
import { RouteLine } from "@/components/loads/load-card";
import { formatDate, formatKes } from "@/lib/utils";
import type { Load, PlaceRow, Trip } from "@/lib/types";

const NEXT_FOR: Record<"shipper" | "carrier", Partial<Record<string, string>>> = {
  shipper: { awaiting_payment: "Pay to dispatch the truck", delivered: "Confirm delivery" },
  carrier: { awaiting_payment: "Assign truck and driver while the shipper pays", scheduled: "Dispatch: send the driver to pickup", completed: "Payout queued" },
};

export function TripCard({ trip, places, viewer }: { trip: Trip & { loads: Pick<Load, "origin_id" | "destination_id" | "pickup_date" | "cargo_description"> | null }; places: Map<string, PlaceRow>; viewer: "shipper" | "carrier" | "admin" }) {
  const next = viewer === "admin" ? undefined : NEXT_FOR[viewer][trip.status];
  return <Link href={`/trips/${trip.id}`} className="block rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-secondary/40">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <RouteLine from={places.get(trip.loads?.origin_id ?? "")} to={places.get(trip.loads?.destination_id ?? "")} />
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{trip.ref} · {trip.loads?.cargo_description}</p>
      </div>
      <p className="shrink-0 font-bold">{formatKes(viewer === "carrier" ? trip.carrier_payout : trip.price)}</p>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <TripStatusBadge status={trip.status} />
      <span className="inline-flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-4 w-4" />{formatDate(trip.loads?.pickup_date)}</span>
      {next ? <span className="font-semibold text-primary">{next} →</span> : null}
    </div>
  </Link>;
}
