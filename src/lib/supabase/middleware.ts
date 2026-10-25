import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { publicUrl } from "@/lib/site-url";

const protectedPrefixes = ["/home", "/loads", "/board", "/trips", "/fleet", "/profile", "/earnings", "/admin", "/wallet", "/business", "/reports", "/welcome"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabasePublicEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    const loginUrl = publicUrl("/login", request);
    loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  if (user && (path === "/login" || path === "/signup")) {
    return NextResponse.redirect(publicUrl("/home", request));
  }
  return response;
}
