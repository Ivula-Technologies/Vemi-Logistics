"use client";
import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, type AppLang } from "@/lib/i18n";

export function ShareReferral({ code, url, carrier = false, lang = "en" }: { code: string; url: string; carrier?: boolean; lang?: AppLang }) {
  const [copied, setCopied] = useState(false);
  const text = t(lang, carrier ? "share.textCarrier" : "share.textShipper", { code, url });
  return <div className="flex flex-wrap items-center gap-2">
    <span className="rounded-md border bg-background px-3 py-2 font-mono text-lg font-bold tracking-widest">{code}</span>
    <Button type="button" variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { window.prompt(t(lang, "share.copy"), url); } }}><Copy className="mr-2 h-4 w-4" />{t(lang, copied ? "share.copied" : "share.copy")}</Button>
    <Button asChild size="sm" className="bg-[#25d366] text-[#0b3b1f] hover:bg-[#1ebe5b]"><a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />{t(lang, "share.whatsapp")}</a></Button>
  </div>;
}
