import { cn } from "@/lib/utils";
import { LOAD_STATUS, TRIP_STATUS, type Tone } from "@/lib/trips";

const TONES: Record<Tone, string> = {
  info: "border-sky-600/20 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  success: "border-emerald-600/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-600/20 bg-amber-500/14 text-amber-800 dark:text-amber-300",
  danger: "border-red-600/20 bg-red-500/10 text-red-700 dark:text-red-300",
  muted: "border-border bg-muted text-muted-foreground",
};

export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}>{children}</span>;
}

export function TripStatusBadge({ status }: { status: string }) {
  const meta = TRIP_STATUS[status as keyof typeof TRIP_STATUS] ?? { label: status, tone: "muted" as Tone };
  return <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>;
}

export function LoadStatusBadge({ status }: { status: string }) {
  const meta = LOAD_STATUS[status as keyof typeof LOAD_STATUS] ?? { label: status, tone: "muted" as Tone };
  return <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>;
}
