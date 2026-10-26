"use client";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Step } from "@/lib/trips";

/** Reads the phone's position (if allowed) so each step is pinned on the map. Never blocks on it. */
export function currentPosition(timeoutMs = 6000): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => { window.clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); },
      () => { window.clearTimeout(timer); resolve(null); },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

/**
 * Carrier screen: server-action form per step, with the position added just before it posts.
 * Loading and delivering ask for the 4-digit code from the people at each end (when the load uses codes).
 */
export function CarrierStatusButtons({ tripId, steps, action, requireCodes = false }: { tripId: string; steps: Step[]; action: (formData: FormData) => Promise<void>; requireCodes?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  return <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
    {steps.map((step, index) => <form key={step.status} action={action} onSubmit={async (event) => {
      if (busy) { event.preventDefault(); return; }
      const form = event.currentTarget;
      if (form.dataset.located) return;
      event.preventDefault();
      setBusy(step.status);
      const position = await currentPosition();
      if (position) { (form.elements.namedItem("lat") as HTMLInputElement).value = String(position.lat); (form.elements.namedItem("lng") as HTMLInputElement).value = String(position.lng); }
      form.dataset.located = "1";
      form.requestSubmit();
    }}>
      <input type="hidden" name="tripId" value={tripId} /><input type="hidden" name="status" value={step.status} /><input type="hidden" name="lat" /><input type="hidden" name="lng" />
      {requireCodes && step.needsCode ? <Input name="code" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required={step.needsCode === "pickup"} aria-label={step.needsCode === "pickup" ? "Pickup code" : "Delivery code"}
        placeholder={step.needsCode === "pickup" ? "Pickup code" : "Delivery code (or photo)"} className="mb-2 w-full sm:w-44" /> : null}
      <Button type="submit" variant={index === steps.length - 1 ? "default" : "outline"} className="w-full sm:w-auto" disabled={Boolean(busy)}>{busy === step.status ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}{step.label}</Button>
    </form>)}
  </div>;
}
