import type { Metadata } from "next";
import { FileText, ShieldCheck } from "lucide-react";
import { Flash, PageHeader } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/status-badge";
import { AccountForm, CarrierProfileForm } from "@/components/carrier/forms";
import { Field, selectClass } from "@/components/app/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { InstallAppButton } from "@/components/pwa/install-app";
import { PushToggle } from "@/components/pwa/push-toggle";
import { ShareReferral } from "@/components/app/share-referral";
import { deleteDocument, uploadDocument } from "@/app/actions/carrier";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_KINDS, REQUIRED_DOCUMENTS } from "@/lib/trips";
import { formatDate, formatKes } from "@/lib/utils";
import { percent } from "@/lib/commission";
import type { CarrierPrivate, PlatformSettings } from "@/lib/types";
import { FileInput } from "@/components/app/file-input";
import { getLang } from "@/lib/i18n-server";
import { formatDateIn, t } from "@/lib/i18n";

export const metadata: Metadata = { title: "Profile" };

const STATUS_KEY = { pending: "prof.pending", verified: "prof.verified", rejected: "prof.rejected", suspended: "prof.suspended" } as const;
const STATUS_TONE = { pending: "warning", verified: "success", rejected: "danger", suspended: "danger" } as const;

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; welcome?: string }> }) {
  const [{ user, profile, carrier }, query] = await Promise.all([getSession(), searchParams]);
  const supabase = await createClient();
  const isCarrier = profile.role === "carrier";
  const lang = isCarrier ? await getLang() : "en";
  const fmtDate = (d: string) => isCarrier ? formatDateIn(lang, d) : formatDate(d);
  const [{ data: details }, { data: docs }] = isCarrier ? await Promise.all([
    supabase.from("carrier_private").select("*").eq("carrier_id", user.id).maybeSingle(),
    supabase.from("carrier_documents").select("id, kind, file_name, expires_on, created_at").eq("carrier_id", user.id).order("created_at"),
  ]) : [{ data: null }, { data: null }];
  const { data: settingsRow } = await supabase.from("platform_settings").select("referral_reward_kes, referee_credit_kes").single();
  const settings = settingsRow as Pick<PlatformSettings, "referral_reward_kes" | "referee_credit_kes"> | null;
  const have = new Set((docs ?? []).map((d) => d.kind));
  return <div className="max-w-3xl space-y-8">
    <Flash error={query.error} saved={query.saved} savedText={{ document: t(lang, "prof.docSaved") }} />
    <PageHeader title={isCarrier ? t(lang, query.welcome ? "prof.welcomeTitle" : "prof.title") : "Account"}
      description={isCarrier ? t(lang, "prof.intro") : user.email} />
    {isCarrier ? <>
      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-primary" />{t(lang, "prof.business")}</h2>
          {carrier ? <ToneBadge tone={STATUS_TONE[carrier.status]}>{t(lang, STATUS_KEY[carrier.status])}</ToneBadge> : null}</div>
        {carrier?.review_note ? <p className="mb-4 rounded-md bg-amber-500/10 px-3 py-2 text-sm">Note from Vemi: {carrier.review_note}</p> : null}
        {carrier?.founding_until && new Date(carrier.founding_until) > new Date() ? <p className="mb-4 rounded-md bg-signal-soft px-3 py-2 text-sm">{t(lang, "prof.founding", { percent: percent(carrier.commission_bps ?? 500), date: fmtDate(carrier.founding_until) })}</p> : null}
        <CarrierProfileForm carrier={carrier} details={details as CarrierPrivate | null} fallbackName={profile.company || profile.full_name} fallbackPhone={profile.phone} lang={lang} />
      </section>
      <section id="documents" className="scroll-mt-20 rounded-lg border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold"><FileText className="h-5 w-5 text-primary" />{t(lang, "prof.documents")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(lang, "prof.docsIntro")}</p>
        <ul className="mt-4 space-y-2 text-sm">{REQUIRED_DOCUMENTS.map((kind) => <li key={kind} className="flex items-center gap-2">{have.has(kind) ? <ToneBadge tone="success">{t(lang, "prof.uploaded")}</ToneBadge> : <ToneBadge tone="warning">{t(lang, "prof.needed")}</ToneBadge>}{t(lang, `doc.${kind}`)}</li>)}</ul>
        {(docs ?? []).length ? <ul className="mt-4 divide-y rounded-md border text-sm">{(docs ?? []).map((d) => <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
          <a href={`/api/files/doc/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium underline-offset-4 hover:underline">{t(lang, `doc.${d.kind as keyof typeof DOCUMENT_KINDS}`)} · {d.file_name}{d.expires_on ? t(lang, "prof.expires", { date: fmtDate(d.expires_on) }) : ""}</a>
          <form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><Button size="sm" variant="ghost">{t(lang, "prof.remove")}</Button></form>
        </li>)}</ul> : null}
        {carrier ? <form action={uploadDocument} className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label={t(lang, "prof.document")} htmlFor="kind"><select id="kind" name="kind" className={selectClass} defaultValue={REQUIRED_DOCUMENTS.find((k) => !have.has(k)) ?? "other"}>{(Object.keys(DOCUMENT_KINDS) as (keyof typeof DOCUMENT_KINDS)[]).map((k) => <option key={k} value={k}>{t(lang, `doc.${k}`)}</option>)}</select></Field>
          <Field label={t(lang, "prof.expiry")} htmlFor="expiresOn"><Input id="expiresOn" name="expiresOn" type="date" /></Field>
          <Field label={t(lang, "prof.file")} htmlFor="file"><FileInput id="file" name="file" accept="image/*,application/pdf" capture="environment" required /></Field>
          <div className="sm:col-span-3"><SubmitButton pendingLabel={t(lang, "prof.uploading")}>{t(lang, "prof.upload")}</SubmitButton></div>
        </form> : <p className="mt-4 text-sm text-muted-foreground">{t(lang, "prof.saveFirst")}</p>}
      </section>
    </> : null}
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 font-semibold">{t(lang, "prof.yourDetails")}</h2>
      <AccountForm profile={profile} lang={lang} />
    </section>
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-1 font-semibold">{t(lang, "prof.notifications")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t(lang, "prof.notifyIntro")}</p>
      <PushToggle publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
    </section>
    {profile.referral_code && profile.role !== "admin" ? <section id="refer" className="scroll-mt-20 rounded-lg border bg-card p-5">
      <h2 className="mb-1 font-semibold">{t(lang, "prof.invite")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{settings && isCarrier ? t(lang, "prof.inviteText", { credit: formatKes(settings.referee_credit_kes), reward: formatKes(settings.referral_reward_kes) }) : settings ? `Share your code. A business that signs up with it gets ${formatKes(settings.referee_credit_kes)} off its first trip, and you get ${formatKes(settings.referral_reward_kes)} ${isCarrier ? "with your next payout" : "in your Vemi wallet"} once their first trip is done. Truck owners can join with it too.` : "Share your code with businesses that move goods."}</p>
      <ShareReferral code={profile.referral_code} url={`${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/signup?ref=${profile.referral_code}`} />
    </section> : null}
    <InstallAppButton label="Install the Vemi app on this phone" />
  </div>;
}
