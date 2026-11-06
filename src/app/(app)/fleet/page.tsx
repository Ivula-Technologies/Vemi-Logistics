import type { Metadata } from "next";
import Link from "next/link";
import { Camera, FileText, MapPin, Truck, UserRound } from "lucide-react";
import { Flash, PageHeader, EmptyState } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/status-badge";
import { Field, selectClass } from "@/components/app/field";
import { DriverForm, TruckForm } from "@/components/carrier/forms";
import { PlaceSelect } from "@/components/loads/place-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { clearTruckAvailable, setDriverLanguage, setTruckAvailable, toggleFleetItem, uploadDocument, uploadFleetPhoto } from "@/app/actions/carrier";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { placeMap } from "@/lib/places";
import { TRUCK_TYPES } from "@/lib/pricing";
import { DOCUMENT_KINDS } from "@/lib/trips";
import { displayPhone } from "@/lib/phone";
import { eatToday, formatDate } from "@/lib/utils";
import type { Driver, PlaceRow, Truck as TruckRow, TruckAvailability } from "@/lib/types";
import { FileInput } from "@/components/app/file-input";
import { getLang } from "@/lib/i18n-server";
import { formatDateIn, translator, type AppLang } from "@/lib/i18n";

export const metadata: Metadata = { title: "Fleet" };


export default async function FleetPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const [{ user, carrier }, query, lang] = await Promise.all([requireRole("carrier"), searchParams, getLang()]);
  const tr = translator(lang);
  const SAVED = { online: tr("fleet.saved.online"), offline: tr("fleet.saved.offline"), photo: tr("fleet.saved.photo"), language: tr("fleet.saved.language") };
  const date = (value: string) => (lang === "en" ? formatDate(value) : formatDateIn(lang, value));
  if (!carrier) return <div><PageHeader title={tr("fleet.title")} /><EmptyState title={tr("fleet.needBusiness")} action={<Button asChild><Link href="/profile">{tr("fleet.goProfile")}</Link></Button>} /></div>;
  const supabase = await createClient();
  const [{ data: trucks }, { data: drivers }, { data: free }, { data: docs }, places] = await Promise.all([
    supabase.from("trucks").select("*").eq("carrier_id", user.id).order("created_at"),
    supabase.from("drivers").select("*").eq("carrier_id", user.id).order("created_at"),
    supabase.from("truck_availability").select("*").eq("carrier_id", user.id),
    supabase.from("carrier_documents").select("id, kind, driver_id, expires_on").eq("carrier_id", user.id).not("driver_id", "is", null),
    placeMap(),
  ]);
  const placeList = [...places.values()].sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  const availability = new Map(((free ?? []) as TruckAvailability[]).map((a) => [a.truck_id, a]));
  const today = eatToday();
  return <div className="space-y-8">
    <Flash error={query.error} saved={query.saved} savedText={SAVED} />
    <PageHeader title={tr("fleet.title")} description={tr("fleet.intro")} />
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-semibold"><Truck className="h-5 w-5 text-primary" />{tr("fleet.trucks")}</h2>
      {((trucks ?? []) as TruckRow[]).map((t) => {
        const a = availability.get(t.id);
        const live = a && a.expires_at > new Date().toISOString();
        return <div key={t.id} className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {t.photo_path ? <img src={`/api/files/truck/${t.id}`} alt="" className="h-12 w-16 rounded object-cover" /> : null}
              <div><p className="font-semibold">{t.plate}</p><p className="text-sm text-muted-foreground">{TRUCK_TYPES[t.truck_type]?.label} · {Number(t.capacity_tonnes)} t{t.make_model ? ` · ${t.make_model}` : ""}</p></div>
            </div>
            <FleetToggle kind="truck" id={t.id} active={t.active} lang={lang} />
          </div>
          {t.active ? live ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm">
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-700" />{tr("fleet.freeAt", { place: places.get(a.place_id)?.name ?? "", date: date(a.available_from) })}{a.heading_to ? tr("fleet.heading", { place: places.get(a.heading_to)?.name ?? "" }) : ""}</span>
            <form action={clearTruckAvailable}><input type="hidden" name="truckId" value={t.id} /><SubmitButton size="sm" variant="ghost" pendingLabel="…">{tr("fleet.markBusy")}</SubmitButton></form>
          </div> : <AvailabilityForm truckId={t.id} places={placeList} today={today} lang={lang} /> : null}
          <PhotoForm kind="truck" id={t.id} has={Boolean(t.photo_path)} lang={lang} />
        </div>;
      })}
      <div className="rounded-lg border border-dashed p-4"><TruckForm lang={lang} /></div>
    </section>
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-semibold"><UserRound className="h-5 w-5 text-primary" />{tr("fleet.drivers")}</h2>
      {((drivers ?? []) as Driver[]).map((d) => {
        const mine = (docs ?? []).filter((x) => x.driver_id === d.id);
        return <div key={d.id} className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {d.photo_path ? <img src={`/api/files/driver/${d.id}`} alt="" className="h-12 w-12 rounded-full object-cover" /> : null}
              <div><p className="font-semibold">{d.full_name}</p><p className="text-sm text-muted-foreground">{displayPhone(d.phone)}{d.licence_no ? tr("fleet.licence", { no: d.licence_no }) : ""}</p>
                {mine.length ? <p className="text-xs text-muted-foreground">{tr("fleet.uploaded", { docs: mine.map((x) => DOCUMENT_KINDS[x.kind as keyof typeof DOCUMENT_KINDS]).join(", ") })}</p> : null}</div>
            </div>
            <FleetToggle kind="driver" id={d.id} active={d.active} lang={lang} />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <form action={setDriverLanguage} className="flex items-end gap-2"><input type="hidden" name="id" value={d.id} />
              <Field label={tr("fleet.language")} htmlFor={`lang-${d.id}`}><select id={`lang-${d.id}`} name="language" defaultValue={d.language} className={`${selectClass} w-36`}><option value="sw">Kiswahili</option><option value="en">English</option></select></Field>
              <SubmitButton size="sm" variant="ghost" pendingLabel="…">{tr("fleet.save")}</SubmitButton></form>
            <PhotoForm kind="driver" id={d.id} has={Boolean(d.photo_path)} lang={lang} />
          </div>
          <details className="text-sm"><summary className="flex cursor-pointer items-center gap-2 font-semibold"><FileText className="h-4 w-4" />{tr("fleet.addDoc")}</summary>
            <form action={uploadDocument} className="mt-2 grid gap-2 sm:grid-cols-[180px_160px_1fr_auto] sm:items-end"><input type="hidden" name="driverId" value={d.id} />
              <select name="kind" className={selectClass} aria-label="Document" defaultValue="driving_licence">{(["driving_licence", "good_conduct", "yellow_card"] as const).map((k) => <option key={k} value={k}>{DOCUMENT_KINDS[k]}</option>)}</select>
              <Input name="expiresOn" type="date" aria-label="Expiry date" />
              <FileInput name="file" accept="image/*,application/pdf" capture="environment" required aria-label="File" />
              <SubmitButton size="sm" variant="outline" pendingLabel="…">{tr("fleet.upload")}</SubmitButton>
            </form></details>
        </div>;
      })}
      <div className="rounded-lg border border-dashed p-4"><DriverForm lang={lang} /></div>
    </section>
  </div>;
}

