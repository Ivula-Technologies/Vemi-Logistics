"use client";
import { Button } from "@/components/ui/button";
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="rounded-lg border bg-card p-8 text-center"><h1 className="text-xl font-bold">Something went wrong</h1><p className="mt-2 text-sm text-muted-foreground">{error.digest ? `Reference ${error.digest}. ` : ""}Check your connection and try again. If it keeps happening, WhatsApp Vemi support.</p><Button className="mt-4" onClick={reset}>Try again</Button></div>;
}
