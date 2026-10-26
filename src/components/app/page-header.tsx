export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0"><h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>{description ? <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p> : null}</div>
    {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
  </div>;
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-card/50 px-6 py-12 text-center">
    {icon ? <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-signal-soft text-primary">{icon}</div> : null}
    <p className="font-semibold">{title}</p>
    {description ? <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>;
}

/** Shows ?error= and ?saved= messages after a form posts back. */
export function Flash({ error, saved, savedText }: { error?: string; saved?: string; savedText?: Record<string, string> }) {
  if (error) return <div role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  if (saved) return <div role="status" className="mb-4 rounded-md border border-emerald-600/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">{savedText?.[saved] ?? "Saved."}</div>;
  return null;
}
