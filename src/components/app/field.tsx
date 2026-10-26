import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor: string; hint?: React.ReactNode; error?: string[]; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
    {error?.length ? <p className="text-xs font-medium text-destructive">{error[0]}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
  </div>;
}

export function FormMessage({ state }: { state: { status: string; message?: string } }) {
  if (!state.message || state.status === "idle") return null;
  return <p role={state.status === "error" ? "alert" : "status"} className={cn("rounded-md px-3 py-2 text-sm", state.status === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300")}>{state.message}</p>;
}
