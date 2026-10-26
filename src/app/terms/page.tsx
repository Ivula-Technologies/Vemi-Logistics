import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms" };

// Draft for review by a Kenyan advocate before launch (see the plan, section 5).
export default function TermsPage() {
  return <LegalPage title="Terms of service" updated="25 October 2026">
    <p>Vemi Logistics (&quot;Vemi&quot;) is run by Ivula Technologies, Nairobi, Kenya. By using Vemi you agree to these terms.</p>
    <h2>1. What Vemi does</h2>
    <p>Vemi arranges road freight. A shipper books a trip through Vemi at the agreed price, and Vemi subcontracts the trip to an independent, verified carrier. Vemi collects the trip price from the shipper and pays the carrier after delivery, less Vemi&apos;s commission.</p>
    <h2>2. Shippers</h2>
    <ul><li>Describe the goods, weight and packing truthfully. Overweight loads break the EAC Vehicle Load Control Act and are refused.</li><li>No prohibited, illegal, hazardous (without permits), or undeclared goods, no live animals, and no cash or valuables unless agreed in writing.</li><li>You are responsible for export, import and transit documents and for your clearing agent.</li><li>Pay before dispatch. Confirm delivery or report a problem within 48 hours of the driver marking the trip delivered; after that the delivery is treated as accepted.</li></ul>
    <h2>3. Carriers</h2>
    <ul><li>Keep your vehicle roadworthy, inspected, insured (including goods-in-transit cover) and licensed, and your drivers properly licensed. Tell Vemi when any document changes or expires.</li><li>Only accept loads your truck can legally carry. Deliver on time, with care, and keep the shipper informed through Vemi.</li><li>Commission is shown on every bid before you send it (10% standard, 5% for founding carriers for their first 90 days). Payouts go to the M-Pesa number on your profile.</li><li>Do not take a Vemi customer&apos;s trip off the platform within 12 months of meeting them through Vemi.</li></ul>
    <h2>4. Loss, damage and disputes</h2>
    <p>Claims for loss or damage are made first against the carrier and the carrier&apos;s goods-in-transit insurance. While a dispute is open the carrier&apos;s payout is held. Vemi investigates and decides in good faith. Vemi&apos;s own liability is limited to the commission it earned on the trip, except where the law does not allow this limit.</p>
    <h2>5. Cancellations</h2>
    <p>A shipper may cancel a booking free of charge before paying. After payment, cancellations go through Vemi support; a carrier who has already travelled to pickup may be paid a fair cancellation fee from the trip price.</p>
    <h2>6. Accounts</h2>
    <p>Keep your login safe. Vemi may suspend accounts that break these terms or the law, or that give false documents.</p>
    <h2>7. Law</h2>
    <p>These terms are governed by the laws of Kenya. Disputes go first to good-faith negotiation, then to the courts of Kenya.</p>
    <p>Questions: hello@ivulatechnologies.com</p>
  </LegalPage>;
}
