"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const DISMISSED_KEY = "vemi-install-dismissed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

const noSubscription = () => () => undefined;

function subscribeDisplayMode(onChange: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => { query.removeEventListener("change", onChange); window.removeEventListener("appinstalled", onChange); };
}

let dismissedThisVisit = false;

function readDismissed() {
  if (dismissedThisVisit) return true;
  try { return localStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
}

function subscribeDismissed(onChange: () => void) {
  window.addEventListener(DISMISSED_KEY, onChange);
  return () => window.removeEventListener(DISMISSED_KEY, onChange);
}

/** Tracks whether the app can be installed: Android/desktop Chrome give a prompt, iPhone needs Share → Add to Home Screen. */
function useInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  // The server renders as "installed" so nothing flashes before the browser is checked.
  const ios = useSyncExternalStore(noSubscription, isIos, () => false);
  const installed = useSyncExternalStore(subscribeDisplayMode, isStandalone, () => true);
  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  async function install() {
    if (!prompt) return false;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
    return true;
  }
  return { canPrompt: Boolean(prompt), ios, installed, install };
}

function IosSteps({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add Vemi to your home screen</DialogTitle><DialogDescription>It opens full screen, like any other app.</DialogDescription></DialogHeader><ol className="list-decimal space-y-2 pl-5 text-sm"><li>Open this page in Safari.</li><li>Tap the Share button <Share className="inline h-4 w-4 align-text-bottom" aria-label="Share" /> at the bottom of the screen.</li><li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li></ol></DialogContent></Dialog>;
}

/** A button for the landing page and Settings. Hidden once the app is installed or can't be installed. */
export function InstallAppButton({ className, variant = "outline", label = "Get the app" }: { className?: string; variant?: "outline" | "default" | "secondary"; label?: string }) {
  const { canPrompt, ios, installed, install } = useInstall();
  const [steps, setSteps] = useState(false);
  if (installed || (!canPrompt && !ios)) return null;
  return <><Button type="button" variant={variant} className={className} onClick={() => (canPrompt ? void install() : setSteps(true))}><Download className="mr-2 h-4 w-4" />{label}</Button><IosSteps open={steps} onOpenChange={setSteps} /></>;
}

/** A dismissible banner on phones inside the app, above the bottom navigation. */
export function InstallAppBanner() {
  const { canPrompt, ios, installed, install } = useInstall();
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true);
  const [steps, setSteps] = useState(false);
  function dismiss() { dismissedThisVisit = true; try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* private mode */ } window.dispatchEvent(new Event(DISMISSED_KEY)); }
  if (installed || dismissed || (!canPrompt && !ios)) return null;
  return <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-lg border bg-card p-3 shadow-lg lg:hidden">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-md" />
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Get the Vemi app</p><p className="text-xs text-muted-foreground">Loads, trips and payments one tap away.</p></div>
    <Button size="sm" onClick={async () => { if (canPrompt) { if (await install()) dismiss(); } else setSteps(true); }}>Install</Button>
    <button type="button" aria-label="Not now" onClick={dismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
    <IosSteps open={steps} onOpenChange={setSteps} />
  </div>;
}
