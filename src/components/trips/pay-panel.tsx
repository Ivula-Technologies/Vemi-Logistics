"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, LoaderCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKes } from "@/lib/utils";

/**
 * M-Pesa STK push: send the prompt, then poll until Safaricom says paid or failed.
 * With maxAmount the shipper can pay part of a big trip (pay in parts); purpose "tip" sends a tip for the driver.
 */
export function MpesaPay({ tripId, amount, defaultPhone, disabledReason, maxAmount, purpose = "trip" }: { tripId: string; amount: number; defaultPhone: string; disabledReason?: string; maxAmount?: number; purpose?: "trip" | "tip" }) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone);
  const [chosen, setChosen] = useState(String(amount));
  const editable = purpose === "tip" || maxAmount !== undefined;
  const value = editable ? Number.parseInt(chosen, 10) || 0 : amount;
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!paymentId) return;
    let stopped = false;
    let tries = 0;
    const tick = async () => {
      if (stopped) return;
      tries += 1;
      const res = await fetch(`/api/mpesa/status?paymentId=${paymentId}`, { cache: "no-store" }).catch(() => null);
      const data = res ? await res.json().catch(() => null) as { status?: string; message?: string } | null : null;
      if (data?.status === "paid") { setMessage(purpose === "tip" ? "Tip sent. The driver's team gets all of it. Asante!" : "Payment received. Thank you!"); setPaymentId(null); router.refresh(); return; }
      if (data?.status === "failed") { setError(data.message || "The payment was not completed. Try again."); setMessage(null); setPaymentId(null); return; }
      if (tries > 40) { setMessage("Still waiting for M-Pesa. If you paid, this page updates by itself within a few minutes."); return; }
      window.setTimeout(tick, 4000);
    };
    const first = window.setTimeout(tick, 5000);
    return () => { stopped = true; window.clearTimeout(first); };
  }, [paymentId, router, purpose]);

  async function pay() {
    setBusy(true); setError(null); setMessage(null);
    const res = await fetch("/api/mpesa/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId, phone, purpose, amount: editable ? value : undefined }) }).catch(() => null);
    const data = res ? await res.json().catch(() => null) as { paymentId?: string; message?: string; error?: string } | null : null;
    setBusy(false);
    if (!res?.ok || !data?.paymentId) { setError(data?.error ?? "Could not reach M-Pesa. Check your connection and try again."); return; }
    setPaymentId(data.paymentId);
    setMessage(data.message ?? "Check your phone and enter your M-Pesa PIN.");
  }

  if (disabledReason) return <p className="text-sm text-muted-foreground">{disabledReason}</p>;
  return <div className="space-y-3">
    <div className="space-y-1.5"><Label htmlFor={`mpesaPhone-${purpose}`}>M-Pesa number</Label><Input id={`mpesaPhone-${purpose}`} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" /></div>
    {editable ? <div className="space-y-1.5"><Label htmlFor={`mpesaAmount-${purpose}`}>{purpose === "tip" ? "Tip (KES)" : `Amount this time (up to ${formatKes(maxAmount)})`}</Label><Input id={`mpesaAmount-${purpose}`} type="number" inputMode="numeric" min={purpose === "tip" ? 50 : 10} max={maxAmount} value={chosen} onChange={(e) => setChosen(e.target.value)} />
      {purpose === "tip" ? <div className="flex gap-2">{[200, 500, 1000].map((n) => <Button key={n} type="button" size="sm" variant="outline" onClick={() => setChosen(String(n))}>{formatKes(n)}</Button>)}</div> : null}</div> : null}
    <Button type="button" className="w-full bg-[#2e9e47] text-white hover:bg-[#278a3d]" onClick={pay} disabled={busy || Boolean(paymentId)}>
      {busy || paymentId ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
      {paymentId ? "Waiting for your PIN…" : purpose === "tip" ? `Tip ${formatKes(value)} with M-Pesa` : `Pay ${formatKes(value)} with M-Pesa`}
    </Button>
    {message ? <p role="status" className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">{message}</p> : null}
    {error ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
  </div>;
}

/** Card or PayPal: PayPal's own page takes the card, then sends the shipper back to the trip. */
export function CardPay({ tripId, usd }: { tripId: string; usd: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pay() {
    setBusy(true); setError(null);
    const res = await fetch("/api/paypal/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId }) }).catch(() => null);
    const data = res ? await res.json().catch(() => null) as { approveUrl?: string; error?: string } | null : null;
    if (!res?.ok || !data?.approveUrl) { setBusy(false); setError(data?.error ?? "Could not reach PayPal. Try again."); return; }
    window.location.href = data.approveUrl;
  }
  return <div className="space-y-2">
    <Button type="button" variant="outline" className="w-full" onClick={pay} disabled={busy}>{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}Pay about US${usd.toFixed(2)} by card or PayPal</Button>
    {error ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
  </div>;
}
