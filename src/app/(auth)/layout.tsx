import { AuthShell } from "@/components/auth/auth-shell";
import { getLang } from "@/lib/i18n-server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell portal="customer" lang={await getLang()}>{children}</AuthShell>;
}
