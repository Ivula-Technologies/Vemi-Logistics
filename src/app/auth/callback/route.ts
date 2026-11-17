import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";
import { PORTAL_COOKIE, portalFromCookie } from "@/lib/portal";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const ref = (url.searchParams.get("ref") ?? "").replace(/[^A-Z0-9]/gi, "").slice(0, 7);
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // First Google sign-in: finish the account (keeping any referral code) before anything else. The portal the
      // person signed up through decides the account type: Vemi Partner makes a carrier, Vemi makes a shipper.
      const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", data.user.id).maybeSingle();
      if (profile && !profile.onboarded) {
        const role = portalFromCookie(request.cookies.get(PORTAL_COOKIE)?.value) === "partner" ? "carrier" : "shipper";
        return NextResponse.redirect(publicUrl(`/welcome?role=${role}${ref ? `&ref=${ref}` : ""}`, request));
      }
      return NextResponse.redirect(publicUrl(next, request));
    }
  }
  return NextResponse.redirect(publicUrl("/login?error=That%20link%20has%20expired.%20Sign%20in%20again.", request));
}
