"use client";
import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareDriverLink({ url, driverPhone, tripRef }: { url: string; driverPhone: string | null; tripRef: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Vemi trip ${tripRef}: open this link for pickup details and to update the trip as you go: ${url}`;
  return <div className="flex flex-col gap-2 sm:flex-row">
    {driverPhone ? <Button asChild className="bg-[#25d366] text-[#0b3b1f] hover:bg-[#1ebe5b]"><a href={`https://wa.me/${driverPhone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Send to driver on WhatsApp</a></Button> : null}
    <Button type="button" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { window.prompt("Copy the driver link", url); } }}><Copy className="mr-2 h-4 w-4" />{copied ? "Copied" : "Copy link"}</Button>
  </div>;
}

/** The receiver's live tracking link (Uber's "Share my trip"): no phone numbers, no money, just the truck. */
export function ShareTrackingLink({ url, phone, tripRef }: { url: string; phone: string | null; tripRef: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Follow Vemi trip ${tripRef} live: ${url}`;
  return <div className="flex flex-wrap gap-2">
    <Button type="button" size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { window.prompt("Copy the tracking link", url); } }}><Copy className="mr-2 h-4 w-4" />{copied ? "Copied" : "Copy tracking link"}</Button>
    <Button asChild size="sm" variant="outline"><a href={`https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Share on WhatsApp</a></Button>
  </div>;
}
