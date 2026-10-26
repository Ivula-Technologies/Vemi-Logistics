import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/cron";
import { notifyUser, sendSms } from "@/lib/notify";
import { driverText } from "@/lib/driver-i18n";
import { DOCUMENT_KINDS } from "@/lib/trips";
import { formatDate, formatKes } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Jobs = {
  auto_confirmed: number; expired_loads: number;
  pickup_reminders: { id: string; ref: string; carrier_id: string; driver_id: string | null }[];
  expiring_documents: { id: string; carrier_id: string; kind: string; expires_on: string }[];
  overdue_invoices: { id: string; ref: string; shipper_id: string; balance: number; credit_due_on: string }[];
};

/**
 * Daily from cPanel cron: confirms deliveries nobody answered (queuing payouts), expires stale loads, and sends
 * pickup reminders (carrier and driver), document expiry reminders and overdue invoice reminders.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("run_daily_jobs");
  if (error) { console.error("Daily jobs failed", error); return NextResponse.json({ error: error.message }, { status: 500 }); }
  const jobs = data as Jobs;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  await Promise.all(jobs.pickup_reminders.map(async (trip) => {
    await notifyUser(trip.carrier_id, `${trip.ref} picks up tomorrow`, "Your truck is booked for pickup tomorrow. Check the driver has the trip link and the truck is ready.", `/trips/${trip.id}`, { sms: true, key: `remind-${trip.id}` });
    if (!trip.driver_id) return;
    const [{ data: driver }, { data: token }] = await Promise.all([
      admin.from("drivers").select("phone, language").eq("id", trip.driver_id).single(),
      admin.from("trips").select("driver_token").eq("id", trip.id).single(),
    ]);
    if (driver?.phone && token) await sendSms(driver.phone, driverText(driver.language).reminder(trip.ref, `${site}/d/${token.driver_token}`));
  }));
  await Promise.all(jobs.expiring_documents.map((doc) => notifyUser(doc.carrier_id, "A document is about to expire",
    `Your ${DOCUMENT_KINDS[doc.kind as keyof typeof DOCUMENT_KINDS] ?? doc.kind} expires on ${formatDate(doc.expires_on)}. Upload the new one so you can keep booking loads.`, "/profile#documents", { sms: true, key: `expiry-${doc.id}` })));
  await Promise.all(jobs.overdue_invoices.map((invoice) => notifyUser(invoice.shipper_id, `Invoice overdue: ${invoice.ref}`,
    `${formatKes(invoice.balance)} for ${invoice.ref} was due on ${formatDate(invoice.credit_due_on)}. Pay by M-Pesa, card or bank to keep booking on account.`, `/trips/${invoice.id}`, { sms: true })));

  return NextResponse.json({ auto_confirmed: jobs.auto_confirmed, expired_loads: jobs.expired_loads, pickup_reminders: jobs.pickup_reminders.length, expiring_documents: jobs.expiring_documents.length, overdue_invoices: jobs.overdue_invoices.length });
}
