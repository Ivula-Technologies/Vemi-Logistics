"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { setLanguage } from "@/app/actions/language";
import { t, type AppLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** One tap to switch between English and Kiswahili; stays on the same page. */
export function LanguageSwitch({ lang, compact = false }: { lang: AppLang; compact?: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return <form action={setLanguage}>
    <input type="hidden" name="lang" value={lang === "sw" ? "en" : "sw"} />
    <input type="hidden" name="next" value={`${pathname}${search ? `?${search}` : ""}`} />
    <button aria-label={t(lang, "nav.switchLabel")} className={cn("inline-flex items-center gap-1.5 font-semibold text-muted-foreground hover:text-foreground", compact ? "h-9 rounded-md px-2 text-xs hover:bg-secondary" : "text-xs")}>
      <Languages className="h-3.5 w-3.5" />{t(lang, "nav.switch")}
    </button>
  </form>;
}
