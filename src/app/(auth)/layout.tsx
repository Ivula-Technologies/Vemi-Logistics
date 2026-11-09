import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { LanguageSwitch } from "@/components/app/language-switch";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return <div className="grid min-h-screen lg:grid-cols-2">
    <div className="relative hidden overflow-hidden bg-[#151a24] p-10 text-white lg:flex lg:flex-col lg:justify-between">
      <Brand className="text-white [&_span]:text-white/80" />
      <div className="relative z-10 max-w-md">
        <p className="text-3xl font-bold leading-tight">{t(lang, "auth.tagline")}</p>
        <p className="mt-4 text-white/70">{t(lang, "auth.taglineMore")}</p>
      </div>
      <svg aria-hidden="true" viewBox="0 0 400 400" className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] opacity-25"><path d="M40 20 200 380 360 20" fill="none" stroke="#f26a1b" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" /><path d="M200 60v220" stroke="#fff" strokeWidth="14" strokeDasharray="24 30" strokeLinecap="round" /></svg>
    </div>
    <div className="flex flex-col px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between gap-2"><div className="lg:invisible"><Brand /></div><Suspense fallback={null}><LanguageSwitch lang={lang} compact /></Suspense></div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
    </div>
  </div>;
}
