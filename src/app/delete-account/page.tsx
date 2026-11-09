import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Delete your account", description: "How to delete your Vemi account and its data." };

const REQUEST = `mailto:hello@ivulatechnologies.com?subject=${encodeURIComponent("Delete my Vemi account")}&body=${encodeURIComponent("Please delete my Vemi account.\nThe mobile number on my account is: \n")}`;

// Linked from the Google Play listing, which needs a page where people can ask for their account
// to be deleted without opening the app.
export default function DeleteAccountPage() {
  return <LegalPage title="Delete your account" updated="9 November 2026">
    <p>You can ask us to delete your Vemi account at any time. Send the request from the email address you sign in with, or include the mobile number on your account, so we know it&apos;s you.</p>
    <p><a href={REQUEST}>Email hello@ivulatechnologies.com to delete my account</a></p>
    <h2>What happens</h2>
    <ul>
      <li>We confirm by email or SMS and delete your account within 30 days, usually within 2 working days.</li>
      <li>Finish or cancel any open loads and trips first. Money owed to you (a carrier payout or wallet balance) is paid out before we delete the account.</li>
      <li>We delete your profile, trucks, drivers, verification documents, photos, chat messages and phone notification settings.</li>
      <li>We keep trip and payment records for 7 years because Kenyan tax law requires it, and nothing else. Location points are already deleted 12 months after each trip.</li>
    </ul>
    <p>Kiswahili: Unaweza kuomba akaunti yako ya Vemi ifutwe wakati wowote kwa kutuma barua pepe kwa hello@ivulatechnologies.com.</p>
  </LegalPage>;
}
