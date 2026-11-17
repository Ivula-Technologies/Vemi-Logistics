import { AuthShell } from "@/components/auth/auth-shell";
import { getLang } from "@/lib/i18n-server";

export default async function PartnerAuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell portal="partner" lang={await getLang()}>{children}</AuthShell>;
}
