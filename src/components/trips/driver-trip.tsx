"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, LoaderCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentPosition } from "@/components/trips/status-buttons";
import type { TripStatus } from "@/lib/trips";

const SHARING: TripStatus[] = ["to_pickup", "loaded", "in_transit", "at_border"];

/** Big buttons for each step, location sharing while the page is open, and the delivery photo. */
export function DriverTrip({ token, status, steps, hasPod }: { token: string; status: string; steps: { status: TripStatus; label: string }[]; hasPod: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<"off" | "on" | "denied">("off");
  const [podDone, setPodDone] = useState(hasPod);
  const fileRef = useRef<HTMLInputElement>(null);
  const live = (SHARING as string[]).includes(status);

  // While the trip is moving, send the position at most once a minute (the server keeps one a minute).
  useEffect(() => {
    if (!live || !navigator.geolocation) return;
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setSharing("on");
        if (Date.now() - last < 60_000) return;
        last = Date.now();
        void fetch(`/api/driver/${token}/ping`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }) }).catch(() => undefined);
      },
      (err) => setSharing(err.code === err.PERMISSION_DENIED ? "denied" : "off"),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [live, token]);

  async function move(next: TripStatus) {
    setBusy(next); setError(null);
    const position = await currentPosition();
    const res = await fetch(`/api/driver/${token}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next, lat: position?.lat, lng: position?.lng }) }).catch(() => null);
    const data = res ? await res.json().catch(() => null) as { error?: string } | null : null;
    setBusy(null);
    if (!res?.ok) { setError(data?.error ?? "No network. Try again in a moment."); return; }
    router.refresh();
  }

  async function upload(file: File) {
    setBusy("pod"); setError(null);
    const form = new FormData(); form.set("file", file);
    const res = await fetch(`/api/driver/${token}/pod`, { method: "POST", body: form }).catch(() => null);
    const data = res ? await res.json().catch(() => null) as { error?: string } | null : null;
    setBusy(null);
    if (!res?.ok) { setError(data?.error ?? "Upload failed. Try again with signal."); return; }
    setPodDone(true);
  }

  return <section className="mt-5 space-y-3">
    {steps.map((step, i) => <Button key={step.status} size="lg" variant={i === steps.length - 1 ? "default" : "outline"} className="h-14 w-full text-base" disabled={Boolean(busy)} onClick={() => move(step.status)}>
      {busy === step.status ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : null}{step.label}
    </Button>)}
    {["in_transit", "at_border", "delivered"].includes(status) ? <div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      <Button size="lg" variant="outline" className="h-14 w-full text-base" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
        {busy === "pod" ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : podDone ? <CheckCircle2 className="mr-2 h-5 w-5 text-emerald-600" /> : <Camera className="mr-2 h-5 w-5" />}
        {podDone ? "Delivery photo sent (tap to replace)" : "Photo of the signed delivery note"}
      </Button>
    </div> : null}
    {status === "delivered" ? <p className="rounded-md bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">Delivered. Safari njema! The shipper now confirms and your boss gets paid.</p> : null}
    {error ? <p role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
    {live ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{sharing === "on" ? "Sharing your location with the shipper while this page is open." : sharing === "denied" ? "Location is off. Allow location for this site so the shipper can follow the trip." : "Keep this page open on the road so the shipper can follow the trip."}</p> : null}
  </section>;
}
