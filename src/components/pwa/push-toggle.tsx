"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Turns on push notifications for this phone (bids, bookings, payments, trip updates and chat). */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<"loading" | "unsupported" | "off" | "on" | "denied">("loading");
  const [busy, setBusy] = useState(false);

  // What this browser supports and whether it is already subscribed, checked once it has loaded.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: typeof state;
      if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else next = await navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((sub) => (sub ? "on" as const : "off" as const)).catch(() => "off" as const);
      if (!cancelled) setState(next);
    })();
    return () => { cancelled = true; };
  }, [publicKey]);

  async function turnOn() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey!) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
      await sub.unsubscribe().catch(() => undefined);
    }
    setState("off");
    setBusy(false);
  }

  if (state === "loading") return null;
  if (state === "unsupported") return <p className="text-sm text-muted-foreground">{publicKey ? "This browser can't show notifications. Install the Vemi app from Chrome to get them." : "Notifications are being switched on. You get email and SMS until then."}</p>;
  if (state === "denied") return <p className="text-sm text-muted-foreground">Notifications are blocked for Vemi. Allow them in your browser&apos;s site settings, then come back here.</p>;
  return <div className="flex flex-wrap items-center gap-3">
    {state === "on" ? <Button type="button" variant="outline" onClick={turnOff} disabled={busy}>{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <BellOff className="mr-2 h-4 w-4" />}Turn off on this phone</Button>
      : <Button type="button" onClick={turnOn} disabled={busy}>{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}Turn on notifications</Button>}
    <p className="text-sm text-muted-foreground">{state === "on" ? "On for this phone. Chat messages come only as notifications, not email." : "Get bids, bookings, payments and trip updates instantly."}</p>
  </div>;
}
