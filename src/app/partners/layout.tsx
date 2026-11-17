import type { Metadata, Viewport } from "next";
import { PORTAL } from "@/lib/portal";

export const metadata: Metadata = {
  title: { default: "Vemi Partner: loads for truck owners in East Africa", template: "%s · Vemi Partner" },
  description: "Vemi Partner is for truck owners, fleets and logistics companies. Find verified loads across Kenya, Uganda, Tanzania and Rwanda, bid your own price and get paid to M-Pesa within 24 hours of delivery.",
  applicationName: "Vemi Partner",
  manifest: PORTAL.partner.manifest,
  appleWebApp: { capable: true, title: "Vemi Partner", statusBarStyle: "default" },
  openGraph: { siteName: "Vemi Partner", images: ["/brand/vemi-mark-256.png"] },
};

export const viewport: Viewport = { themeColor: "#c2410c" };

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
