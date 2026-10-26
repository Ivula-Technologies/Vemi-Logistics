import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VemiMark } from "@/components/brand";
import { PrintButton } from "@/components/app/print-button";
import { getSession } from "@/lib/auth";
import { loadTripView } from "@/lib/trip-view";
import { TRUCK_TYPES } from "@/lib/pricing";
import { CARGO_TYPES, TRIP_STATUS } from "@/lib/trips";
import { formatDate, formatKes } from "@/lib/utils";

export const metadata: Metadata = { title: "Receipt" };

const METHOD = { mpesa: "M-Pesa", bank: "Bank transfer", paypal: "Card / PayPal", wallet: "Vemi wallet" } as const;

/** A printable receipt (or invoice, for trips on account) for the shipper's accounts team. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { user, profile }] = await Promise.all([params, getSession()]);
  const view = await loadTripView(id, user.id, profile.role);
  if (!view || view.viewer === "carrier") notFound();
  const { trip, load, origin, destination, business, carrier, truck, payments } = view;
  const invoice = trip.on_credit && trip.balance > 0;
  const paid = payments.filter((p) => p.status === "paid");
  const lines: [string, number][] = [[`Transport ${origin.name} → ${destination.name}${view.stops.length ? ` with ${view.stops.length} stop${view.stops.length > 1 ? "s" : ""}` : ""}`, trip.price]];
  if (trip.insurance_fee) lines.push([`Cargo cover (declared value ${formatKes(load.declared_value)})`, trip.insurance_fee]);
  if (trip.extras) lines.push(["Approved extras (waiting time, extra stops, loading)", trip.extras]);
  if (trip.discount) lines.push(["Discount", -trip.discount]);
  if (trip.status === "cancelled") lines.splice(0, lines.length, ["Cancellation fee", trip.cancel_fee]);
  const vemi = { name: process.env.VEMI_LEGAL_NAME || "Vemi Logistics", pin: process.env.VEMI_KRA_PIN, address: process.env.VEMI_ADDRESS };

  return <div className="mx-auto max-w-2xl">
    <div className="mb-4 flex items-center justify-between print:hidden"><Link href={`/trips/${trip.id}`} className="text-sm font-semibold text-primary">← Back to the trip</Link><PrintButton /></div>
    <article className="rounded-lg border bg-white p-8 text-sm text-[#151a24] print:border-0 print:p-0">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3"><VemiMark className="h-10 w-10" /><div><p className="font-bold">{vemi.name}</p>{vemi.address ? <p className="text-xs text-gray-600">{vemi.address}</p> : null}{vemi.pin ? <p className="text-xs text-gray-600">KRA PIN {vemi.pin}</p> : null}</div></div>
        <div className="text-right"><p className="text-xl font-bold">{invoice ? "Invoice" : "Receipt"}</p><p className="text-gray-600">{trip.ref}</p><p className="text-gray-600">{formatDate(trip.paid_at ?? trip.created_at)}</p></div>
      </header>
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div><p className="text-xs font-semibold uppercase text-gray-500">Billed to</p><p className="font-medium">{business?.legal_name ?? (profile.company || profile.full_name)}</p>{business?.kra_pin ? <p>KRA PIN {business.kra_pin}</p> : null}{business?.billing_email ? <p>{business.billing_email}</p> : null}</div>
        <div><p className="text-xs font-semibold uppercase text-gray-500">Trip</p><p>{CARGO_TYPES[load.cargo_type]}: {load.cargo_description}, {Number(load.weight_tonnes)} t</p><p>{TRUCK_TYPES[load.truck_type]?.label}{truck ? ` · ${truck.plate}` : ""} · {carrier?.business_name}</p><p>Status: {TRIP_STATUS[trip.status].label}{trip.delivered_at ? `, delivered ${formatDate(trip.delivered_at)}` : ""}</p></div>
      </section>
      <table className="mt-6 w-full"><tbody className="divide-y">
        {lines.map(([label, amount]) => <tr key={label}><td className="py-2">{label}</td><td className="py-2 text-right tabular-nums">{formatKes(amount)}</td></tr>)}
        <tr className="font-bold"><td className="py-2">Total</td><td className="py-2 text-right tabular-nums">{formatKes(trip.status === "cancelled" ? trip.cancel_fee : trip.total_due)}</td></tr>
      </tbody></table>
      <section className="mt-6">
        <p className="text-xs font-semibold uppercase text-gray-500">Payments</p>
        {paid.length ? <ul className="mt-1 space-y-1">{paid.map((p) => <li key={p.id} className="flex justify-between gap-2"><span>{METHOD[p.method]}{p.receipt ? ` · ${p.receipt}` : ""} · {formatDate(p.paid_at)}{p.purpose === "tip" ? " (tip for the driver)" : ""}</span><span className="tabular-nums">{formatKes(p.amount)}</span></li>)}</ul> : <p className="mt-1 text-gray-600">None yet.</p>}
        <p className="mt-3 font-semibold">{trip.balance > 0 ? `Balance due: ${formatKes(trip.balance)}${trip.credit_due_on ? ` by ${formatDate(trip.credit_due_on)}` : ""}` : "Paid in full. Thank you."}</p>
        {invoice && process.env.VEMI_BANK_DETAILS ? <pre className="mt-2 whitespace-pre-wrap font-sans text-gray-700">{process.env.VEMI_BANK_DETAILS.replace(/\\n/g, "\n")}{"\n"}Reference: {trip.ref}</pre> : null}
      </section>
      <p className="mt-8 text-xs text-gray-500">Vemi Logistics holds your payment and releases it to the carrier after delivery. Questions: reply to any Vemi email or message us on the trip page.</p>
    </article>
  </div>;
}
