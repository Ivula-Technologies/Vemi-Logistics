import { LogOut } from "lucide-react";
import { Brand } from "@/components/brand";
import { NavLinks } from "@/components/app/nav";
import { InstallAppBanner } from "@/components/pwa/install-app";
import { getSession } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

const ROLE_LABEL = { shipper: "Shipper", carrier: "Carrier", admin: "Vemi ops" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, carrier } = await getSession();
  const name = profile.role === "carrier" ? carrier?.business_name ?? profile.full_name : profile.company || profile.full_name;
  const home = profile.role === "admin" ? "/admin" : "/home";
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r bg-card lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b px-5"><Brand href={home} /></div>
      <div className="flex-1 p-3"><NavLinks role={profile.role} /></div>
      <div className="border-t p-4 text-sm">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABEL[profile.role]}</p>
        <form action={signOut} className="mt-3"><button className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" />Sign out</button></form>
      </div>
    </aside>
    <div className="min-w-0 lg:col-start-2">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
        <Brand href={home} />
        <form action={signOut}><button aria-label="Sign out" className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-secondary"><LogOut className="h-4 w-4" /></button></form>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"><NavLinks role={profile.role} mobile /></div>
    <InstallAppBanner />
  </div>;
}
