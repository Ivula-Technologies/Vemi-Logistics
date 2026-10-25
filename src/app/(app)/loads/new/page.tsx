import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { LoadForm, type LoadCopy } from "@/components/loads/load-form";
import { requireRole } from "@/lib/auth";
import { getPlaces } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";
import { displayPhone } from "@/lib/phone";
import { eatToday } from "@/lib/utils";
import type { Load, LoadStop, SavedPlace } from "@/lib/types";

export const metadata: Metadata = { title: "Post a load" };

export default async function NewLoadPage({ searchParams }: { searchParams: Promise<{ welcome?: string; copy?: string }> }) {
  const [{ profile, accountId }, places, { welcome, copy }] = await Promise.all([requireRole("shipper", "admin"), getPlaces(), searchParams]);
  const supabase = await createClient();
  const [{ data: saved }, { count: favourites }, { data: settings }, copied] = await Promise.all([
    supabase.from("saved_places").select("*").eq("account_id", accountId).order("label"),
    supabase.from("favourite_carriers").select("carrier_id", { count: "exact", head: true }).eq("account_id", accountId),
    supabase.from("platform_settings").select("stop_fee_kes, insurance_bps, insurance_min_kes").single(),
    copy && /^[0-9a-f-]{36}$/.test(copy) ? loadToCopy(copy) : Promise.resolve(null),
  ]);
  return <div className="max-w-3xl">
    <PageHeader title={copied ? "Book again" : welcome ? "Welcome to Vemi. Post your first load" : "Post a load"}
      description={copied ? `Copied from ${copied.load.ref}. Check the date and price, then post.` : "Verified trucks see it straight away and can book or bid. Nothing is charged until a truck is booked."} />
    <LoadForm places={places} today={eatToday()} defaultPhone={displayPhone(profile.phone)} saved={(saved ?? []) as SavedPlace[]} hasFavourites={(favourites ?? 0) > 0}
      settings={{ stopFee: settings?.stop_fee_kes ?? 2000, insuranceBps: settings?.insurance_bps ?? 30, insuranceMin: settings?.insurance_min_kes ?? 500 }} copy={copied} />
  </div>;
}

/** "Book again": a past load of this account, with its stops and contacts, to prefill the form. */
async function loadToCopy(id: string): Promise<LoadCopy | null> {
  const supabase = await createClient();
  const [{ data: load }, { data: stops }, { data: contacts }] = await Promise.all([
    supabase.from("loads").select("*").eq("id", id).maybeSingle(),
    supabase.from("load_stops").select("*").eq("load_id", id).order("seq"),
    supabase.from("load_contacts").select("pickup_name, pickup_phone, dropoff_name, dropoff_phone, stops").eq("load_id", id).maybeSingle(),
  ]);
  if (!load) return null;
  return { load: load as Load, stops: (stops ?? []) as LoadStop[], contacts: contacts as LoadCopy["contacts"] };
}
