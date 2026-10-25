import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const ref = (url.searchParams.get("ref") ?? "").replace(/[^A-Z0-9]/gi, "").slice(0, 7);
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // First Google sign-in: choose shipper or carrier (keeping any referral code) before anything else.
      const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", data.user.id).maybeSingle();
      if (profile && !profile.onboarded) return NextResponse.redirect(publicUrl(`/welcome${ref ? `?ref=${ref}` : ""}`, request));
      return NextResponse.redirect(publicUrl(next, request));
    }
  }
  return NextResponse.redirect(publicUrl("/login?error=That%20link%20has%20expired.%20Sign%20in%20again.", request));
}
