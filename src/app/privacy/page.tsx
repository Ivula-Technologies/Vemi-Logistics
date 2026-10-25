import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return <LegalPage title="Privacy notice" updated="25 October 2026">
    <p>Ivula Technologies runs Vemi and is the data controller under Kenya&apos;s Data Protection Act, 2019.</p>
    <h2>What we collect</h2>
    <ul><li>Account details: name, company, email, mobile number.</li><li>Carriers: KRA PIN, ID number, M-Pesa payout number, vehicle and driver details, and the documents you upload for verification.</li><li>Loads and trips: routes, cargo, prices, contacts at pickup and drop-off, status updates and delivery photos.</li><li>Location: a driver&apos;s phone location, only while the driver&apos;s trip page is open and the trip is moving, at most once a minute.</li><li>Payments: M-Pesa and bank references. We never see M-Pesa PINs.</li></ul>
    <h2>Why</h2>
    <p>To run the marketplace: verify carriers, match loads, take payments, pay carriers, show trip progress, resolve disputes, prevent fraud, and meet tax and legal duties.</p>
    <h2>Who sees what</h2>
    <p>Before a trip is paid, shippers see a carrier&apos;s business name and rating only, and carriers see the load without contact details. Once paid, the shipper and the carrier see each other&apos;s names and phone numbers, the driver and the truck, and the pickup and drop-off contacts. Verification documents are seen only by the carrier and Vemi staff. Our providers (Supabase for hosting the database, Safaricom for M-Pesa, Resend for email and Africa&apos;s Talking for SMS) process data for us under contract.</p>
    <h2>How long</h2>
    <p>Trip and payment records are kept for 7 years for tax purposes. Location points are deleted 12 months after a trip ends. You can ask us to close your account and delete what the law does not require us to keep.</p>
    <h2>Your rights</h2>
    <p>You can ask to see, correct or delete your data, or object to how we use it, by emailing hello@ivulatechnologies.com. You can also complain to the Office of the Data Protection Commissioner.</p>
  </LegalPage>;
}