function AvailabilityForm({ truckId, places, today, lang }: { truckId: string; places: PlaceRow[]; today: string; lang: AppLang }) {
  const tr = translator(lang);
  return <details className="rounded-md border px-3 py-2 text-sm">
    <summary className="flex cursor-pointer items-center gap-2 font-semibold"><MapPin className="h-4 w-4 text-primary" />{tr("fleet.free")}</summary>
    <form action={setTruckAvailable} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="truckId" value={truckId} />
      <Field label={tr("fleet.where")} htmlFor={`at-${truckId}`}><PlaceSelect id={`at-${truckId}`} name="placeId" places={places} required /></Field>
      <Field label={tr("fleet.freeFrom")} htmlFor={`from-${truckId}`}><Input id={`from-${truckId}`} name="from" type="date" min={today} defaultValue={today} /></Field>
      <Field label={tr("fleet.headingTo")} htmlFor={`to-${truckId}`} hint={tr("fleet.headingHint")}><PlaceSelect id={`to-${truckId}`} name="heading" places={places} /></Field>
      <Field label={tr("fleet.note")} htmlFor={`note-${truckId}`}><Input id={`note-${truckId}`} name="note" maxLength={200} placeholder={tr("fleet.notePlaceholder")} /></Field>
      <div className="sm:col-span-2"><SubmitButton size="sm" pendingLabel="…">{tr("fleet.markFree")}</SubmitButton></div>
    </form>
  </details>;
}

function PhotoForm({ kind, id, has, lang }: { kind: "truck" | "driver"; id: string; has: boolean; lang: AppLang }) {
  const tr = translator(lang);
  return <form action={uploadFleetPhoto} className="flex flex-wrap items-center gap-2 text-sm"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
    <FileInput name="file" accept="image/*" capture={kind === "truck" ? "environment" : "user"} required className="w-56" aria-label={kind === "truck" ? "Truck photo" : "Driver photo"} />
    <SubmitButton size="sm" variant="outline" pendingLabel="…"><Camera className="mr-1.5 h-4 w-4" />{has ? tr("fleet.replacePhoto") : kind === "truck" ? tr("fleet.truckPhoto") : tr("fleet.driverPhoto")}</SubmitButton>
  </form>;
}

function FleetToggle({ kind, id, active, lang }: { kind: "truck" | "driver"; id: string; active: boolean; lang: AppLang }) {
  const tr = translator(lang);
  return <form action={toggleFleetItem} className="flex items-center gap-2">
    <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={String(!active)} />
    {active ? <ToneBadge tone="success">{tr("fleet.active")}</ToneBadge> : <ToneBadge tone="muted">{tr("fleet.off")}</ToneBadge>}
    <Button size="sm" variant="ghost">{active ? tr("fleet.turnOff") : tr("fleet.turnOn")}</Button>
  </form>;
}
