import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { LanguageSwitch } from "@/components/app/language-switch";
import { t, type AppLang } from "@/lib/i18n";
import { PORTAL, type Portal } from "@/lib/portal";
import { cn } from "@/lib/utils";

/** Sign-in and sign-up frame. Customers get the night-blue panel; partners get the orange road panel. */
export function AuthShell({ portal, lang, children }: { portal: Portal; lang: AppLang; children: React.ReactNode }) {
  const partner = portal === "partner";
  const { label, home } = PORTAL[portal];
  return <div className="grid min-h-screen lg:grid-cols-2" data-portal={portal}>
    <div className={cn("relative hidden overflow-hidden p-10 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between", partner ? "bg-[#c2410c]" : "bg-[#151a24]")}>
      <Brand href={home} label={label} className="text-white [&_span]:text-white/80" />
      <div className="relative z-10 max-w-md">
        <p className="text-3xl font-bold leading-tight">{t(lang, partner ? "portal.partnerTagline" : "auth.tagline")}</p>
        <p className="mt-4 text-white/75">{t(lang, partner ? "portal.partnerTaglineMore" : "auth.taglineMore")}</p>
      </div>
      {partner
        ? <svg aria-hidden="true" viewBox="0 0 400 400" className="absolute right-8 top-1/3 w-72 opacity-20"><rect x="30" y="150" width="210" height="120" rx="10" fill="#151a24" /><path d="M240 190h70l50 50v30H240z" fill="#151a24" /><circle cx="100" cy="290" r="34" fill="#fff" /><circle cx="300" cy="290" r="34" fill="#fff" /><path d="M0 360h400" stroke="#fff" strokeWidth="10" strokeDasharray="34 26" /></svg>
        : <svg aria-hidden="true" viewBox="0 0 400 400" className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] opacity-25"><path d="M40 20 200 380 360 20" fill="none" stroke="#f26a1b" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" /><path d="M200 60v220" stroke="#fff" strokeWidth="14" strokeDasharray="24 30" strokeLinecap="round" /></svg>}
    </div>
    <div className="flex flex-col px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between gap-2"><div className="lg:invisible"><Brand href={home} label={label} /></div><Suspense fallback={null}><LanguageSwitch lang={lang} compact /></Suspense></div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
    </div>
  </div>;
}
