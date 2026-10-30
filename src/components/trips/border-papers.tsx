import { AlertTriangle, CheckCircle2, FileText, Timer, Trash2 } from "lucide-react";
import { Field, selectClass } from "@/components/app/field";
import { FileInput } from "@/components/app/file-input";
import { Panel } from "@/components/trips/panels";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { addTripPaper, removeTripPaper } from "@/app/actions/trips";
import { BORDER_PAPERS, BORDER_PAPER_KINDS, ON_THE_ROAD, borderHours, missingPapers, type BorderPaperKind } from "@/lib/trips";
import { formatDateTime } from "@/lib/utils";
import type { TripView } from "@/lib/trip-view";

const WHO = { shipper: "Shipper", carrier: "Carrier", driver: "Driver", admin: "Vemi" } as const;

/**
 * Customs and transit papers for a cross-border trip, shared by the shipper (or their clearing agent), the
 * carrier, the driver and Vemi, so the truck doesn't sit at the border waiting for a missing entry.
 */
export function BorderPapersPanel({ view }: { view: TripView }) {
  const { trip, load, papers, viewer } = view;
  if (load.border_crossings === 0 && papers.length === 0) return null;
  const open = !["completed", "cancelled"].includes(trip.status);
  const missing = missingPapers(papers.map((p) => p.kind));
  const urgent = missing.length > 0 && (["scheduled", "to_pickup", "at_pickup", ...ON_THE_ROAD] as string[]).includes(trip.status);
  const hours = borderHours(view.events);
  const mine = (addedAs: string) => viewer === "admin" || addedAs === viewer;
  return <Panel title={`Border papers (${load.border_crossings} border${load.border_crossings === 1 ? "" : "s"})`} id="papers" tone={urgent ? "danger" : "primary"}>
    {missing.length ? <p className={`mb-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm ${urgent ? "bg-destructive/10 text-destructive" : "bg-secondary"}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Still needed before the border: {missing.map((k) => BORDER_PAPERS[k].en).join(", ")}. {viewer === "carrier" ? "Ask the shipper or their clearing agent." : viewer === "shipper" ? "Add them here or ask your clearing agent to send them to you." : ""}</span>
    </p> : <p className="mb-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" />The main papers are in. The driver sees them on the trip link.</p>}

    {papers.length ? <ul className="mb-4 divide-y rounded-md border text-sm">{papers.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
      <FileText className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{BORDER_PAPERS[p.kind as BorderPaperKind]?.en ?? p.kind}</span>
      {p.reference ? <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">{p.reference}</span> : null}
      {p.path ? <a href={`/api/files/paper/${p.id}`} target="_blank" rel="noreferrer" className="font-semibold text-primary">Open file</a> : null}
      <span className="text-xs text-muted-foreground">{WHO[p.added_as]} · {formatDateTime(p.created_at)}</span>
      {open && mine(p.added_as) && p.added_as !== "driver" ? <form action={removeTripPaper} className="ml-auto"><input type="hidden" name="tripId" value={trip.id} /><input type="hidden" name="paperId" value={p.id} /><SubmitButton variant="ghost" size="sm" pendingLabel="…" aria-label="Remove"><Trash2 className="h-4 w-4" /></SubmitButton></form> : null}
    </li>)}</ul> : null}

    {hours.length ? <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><Timer className="h-4 w-4" />Time at the border: {hours.map((h) => `${h} h`).join(", ")}</p> : null}

    {open ? <form action={addTripPaper} className="space-y-3">
      <input type="hidden" name="tripId" value={trip.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Paper" htmlFor="paper-kind"><select id="paper-kind" name="kind" className={selectClass} defaultValue={missing[0] ?? "other"}>{BORDER_PAPER_KINDS.map((k) => <option key={k} value={k}>{BORDER_PAPERS[k].en}{BORDER_PAPERS[k].required ? " *" : ""}</option>)}</select></Field>
        <Field label="Reference number" htmlFor="paper-ref"><Input id="paper-ref" name="reference" maxLength={80} placeholder="e.g. entry or seal number" /></Field>
      </div>
      <Field label="File (photo or PDF, optional)" htmlFor="paper-file"><FileInput id="paper-file" name="file" accept="image/*,application/pdf" /></Field>
      <SubmitButton variant="outline" pendingLabel="Saving…">Add paper</SubmitButton>
      <p className="text-xs text-muted-foreground">Only this trip&apos;s shipper, carrier, driver and Vemi can see these.</p>
    </form> : null}
  </Panel>;
}
