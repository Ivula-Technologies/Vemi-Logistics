import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPinned, Smartphone, Timer, Truck, Wallet } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { InstallAppButton } from "@/components/pwa/install-app";
import { PriceCalculator } from "@/components/marketing/price-calculator";
import { getPlaces } from "@/lib/places";
import type { PlaceRow } from "@/lib/types";

export const revalidate = 3600;

const CORRIDORS = [
  ["Northern Corridor", "Mombasa · Nairobi · Malaba/Busia · Kampala · Kigali · Juba"],
  ["Central Corridor", "Dar es Salaam · Dodoma · Isaka · Mwanza · Kigali · Bujumbura"],
  ["Coast and North", "Mombasa · Lamu · Garissa · Isiolo · Moyale"],
  ["Lake and Rift", "Nakuru · Eldoret · Kisumu · Kericho · Kitale"],
];

export default async function Landing() {
  let places: PlaceRow[] = [];
  try { places = await getPlaces(); } catch { /* The calculator is hidden if the database is unreachable. */ }
  return <div className="min-h-screen">
    <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
      <Brand />
      <nav className="flex items-center gap-2"><Button asChild variant="ghost"><Link href="/login">Sign in</Link></Button><Button asChild><Link href="/signup">Get started</Link></Button></nav>
    </header>

    <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-16">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-primary" />Kenya · Uganda · Tanzania · Rwanda and beyond</p>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">Book a verified truck <span className="road-stripe pb-1">in minutes</span>, not days.</h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">Vemi matches shippers with vetted truck owners across East Africa. Post a load, compare bids, pay by M-Pesa, and follow your goods on the map from pickup to delivery.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href="/signup?role=shipper">I need a truck<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/signup?role=carrier"><Truck className="mr-2 h-4 w-4" />I own trucks</Link></Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Free to join. Truck owners keep 90% of every trip (founding carriers keep 95%).</p>
      </div>
      {places.length ? <PriceCalculator places={places} /> : null}
    </section>

    <section className="border-y bg-card">
      <div className="mx-auto grid max-w-6xl gap-px px-4 sm:px-6 md:grid-cols-2">
        <div className="py-12 md:pr-10">
          <h2 className="text-2xl font-bold">For shippers</h2>
          <ul className="mt-6 space-y-5">
            <Point icon={<Timer />} title="Bids in hours">Post once. Verified trucks with the right body type bid, and you choose on price, rating and timing.</Point>
            <Point icon={<BadgeCheck />} title="Every carrier checked">ID, KRA PIN, logbook, NTSA inspection and goods-in-transit insurance, checked by a person before they can bid.</Point>
            <Point icon={<MapPinned />} title="Know where your goods are">Live trip timeline and map, border updates, and a photo of the signed delivery note.</Point>
            <Point icon={<Smartphone />} title="Pay by M-Pesa">The carrier is paid only after you confirm delivery. Bank transfer for big loads.</Point>
          </ul>
        </div>
        <div className="border-t py-12 md:border-l md:border-t-0 md:pl-10">
          <h2 className="text-2xl font-bold">For truck owners</h2>
          <ul className="mt-6 space-y-5">
            <Point icon={<Truck />} title="Fewer empty kilometres">See loads that match your trucks, including return loads from Kampala, Kigali and up-country back to the coast.</Point>
            <Point icon={<Wallet />} title="Paid to M-Pesa in 24 hours">No chasing invoices. Your payout is queued the moment delivery is confirmed.</Point>
            <Point icon={<Smartphone />} title="Drivers need no app">Send a trip link by WhatsApp. They tap each step and snap the delivery note.</Point>
            <Point icon={<BadgeCheck />} title="Ratings that win work">Good trips build your rating, and shippers book well-rated trucks first.</Point>
          </ul>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="text-2xl font-bold">How it works</h2>
      <ol className="mt-6 grid gap-4 md:grid-cols-4">{[
        ["Post", "Route, cargo, truck type and date. See a guide price instantly."],
        ["Compare", "Verified carriers bid. See their rating, base and price."],
        ["Pay", "Book one bid and pay by M-Pesa or bank. The truck is dispatched."],
        ["Track and confirm", "Follow the trip, get the delivery photo, confirm. The carrier is paid."],
      ].map(([title, text], i) => <li key={title} className="rounded-xl border bg-card p-5"><p className="text-sm font-bold text-primary">0{i + 1}</p><p className="mt-2 font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></li>)}</ol>
    </section>

    <section className="bg-[#151a24] text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold">Built for East Africa&apos;s trade routes</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">{CORRIDORS.map(([name, stops]) => <div key={name} className="rounded-xl border border-white/10 p-5"><p className="font-semibold text-[#f6a06a]">{name}</p><p className="mt-1 text-sm text-white/70">{stops}</p></div>)}</div>
        <div className="mt-10 flex flex-wrap gap-3"><Button asChild size="lg"><Link href="/signup">Start free</Link></Button><InstallAppButton variant="secondary" label="Install the app" /></div>
      </div>
    </section>

    <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p>© {new Date().getFullYear()} Vemi Logistics, by Ivula Technologies. Nairobi, Kenya.</p>
      <nav className="flex gap-4"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><a href="mailto:hello@ivulatechnologies.com">Contact</a></nav>
    </footer>
  </div>;
}

function Point({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <li className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-signal-soft text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</span><div><p className="font-semibold">{title}</p><p className="mt-0.5 text-sm text-muted-foreground">{children}</p></div></li>;
}
