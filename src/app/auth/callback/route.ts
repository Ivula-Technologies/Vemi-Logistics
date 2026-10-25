import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(publicUrl(next, request));
  }
  return NextResponse.redirect(publicUrl("/login?error=That%20link%20has%20expired.%20Sign%20in%20again.", request));
}
