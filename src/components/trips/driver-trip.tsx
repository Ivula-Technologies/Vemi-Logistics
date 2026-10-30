"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, LoaderCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentPosition } from "@/components/trips/status-buttons";
import { DRIVER_TEXT, stepLabel, type Lang } from "@/lib/driver-i18n";
import { shrinkImage } from "@/lib/shrink-image";
import type { Step, TripStatus } from "@/lib/trips";

const SHARING: TripStatus[] = ["to_pickup", "loaded", "in_transit", "at_border"];

/** Big buttons for each step (with the pickup and delivery codes), location sharing while the page is open, and the delivery photo. */
export function DriverTrip({ token, status, steps, hasPod, lang, requireCodes }: { token: string; status: string; steps: Step[]; hasPod: boolean; lang: Lang; requireCodes: boolean }) {
  const t = DRIVER_TEXT[lang];
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<"off" | "on" | "denied">("off");
  const [podDone, setPodDone] = useState(hasPod);
  const [codes, setCodes] = useState<Record<string, string>>({});
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

  async function move(step: Step) {
    const code = codes[step.status]?.trim() ?? "";
    if (requireCodes && step.needsCode === "pickup" && code.length !== 4) { setError(t.pickupCodeHint); return; }
    setBusy(step.status); setError(null);
    const position = await currentPosition();
    const res = await fetch(`/api/driver/${token}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: step.status, lat: position?.lat, lng: position?.lng, code: code || undefined }) }).catch(() => null);
    const data = res ? await res.json().catch(() => null) as { error?: string } | null : null;
    setBusy(null);
    if (!res?.ok) { setError(data?.error ?? t.noNetwork); return; }
    router.refresh();
  }

  async function upload(file: File) {
    setBusy("pod"); setError(null);
    const form = new FormData(); form.set("file", await shrinkImage(file));
    const res = await fetch(`/api/driver/${token}/pod`, { method: "POST", body: form }).catch(() => null);
    const data = res ? await res.json().catch(() => null) as { error?: string } | null : null;
    setBusy(null);
    if (!res?.ok) { setError(data?.error ?? t.uploadFailed); return; }
    setPodDone(true);
  }

  return <section className="mt-5 space-y-3">
    {steps.map((step, i) => <div key={step.status} className="space-y-2">
      {requireCodes && step.needsCode ? <div>
        <label className="text-sm font-semibold" htmlFor={`code-${step.status}`}>{step.needsCode === "pickup" ? t.pickupCode : t.deliveryCode}</label>
        <Input id={`code-${step.status}`} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} className="mt-1 h-12 text-center text-xl tracking-[0.5em]" value={codes[step.status] ?? ""} onChange={(e) => setCodes((c) => ({ ...c, [step.status]: e.target.value.replace(/\D/g, "") }))} />
        <p className="mt-1 text-xs text-muted-foreground">{step.needsCode === "pickup" ? t.pickupCodeHint : t.deliveryCodeHint}</p>
      </div> : null}
      <Button size="lg" variant={i === steps.length - 1 ? "default" : "outline"} className="h-14 w-full text-base" disabled={Boolean(busy)} onClick={() => move(step)}>
        {busy === step.status ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : null}{stepLabel(lang, step.status, status)}
      </Button>
    </div>)}
    {["at_dropoff", "in_transit", "at_border", "delivered"].includes(status) ? <div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      <Button size="lg" variant="outline" className="h-14 w-full text-base" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
        {busy === "pod" ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : podDone ? <CheckCircle2 className="mr-2 h-5 w-5 text-emerald-600" /> : <Camera className="mr-2 h-5 w-5" />}
        {podDone ? t.podDone : t.podTake}
      </Button>
    </div> : null}
    {status === "delivered" ? <p className="rounded-md bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">{t.delivered}</p> : null}
    {error ? <p role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
    {live ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{sharing === "on" ? t.sharingOn : sharing === "denied" ? t.sharingDenied : t.sharingHint}</p> : null}
  </section>;
}

/** Tick off a stop on the way. */
export function StopDoneButton({ token, seq, lang }: { token: string; seq: number; lang: Lang }) {
  const t = DRIVER_TEXT[lang];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function done() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/driver/${token}/stop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seq }) }).catch(() => null);
    const data = res ? await res.json().catch(() => null) as { error?: string } | null : null;
    setBusy(false);
    if (!res?.ok) { setError(data?.error ?? t.noNetwork); return; }
    router.refresh();
  }
  return <div><Button size="sm" variant="outline" onClick={done} disabled={busy}>{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{t.stopDone}</Button>{error ? <p role="alert" className="mt-1 text-xs text-destructive">{error}</p> : null}</div>;
}

/** The driver adds a border paper on the way: the seal number, or a photo of stamped papers. */
export function DriverPaperForm({ token, lang, kinds }: { token: string; lang: Lang; kinds: { value: string; label: string }[] }) {
  const t = DRIVER_TEXT[lang];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const data = new FormData(formEl);
    const file = data.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (!String(data.get("reference") ?? "").trim() && !hasFile) { setError(t.paperNeedOne); return; }
    if (hasFile) data.set("file", await shrinkImage(file));
    setBusy(true); setError(null); setSaved(false);
    const res = await fetch(`/api/driver/${token}/paper`, { method: "POST", body: data }).catch(() => null);
    const body = res ? await res.json().catch(() => null) as { error?: string } | null : null;
    setBusy(false);
    if (!res?.ok) { setError(body?.error ?? t.uploadFailed); return; }
    formEl.reset(); setSaved(true);
    router.refresh();
  }
  return <form onSubmit={submit} className="mt-3 space-y-2 rounded-md border p-3">
    <p className="text-sm font-semibold">{t.paperAdd}</p>
    <label className="block text-xs text-muted-foreground" htmlFor="driver-paper-kind">{t.paperKind}</label>
    <select id="driver-paper-kind" name="kind" defaultValue="border_release" className="h-11 w-full rounded-md border bg-background px-3 text-sm">{kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
    <label className="block text-xs text-muted-foreground" htmlFor="driver-paper-ref">{t.paperRef}</label>
    <Input id="driver-paper-ref" name="reference" maxLength={80} className="h-11" />
    <label className="block text-xs text-muted-foreground" htmlFor="driver-paper-file">{t.paperPhoto}</label>
    <Input id="driver-paper-file" name="file" type="file" accept="image/*" capture="environment" />
    <Button type="submit" className="h-12 w-full" disabled={busy}>{busy ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : null}{t.paperSave}</Button>
    {saved ? <p className="text-sm text-emerald-700">{t.paperSaved}</p> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </form>;
}
