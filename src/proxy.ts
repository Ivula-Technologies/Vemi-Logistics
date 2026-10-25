import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
export async function proxy(request: NextRequest) { return updateSession(request); }
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|manifest.webmanifest|api/mpesa/callback|api/driver|d/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"] };
