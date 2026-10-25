import Link from "next/link";
import { cn } from "@/lib/utils";

export function VemiMark({ className }: { className?: string }) {
  return <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("h-8 w-8 shrink-0", className)}>
    <rect width="64" height="64" rx="14" fill="#151a24" />
    <path d="M14 16 32 49 50 16" fill="none" stroke="#f26a1b" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M32 18v20" stroke="#fff" strokeWidth="3" strokeDasharray="4 5" strokeLinecap="round" />
  </svg>;
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="Vemi Logistics home">
    <VemiMark />
    <span className="leading-none"><span className="block text-lg font-extrabold tracking-tight">vemi</span><span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Logistics</span></span>
  </Link>;
}
