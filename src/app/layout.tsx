import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

const sans = localFont({ src: "./fonts/GeistVF.woff", variable: "--font-sans", weight: "100 900" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Vemi Logistics: book a verified truck in minutes", template: "%s · Vemi Logistics" },
  description: "Vemi matches shippers with verified truck owners across Kenya and East Africa. Post a load, compare bids, pay by M-Pesa and track your goods from Mombasa to Kampala, Kigali and beyond.",
  applicationName: "Vemi",
  openGraph: { siteName: "Vemi Logistics", images: ["/brand/vemi-mark-256.png"] },
  appleWebApp: { capable: true, title: "Vemi", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#fbf9f7" }, { media: "(prefers-color-scheme: dark)", color: "#0f131a" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={sans.variable}>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-center" />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
