"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlaceSelect } from "@/components/loads/place-select";
import { selectClass } from "@/components/app/field";
import { quote, TRUCK_TYPES, TRUCK_TYPE_KEYS, type TruckType } from "@/lib/pricing";
import { formatKes } from "@/lib/utils";
import type { PlaceRow } from "@/lib/types";

export function PriceCalculator({ places }: { places: PlaceRow[] }) {
  const [from, setFrom] = useState("mombasa");
  const [to, setTo] = useState("nairobi");
  const [truck, setTruck] = useState<TruckType>("trailer");
  const result = useMemo(() => {
    const a = places.find((p) => p.id === from);
    const b = places.find((p) => p.id === to);
    return a && b && a.id !== b.id ? quote(a, b, truck) : null;
  }, [places, from, to, truck]);
  return <div className="rounded-2xl border bg-card p-5 shadow-paper sm:p-6">
    <p className="text-sm font-semibold uppercase tracking-wide text-primary">Instant guide price</p>
    <div className="mt-4 grid gap-3">
      <label className="text-sm font-medium">From<PlaceSelect id="calc-from" name="from" places={places} value={from} onChange={setFrom} /></label>
      <label className="text-sm font-medium">To<PlaceSelect id="calc-to" name="to" places={places} value={to} onChange={setTo} /></label>
      <label className="text-sm font-medium">Truck<select className={selectClass} value={truck} onChange={(e) => setTruck(e.target.value as TruckType)}>{TRUCK_TYPE_KEYS.map((k) => <option key={k} value={k}>{TRUCK_TYPES[k].label}</option>)}</select></label>
    </div>
    <div className="mt-5 rounded-xl bg-[#151a24] p-4 text-white">
      {result ? <><p className="text-3xl font-extrabold">{formatKes(result.price)}</p><p className="mt-1 text-sm text-white/70">About {result.distanceKm.toLocaleString()} km{result.crossings ? ` · ${result.crossings} border crossing${result.crossings > 1 ? "s" : ""}` : ""}. Real bids are often lower.</p></> : <p className="text-sm text-white/70">Choose two different places.</p>}
    </div>
    <Button asChild className="mt-4 w-full" size="lg"><Link href="/signup">Post this load free</Link></Button>
  </div>;
}
