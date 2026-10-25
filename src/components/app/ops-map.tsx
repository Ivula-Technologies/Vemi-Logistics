"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type OpsPin = { lat: number; lng: number; label: string; href?: string; tone: "live" | "alert" | "free" };

const COLOR = { live: "#f26a1b", alert: "#dc2626", free: "#059669" } as const;

/** Every live truck on one map (Vemi ops): orange moving, red SOS or alert, green free trucks. */
export function OpsMap({ pins, className }: { pins: OpsPin[]; className?: string }) {
  const element = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(pins);
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !element.current) return;
      map = L.map(element.current, { scrollWheelZoom: false }).setView([-1.3, 36.8], 6);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);
      for (const pin of pins) {
        const marker = L.circleMarker([pin.lat, pin.lng], { radius: pin.tone === "alert" ? 10 : 7, color: "#fff", weight: 2, fillColor: COLOR[pin.tone], fillOpacity: 1 }).bindTooltip(pin.label).addTo(map);
        if (pin.href) marker.on("click", () => { window.location.href = pin.href!; });
      }
      if (pins.length) map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])).pad(0.2), { maxZoom: 10 });
    })();
    return () => { disposed = true; map?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <div ref={element} className={className} role="application" aria-label="Map of live trucks" />;
}
