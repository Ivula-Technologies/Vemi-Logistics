// Vemi has two front doors on one site:
//  - the customer portal (/, /login, /signup) for businesses that need goods moved, and
//  - the partner portal (/partners, /partners/login, /partners/signup) for truck owners, fleets and
//    other logistics service providers.
// Both sign in to the same accounts; the role on the profile decides which screens a person sees.
// The vemi_portal cookie remembers the last front door used, so sign-in prompts and sign-out land
// people back where they came from.

export type Portal = "customer" | "partner";

export const PORTAL_COOKIE = "vemi_portal";

export const PORTAL = {
  customer: { name: "Vemi Logistics", label: "Logistics", home: "/", login: "/login", signup: "/signup", manifest: "/manifest.webmanifest" },
  partner: { name: "Vemi Partner", label: "Partner", home: "/partners", login: "/partners/login", signup: "/partners/signup", manifest: "/partners/manifest.webmanifest" },
} as const;

export function portalForRole(role: string | null | undefined): Portal {
  return role === "carrier" ? "partner" : "customer";
}

export function portalFromCookie(value: string | null | undefined): Portal {
  return value === "partner" ? "partner" : "customer";
}

export function portalForPath(path: string): Portal | null {
  if (path === "/partners" || path.startsWith("/partners/")) return "partner";
  if (path === "/login" || path === "/signup") return "customer";
  return null;
}

/** Where /signup?role=carrier now goes: the partner sign-up, keeping the referral code and return path. */
export function partnerSignupUrl(params: { ref?: string; next?: string }) {
  const query = new URLSearchParams();
  if (params.ref) query.set("ref", params.ref);
  if (params.next) query.set("next", params.next);
  const qs = query.toString();
  return `${PORTAL.partner.signup}${qs ? `?${qs}` : ""}`;
}
