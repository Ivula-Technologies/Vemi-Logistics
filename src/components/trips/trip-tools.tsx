"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, LoaderCircle, PhoneCall, Send, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentPosition } from "@/components/trips/status-buttons";
import { callThroughVemi, raiseSos, sendTripMessage } from "@/app/actions/trips";
import { cn, formatDateTime } from "@/lib/utils";
import type { CallTarget } from "@/lib/calls";
import type { Message } from "@/lib/types";

/** A signed-in person on the trip page, or the driver on their no-login link. */
export type TripAccess = { kind: "session"; tripId: string } | { kind: "driver"; token: string };

async function post(access: TripAccess, action: "message" | "sos" | "call", body: Record<string, unknown>): Promise<{ error?: string }> {
  if (access.kind === "session") {
    if (action === "message") return sendTripMessage(access.tripId, String(body.body), Boolean(body.toSupport));
    if (action === "sos") return raiseSos(access.tripId, String(body.note ?? ""), (body.lat as number) ?? null, (body.lng as number) ?? null);
    return callThroughVemi(access.tripId, body.to as CallTarget);
  }
  const res = await fetch(`/api/driver/${access.token}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const data = res ? await res.json().catch(() => null) as { error?: string } | null : null;
  if (!res?.ok) return { error: data?.error ?? "No network. Try again in a moment." };
  return {};
}

const SENDER: Record<Message["sender"], string> = { shipper: "Shipper", carrier: "Carrier", driver: "Driver", vemi: "Vemi support" };

/** Trip chat between shipper, carrier, driver and Vemi support. Refreshes every 15 seconds while open. */
export function TripChat({ access, messages, me, text = {} }: { access: TripAccess; messages: Message[]; me: Message["sender"]; text?: { placeholder?: string; send?: string; you?: string; help?: boolean } }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { const id = window.setInterval(() => router.refresh(), 15_000); return () => window.clearInterval(id); }, [router]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);

  async function send(toSupport = false) {
    const value = body.trim();
    if (!value && !toSupport) return;
    setBusy(true); setError(null);
    const result = await post(access, "message", { body: value || "I need help with this trip, please call me.", toSupport });
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setBody("");
    router.refresh();
  }

  return <div id="chat" className="scroll-mt-20 space-y-3">
    <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border bg-background p-3 text-sm">
      {messages.length ? messages.map((m) => <div key={m.id} className={cn("max-w-[85%] rounded-lg px-3 py-2", m.sender === me ? "ml-auto bg-primary text-primary-foreground" : m.sender === "vemi" ? "bg-amber-500/15" : "bg-secondary")}>
        <p className="text-[11px] font-semibold opacity-80">{m.sender === me ? text.you ?? "You" : SENDER[m.sender]}{m.to_support ? " · to Vemi support" : ""}</p>
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        <p className="mt-0.5 text-[10px] opacity-70">{formatDateTime(m.created_at)}</p>
      </div>) : <p className="text-center text-muted-foreground">No messages yet.</p>}
      <div ref={end} />
    </div>
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder={text.placeholder ?? "Write a message"} maxLength={1000} aria-label={text.placeholder ?? "Message"} />
      <Button type="submit" disabled={busy || !body.trim()} aria-label={text.send ?? "Send"}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
    </form>
    {text.help !== false && access.kind === "session" ? <Button type="button" size="sm" variant="ghost" onClick={() => void send(true)} disabled={busy}><LifeBuoy className="mr-2 h-4 w-4" />Get help from Vemi support</Button> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </div>;
}

/** Emergency button: confirms, grabs the position, alerts Vemi ops by SMS and email. */
export function SosButton({ access, text = {} }: { access: TripAccess; text?: { label?: string; hint?: string; confirm?: string; sent?: string; numbers?: string } }) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  async function sos() {
    if (!window.confirm(text.confirm ?? "Send an SOS to Vemi now?")) return;
    setState("busy"); setError(null);
    const position = await currentPosition(5000);
    const result = await post(access, "sos", { lat: position?.lat ?? null, lng: position?.lng ?? null });
    if (result.error) { setError(result.error); setState("idle"); return; }
    setState("sent");
  }
  return <div className="space-y-2">
    <Button type="button" variant="destructive" className="w-full" onClick={sos} disabled={state !== "idle"}>
      {state === "busy" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Siren className="mr-2 h-4 w-4" />}{text.label ?? "Emergency (SOS)"}
    </Button>
    <p className="text-xs text-muted-foreground">{state === "sent" ? text.sent ?? "SOS sent. Vemi will call you now. Police and ambulance: 999 or 112." : `${text.hint ?? "Press if you need help. Vemi is alerted with your location."} ${text.numbers ?? "Police / ambulance: 999 or 112"}`}</p>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </div>;
}

/** Call through Vemi: Vemi rings this phone, then connects the other person. Neither sees the other's number. */
export function CallButton({ access, to, label, ringing = "Vemi is calling your phone now. Answer to be connected." }: { access: TripAccess; to: CallTarget; label: string; ringing?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "ringing">("idle");
  const [error, setError] = useState<string | null>(null);
  async function call() {
    setState("busy"); setError(null);
    const result = await post(access, "call", { to });
    if (result.error) { setError(result.error); setState("idle"); return; }
    setState("ringing");
    window.setTimeout(() => setState("idle"), 30_000);
  }
  return <div>
    <Button type="button" size="sm" variant="outline" onClick={call} disabled={state !== "idle"}>{state === "busy" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}{label}</Button>
    {state === "ringing" ? <p role="status" className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">{ringing}</p> : null}
    {error ? <p role="alert" className="mt-1 text-xs text-destructive">{error}</p> : null}
  </div>;
}
