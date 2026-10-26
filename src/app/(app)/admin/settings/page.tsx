import type { Metadata } from "next";
import { Flash, PageHeader } from "@/components/app/page-header";
import { Field } from "@/components/app/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { updateSettings } from "@/app/actions/admin";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PlatformSettings } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

type Key = keyof PlatformSettings;
const GROUPS: { title: string; fields: [Key, string, string][] }[] = [
  { title: "Commission", fields: [["commission_bps", "Commission", "basis points: 1000 = 10%"], ["founding_commission_bps", "Founding carriers' commission", "basis points"]] },
  { title: "Pricing", fields: [["urgent_surcharge_bps", "Urgent pickup surcharge (within 24 h)", "basis points"], ["busy_lane_max_bps", "Busy lane surcharge, at most", "basis points"], ["stop_fee_kes", "Fee per extra stop", "KES"], ["usd_rate", "KES per US dollar (card payments)", "KES"]] },
  { title: "Waiting time", fields: [["free_waiting_hours", "Free waiting at pickup and drop-off", "hours"], ["waiting_kes_per_hour", "Waiting charge after that", "KES per hour"]] },
  { title: "Cancellations", fields: [["cancel_fee_bps", "Fee once the truck is on its way", "basis points of the trip price"], ["cancel_fee_min_kes", "Minimum fee", "KES"]] },
  { title: "Cargo cover", fields: [["insurance_bps", "Premium", "basis points of declared value"], ["insurance_min_kes", "Minimum premium", "KES"]] },
  { title: "Fuel advances", fields: [["fuel_advance_max_bps", "Most a carrier can take", "basis points of the payout"], ["fuel_advance_fee_bps", "Fee", "basis points of the advance"]] },
  { title: "Referrals", fields: [["referral_reward_kes", "Reward to the person who invited", "KES"], ["referee_credit_kes", "Welcome credit for a new shipper", "KES"]] },
  { title: "Payments", fields: [["mpesa_max_kes", "Largest single M-Pesa payment", "KES (Safaricom limit 250,000)"], ["auto_confirm_hours", "Auto-confirm delivery after", "hours"]] },
];

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireRole("admin");
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("*").single();
  const settings = data as PlatformSettings;
  return <div className="max-w-3xl space-y-6">
    <Flash error={query.error} saved={query.saved} savedText={query.saved ? { [query.saved]: `${query.saved}.` } : undefined} />
    <PageHeader title="Settings" description="Prices, fees and limits for the whole marketplace. Changes apply to new loads and trips straight away." />
    <form action={updateSettings} className="space-y-5">
      {GROUPS.map((g) => <section key={g.title} className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 font-semibold">{g.title}</h2>
        <div className="grid gap-3 sm:grid-cols-2">{g.fields.map(([key, label, hint]) => <Field key={key} label={label} htmlFor={key} hint={hint}><Input id={key} name={key} type="number" min="0" step="any" defaultValue={String(settings?.[key] ?? "")} /></Field>)}</div>
      </section>)}
      <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
    </form>
  </div>;
}
