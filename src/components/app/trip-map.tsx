"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type Point = { lat: number; lng: number };

/** OpenStreetMap with the route ends, the path so far and the truck's last position. */
export function TripMap({ origin, destination, path, stops = [], className }: { origin: Point & { name: string }; destination: Point & { name: string }; path: Point[]; stops?: (Point & { name: string; done?: boolean })[]; className?: string }) {
  const element = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([origin, destination, path, stops]);
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !element.current) return;
      map = L.map(element.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);
      const end = (point: Point, label: string, color: string) => L.circleMarker([point.lat, point.lng], { radius: 8, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }).bindTooltip(label).addTo(map!);
      end(origin, `Pickup: ${origin.name}`, "#151a24");
      end(destination, `Drop-off: ${destination.name}`, "#16a34a");
      stops.forEach((stop, i) => end(stop, `Stop ${i + 1}: ${stop.name}${stop.done ? " (done)" : ""}`, stop.done ? "#94a3b8" : "#f59e0b"));
      const route = [origin, ...stops, destination].map((p) => [p.lat, p.lng] as [number, number]);
      L.polyline(route, { color: "#94a3b8", weight: 2, dashArray: "6 8" }).addTo(map);
      const bounds = L.latLngBounds(route);
      if (path.length) {
        L.polyline(path.map((p) => [p.lat, p.lng] as [number, number]), { color: "#f26a1b", weight: 4 }).addTo(map);
        const last = path[path.length - 1];
        L.circleMarker([last.lat, last.lng], { radius: 10, color: "#fff", weight: 3, fillColor: "#f26a1b", fillOpacity: 1 }).bindTooltip("Truck (last position)", { permanent: false }).addTo(map);
        path.forEach((p) => bounds.extend([p.lat, p.lng]));
      }
      map.fitBounds(bounds, { padding: [28, 28] });
    })();
    return () => { disposed = true; map?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <div ref={element} className={className ?? "h-72 w-full border"} role="img" aria-label={`Map from ${origin.name} to ${destination.name}`} />;
}
