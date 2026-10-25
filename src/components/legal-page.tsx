import Link from "next/link";
import { Brand } from "@/components/brand";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <Brand />
    <h1 className="mt-8 text-3xl font-bold">{title}</h1>
    <p className="mt-1 text-sm text-muted-foreground">Last updated {updated}</p>
    <div className="mt-6 space-y-4 text-[15px] leading-7 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    <p className="mt-10 text-sm"><Link href="/" className="font-semibold text-primary">← Back to Vemi</Link></p>
  </div>;
}
