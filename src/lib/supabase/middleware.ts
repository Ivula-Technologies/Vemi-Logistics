import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv, hasSupabasePublicEnv } from "@/lib/supabase/env";
import { publicUrl } from "@/lib/site-url";

const protectedPrefixes = ["/home", "/loads", "/board", "/trips", "/fleet", "/profile", "/earnings", "/admin", "/wallet", "/business", "/reports", "/welcome"];

// Pages that work without the database, so the site still opens before Supabase is connected.
const pagesWithoutDatabase = ["/", "/help", "/privacy", "/terms", "/manifest.webmanifest", "/robots.txt", "/api/health"];

// Shown instead of a crash while the Supabase keys are not set on the server yet.
function notReadyPage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vemi is getting ready</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#fbf9f7;color:#1c2333;padding:16px}
main{max-width:420px;text-align:center}h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#5d6370;line-height:1.5}a{color:#df5a0c;font-weight:600}</style></head>
<body><main><h1>Vemi is getting ready</h1><p>We are switching on accounts and bookings. Please try again in a little while.</p><p><a href="/">Back to the home page</a></p></main></body></html>`;
  return new NextResponse(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "600", "cache-control": "no-store" } });
}

export async function updateSession(request: NextRequest) {
  if (!hasSupabasePublicEnv()) {
    const path = request.nextUrl.pathname;
    if (pagesWithoutDatabase.includes(path) || path.startsWith("/download/")) return NextResponse.next({ request });
    console.error("Supabase keys are not set: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
    return notReadyPage();
  }
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
