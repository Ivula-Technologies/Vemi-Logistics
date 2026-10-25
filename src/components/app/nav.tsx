"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, ClipboardList, Gauge, LayoutGrid, LifeBuoy, Map as MapIcon, PackagePlus, Route, Search, Settings, ShieldCheck, Ticket, Truck, UserRound, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

type Item = { href: string; label: string; icon: typeof Gauge; mobile: boolean };

const NAV: Record<Role, Item[]> = {
  shipper: [
    { href: "/home", label: "Home", icon: LayoutGrid, mobile: true },
    { href: "/loads/new", label: "Post load", icon: PackagePlus, mobile: true },
    { href: "/loads", label: "My loads", icon: ClipboardList, mobile: true },
    { href: "/trips", label: "Trips", icon: Route, mobile: true },
    { href: "/wallet", label: "Wallet", icon: Wallet, mobile: false },
    { href: "/business", label: "Business", icon: Building2, mobile: false },
    { href: "/reports", label: "Reports", icon: BarChart3, mobile: false },
    { href: "/profile", label: "Account", icon: UserRound, mobile: true },
    { href: "/help", label: "Help", icon: LifeBuoy, mobile: false },
  ],
  carrier: [
    { href: "/home", label: "Home", icon: LayoutGrid, mobile: true },
    { href: "/board", label: "Find loads", icon: Search, mobile: true },
    { href: "/trips", label: "Trips", icon: Route, mobile: true },
    { href: "/fleet", label: "Fleet", icon: Truck, mobile: true },
    { href: "/earnings", label: "Earnings", icon: Wallet, mobile: false },
    { href: "/profile", label: "Profile", icon: UserRound, mobile: true },
    { href: "/help", label: "Help", icon: LifeBuoy, mobile: false },
  ],
  admin: [
    { href: "/admin", label: "Overview", icon: Gauge, mobile: true },
    { href: "/admin/carriers", label: "Carriers", icon: ShieldCheck, mobile: true },
    { href: "/admin/trips", label: "Trips", icon: Route, mobile: true },
    { href: "/admin/map", label: "Live map", icon: MapIcon, mobile: true },
    { href: "/admin/payouts", label: "Payouts", icon: Wallet, mobile: true },
    { href: "/admin/refunds", label: "Cash-outs", icon: Wallet, mobile: false },
    { href: "/admin/business", label: "Businesses", icon: Building2, mobile: false },
    { href: "/admin/promos", label: "Promo codes", icon: Ticket, mobile: false },
    { href: "/admin/settings", label: "Settings", icon: Settings, mobile: false },
    { href: "/profile", label: "Account", icon: UserRound, mobile: false },
  ],
};

export function NavLinks({ role, mobile = false }: { role: Role; mobile?: boolean }) {
  const pathname = usePathname();
  const items = NAV[role].filter((item) => !mobile || item.mobile);
  // The most specific matching link wins, so /loads/new does not also light up /loads.
  const active = items.map((item) => item.href).filter((href) => pathname === href || pathname.startsWith(`${href}/`)).sort((a, b) => b.length - a.length)[0];
  return <nav aria-label="Main" className={cn(mobile ? "grid" : "space-y-1")} style={mobile ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined}>
    {items.map(({ href, label, icon: Icon }) => {
      const on = href === active;
      return <Link key={href} href={href} aria-current={on ? "page" : undefined} className={cn("flex items-center rounded-md text-sm font-medium transition-colors", mobile ? "flex-col gap-1 px-1 py-2 text-[11px]" : "gap-3 px-3 py-2.5", on ? (mobile ? "text-primary" : "bg-secondary text-foreground") : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
        <Icon className={cn("h-5 w-5", on && "text-primary")} /><span>{label}</span>
      </Link>;
    })}
  </nav>;
}
