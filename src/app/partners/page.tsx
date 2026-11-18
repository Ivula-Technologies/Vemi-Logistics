import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BadgeCheck, Building2, FileText, MapPinned, Repeat, Smartphone, Truck, Users, Wallet } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { InstallAppButton } from "@/components/pwa/install-app";
import { LanguageSwitch } from "@/components/app/language-switch";
import { getLang } from "@/lib/i18n-server";
import { t, type MessageKey } from "@/lib/i18n";
import { PORTAL } from "@/lib/portal";

const WHO: [React.ReactNode, MessageKey, MessageKey][] = [
  [<Truck key="t" />, "pl.who1", "pl.who1Text"],
  [<Users key="u" />, "pl.who2", "pl.who2Text"],
  [<Building2 key="b" />, "pl.who3", "pl.who3Text"],
];
const WHY: [React.ReactNode, MessageKey, MessageKey][] = [
  [<MapPinned key="m" />, "pl.f1", "pl.f1Text"],
  [<Repeat key="r" />, "pl.f2", "pl.f2Text"],
  [<BadgeCheck key="b" />, "pl.f3", "pl.f3Text"],
  [<Smartphone key="s" />, "pl.f4", "pl.f4Text"],
  [<Wallet key="w" />, "pl.f5", "pl.f5Text"],
  [<FileText key="f" />, "pl.f6", "pl.f6Text"],
];
const STEPS: [MessageKey, MessageKey][] = [["pl.s1", "pl.s1Text"], ["pl.s2", "pl.s2Text"], ["pl.s3", "pl.s3Text"], ["pl.s4", "pl.s4Text"]];

/** Vemi Partner: the front door for truck owners, fleets and logistics companies (English or Kiswahili). */
export default async function PartnerLanding() {
  const lang = await getLang();
  return <div className="min-h-screen bg-background">
    <div className="bg-[#151a24] text-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Brand href={PORTAL.partner.home} label={PORTAL.partner.label} className="[&_span]:text-white/80" />
        <nav className="flex items-center gap-1 sm:gap-2">
          <div className="[&_button]:text-white/80 [&_button:hover]:bg-white/10 [&_button:hover]:text-white"><Suspense fallback={null}><LanguageSwitch lang={lang} compact /></Suspense></div>
          <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white"><Link href={PORTAL.partner.login}>{t(lang, "auth.signIn")}</Link></Button>
          <Button asChild className="hidden sm:inline-flex"><Link href={PORTAL.partner.signup}>{t(lang, "pl.join")}</Link></Button>
        </nav>
      </header>
      <section className="relative mx-auto max-w-6xl overflow-hidden px-4 pb-20 pt-10 sm:px-6 lg:pt-16">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/85"><span className="h-2 w-2 rounded-full bg-[#f26a1b]" />{t(lang, "pl.badge")}</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">{t(lang, "pl.title")} <span className="text-[#f6a06a]">{t(lang, "pl.titleMore")}</span></h1>
        <p className="mt-5 max-w-2xl text-lg text-white/75">{t(lang, "pl.intro")}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href={PORTAL.partner.signup}>{t(lang, "pl.join")}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link href={PORTAL.partner.login}>{t(lang, "pl.signIn")}</Link></Button>
        </div>
        <p className="mt-4 text-sm text-white/60">{t(lang, "pl.terms")}</p>
      </section>
    </div>

    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h2 className="text-2xl font-bold">{t(lang, "pl.whoTitle")}</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">{WHO.map(([icon, title, text]) => <div key={title} className="rounded-xl border bg-card p-5">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-signal-soft text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
        <p className="mt-3 font-semibold">{t(lang, title)}</p><p className="mt-1 text-sm text-muted-foreground">{t(lang, text)}</p>
      </div>)}</div>
    </section>

    <section className="border-y bg-card">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold">{t(lang, "pl.whyTitle")}</h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{WHY.map(([icon, title, text]) => <li key={title} className="flex gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-signal-soft text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
          <div><p className="font-semibold">{t(lang, title)}</p><p className="mt-0.5 text-sm text-muted-foreground">{t(lang, text)}</p></div>
        </li>)}</ul>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h2 className="text-2xl font-bold">{t(lang, "pl.stepsTitle")}</h2>
      <ol className="mt-6 grid gap-4 md:grid-cols-4">{STEPS.map(([title, text], i) => <li key={title} className="rounded-xl border bg-card p-5"><p className="text-sm font-bold text-primary">0{i + 1}</p><p className="mt-2 font-semibold">{t(lang, title)}</p><p className="mt-1 text-sm text-muted-foreground">{t(lang, text)}</p></li>)}</ol>
    </section>

    <section className="bg-[#c2410c] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">{t(lang, "pl.ctaTitle")}</h2>
        <div className="flex flex-wrap gap-3"><Button asChild size="lg" variant="secondary"><Link href={PORTAL.partner.signup}>{t(lang, "pl.join")}</Link></Button><InstallAppButton variant="outline" label={t(lang, "pl.install")} /></div>
      </div>
    </section>

    <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p>{t(lang, "auth.needTruck")} <Link href={PORTAL.customer.home} className="font-semibold text-primary">{t(lang, "auth.toCustomer")}</Link></p>
      <nav className="flex gap-4"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/help">Help</Link><a href="mailto:hello@ivulatechnologies.com">Contact</a></nav>
    </footer>
  </div>;
}
