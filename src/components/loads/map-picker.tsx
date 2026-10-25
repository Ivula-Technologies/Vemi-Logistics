"use client";
import { useEffect, useRef, useState } from "react";
import { Crosshair, MapPin, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { currentPosition } from "@/components/trips/status-buttons";

type Point = { lat: number; lng: number };

/**
 * Drop a pin on the exact gate or yard, or use the phone's location. The pin goes into hidden lat/lng
 * fields; distance and the driver's directions use it instead of the town centre.
 */
export function MapPicker({ name, center, value, onChange, label }: { name: string; center: Point | null; value: Point | null; onChange: (point: Point | null) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  const marker = useRef<import("leaflet").CircleMarker | null>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open || !center) return;
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !element.current) return;
      const start = value ?? center;
      map.current = L.map(element.current, { scrollWheelZoom: false }).setView([start.lat, start.lng], value ? 15 : 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map.current);
      const place = (p: Point) => {
        if (marker.current) marker.current.setLatLng([p.lat, p.lng]);
        else marker.current = L.circleMarker([p.lat, p.lng], { radius: 10, color: "#fff", weight: 3, fillColor: "#f26a1b", fillOpacity: 1 }).addTo(map.current!);
      };
      if (value) place(value);
      map.current.on("click", (event) => { const p = { lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) }; place(p); onChange(p); });
    })();
    return () => { disposed = true; map.current?.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, center?.lat, center?.lng]);

  // Removing the pin also clears it from the map.
  useEffect(() => { if (!value && marker.current) { marker.current.remove(); marker.current = null; } }, [value]);

  async function useMyLocation() {
    setLocating(true);
    const position = await currentPosition(8000);
    setLocating(false);
    if (!position) return;
    const p = { lat: Number(position.lat.toFixed(6)), lng: Number(position.lng.toFixed(6)) };
    onChange(p);
    map.current?.setView([p.lat, p.lng], 16);
    marker.current?.setLatLng([p.lat, p.lng]);
    if (!open) setOpen(true);
  }

  return <div className="space-y-2">
    <input type="hidden" name={`${name}Lat`} value={value?.lat ?? ""} />
    <input type="hidden" name={`${name}Lng`} value={value?.lng ?? ""} />
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)} disabled={!center}><MapPin className="mr-1.5 h-4 w-4" />{value ? "Move the pin" : label}</Button>
      <Button type="button" size="sm" variant="ghost" onClick={useMyLocation} disabled={locating}><Crosshair className="mr-1.5 h-4 w-4" />{locating ? "Finding you…" : "I'm there now"}</Button>
      {value ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">Pinned<button type="button" aria-label="Remove pin" onClick={() => onChange(null)}><X className="h-3.5 w-3.5" /></button></span> : null}
    </div>
    {open && center ? <div ref={element} className="h-56 w-full rounded-md border" role="application" aria-label="Tap the map to drop a pin" /> : null}
  </div>;
}
