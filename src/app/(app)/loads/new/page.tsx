import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { LoadForm } from "@/components/loads/load-form";
import { requireRole } from "@/lib/auth";
import { getPlaces } from "@/lib/places";
import { displayPhone } from "@/lib/phone";
import { eatToday } from "@/lib/utils";

export const metadata: Metadata = { title: "Post a load" };

export default async function NewLoadPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [{ profile }, places, { welcome }] = await Promise.all([requireRole("shipper", "admin"), getPlaces(), searchParams]);
  return <div className="max-w-3xl">
    <PageHeader title={welcome ? "Welcome to Vemi. Post your first load" : "Post a load"} description="Verified trucks see it straight away and bid. You choose who to book; nothing is charged until you do." />
    <LoadForm places={places} today={eatToday()} defaultPhone={displayPhone(profile.phone)} />
  </div>;
}
