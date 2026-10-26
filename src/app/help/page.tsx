import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, MessageCircle, Phone, Siren } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Help", description: "Answers for shippers, truck owners and drivers on Vemi Logistics, and how to reach support." };

const SHIPPERS: [string, string][] = [
  ["How is the price set?", "Every load gets a guide price from distance, truck type, borders and stops. Busy lanes and urgent pickups (within 24 hours) cost a little more, and you see the surcharge before you post. Carriers then bid, or you switch on Book now and the first verified truck takes it at your price."],
  ["When do I pay, and how?", "After you accept a bid. Pay by M-Pesa (big trips in parts), card or PayPal, your Vemi wallet, bank transfer, or on account if your business has credit terms. Vemi holds the money and pays the carrier only after you confirm delivery."],
  ["What are the pickup and delivery codes?", "Two 4-digit codes on your trip page. Give the pickup code to whoever loads the truck and the delivery code to the receiver, who tells the driver only after checking the goods. It proves the right truck collected and delivered."],
  ["Can someone else follow the truck?", "Yes. Share the live tracking link from the trip page. It shows the map and arrival time only, no prices or phone numbers. The receiver gets it by SMS automatically when the truck leaves pickup."],
  ["What if I cancel?", "Free until the truck sets off; the money goes back to your Vemi wallet at once and you can cash it out to M-Pesa. Once the truck is on its way to pickup, a small fee goes to the carrier for the wasted trip."],
  ["Something arrived damaged or short", "Tap \"Something is missing or damaged\" on the trip before confirming, add photos and the value. The carrier's payout is held while Vemi sorts it out, usually within 3 working days. With cargo cover, you're covered up to the declared value."],
  ["Extra charges", "If the truck waits more than the free hours at pickup or drop-off, waiting time is added automatically at a fixed hourly rate. Any other extra the carrier asks for needs your approval on the trip page."],
];

const CARRIERS: [string, string][] = [
  ["How do I get verified?", "Add your business details, M-Pesa payout number and documents (ID, KRA PIN, logbook, inspection and goods-in-transit insurance) on your Profile. Vemi checks them within one working day."],
  ["When am I paid?", "To your M-Pesa within 24 hours of the shipper confirming delivery (it confirms itself 48 hours after delivery if the shipper does nothing). Tips go 100% to you. You can ask for a fuel advance once the goods are loaded."],
  ["How do I find return loads?", "Mark a truck as free in Fleet with the town it's in. Vemi texts you loads near it, and Find loads shows return loads from there first."],
  ["What does my driver need?", "Nothing to install. Assign the trip and send the driver link by SMS or WhatsApp. The page is in Kiswahili or English, has directions, the steps to tap, chat, and an SOS button."],
  ["What if I can't do a trip?", "Give it back from the trip page as early as you can. The load goes back on the board. Cancelling after the shipper has paid shows in your reliability score."],
];

const DRIVERS: [string, string][] = [
  ["Ninaanzaje? (How do I start?)", "Fungua kiungo ulichotumiwa na bosi wako. Bonyeza kila hatua: kuelekea kupakia, nimefika, mzigo umepakiwa, naondoka, nimefika, mzigo umefikishwa. Acha ukurasa wazi barabarani."],
  ["Namba ya kupakia na kupokea", "Mtu anayepakia ana namba ya kupakia. Mpokeaji ana namba ya kupokea. Uliza namba hizo kabla ya kubonyeza hatua."],
  ["Dharura (Emergency)", "Bonyeza SOS kwenye ukurasa wa safari. Vemi wanajulishwa mahali ulipo na watakupigia. Polisi na ambulensi: 999 au 112."],
];

export default function HelpPage() {
  const whatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "");
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <Brand />
    <h1 className="mt-8 flex items-center gap-2 text-3xl font-bold"><LifeBuoy className="h-7 w-7 text-primary" />Help</h1>
    <p className="mt-2 text-muted-foreground">The fastest help for a live trip is the chat on the trip page: tap &quot;Get help from Vemi support&quot; and the ops team sees it straight away.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      {whatsapp ? <Button asChild className="bg-[#25d366] text-[#0b3b1f] hover:bg-[#1ebe5b]"><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp Vemi</a></Button> : null}
      {whatsapp ? <Button asChild variant="outline"><a href={`tel:+${whatsapp}`}><Phone className="mr-2 h-4 w-4" />Call Vemi</a></Button> : null}
      {email ? <Button asChild variant="outline"><a href={`mailto:${email}`}>Email {email}</a></Button> : null}
      <Button asChild variant="outline"><Link href="/trips">Open my trips</Link></Button>
    </div>
    <p className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"><Siren className="h-4 w-4 text-destructive" />In an accident or robbery, call 999 or 112 first, then press SOS on the trip page.</p>
    <Section title="For shippers" items={SHIPPERS} />
    <Section title="For truck owners" items={CARRIERS} />
    <Section title="Kwa madereva (for drivers)" items={DRIVERS} />
    <p className="mt-10 text-sm text-muted-foreground">See also the <Link className="font-semibold text-primary" href="/terms">terms</Link> and <Link className="font-semibold text-primary" href="/privacy">privacy notice</Link>.</p>
  </div>;
}

function Section({ title, items }: { title: string; items: [string, string][] }) {
  return <section className="mt-8">
    <h2 className="mb-3 text-lg font-semibold">{title}</h2>
    <div className="divide-y rounded-lg border bg-card">{items.map(([q, a]) => <details key={q} className="group p-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm leading-6 text-muted-foreground">{a}</p></details>)}</div>
  </section>;
}
