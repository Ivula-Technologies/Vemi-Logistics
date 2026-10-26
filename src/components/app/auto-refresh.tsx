"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the page now and then so live trips update without a manual reload. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
