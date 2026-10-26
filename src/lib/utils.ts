import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "KES 285,000". Whole shillings only: Vemi never prices in cents. */
export function formatKes(amount: number | string | null | undefined) {
  if (amount === null || amount === undefined || amount === "") return "—";
  return `KES ${Math.round(Number(amount)).toLocaleString("en-KE")}`;
}

/** Dates show in East Africa Time, whatever the server's clock is set to. */
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(value));
}

/** Today's date in Kenya as YYYY-MM-DD, for date inputs and pickup checks. */
export function eatToday(now = new Date()) {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function safeNextPath(value: FormDataEntryValue | string | null | undefined, fallback = "/home") {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "V";
}

export function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
