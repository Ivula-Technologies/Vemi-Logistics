import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrl } from "@/lib/storage";

/** Opens a border paper from the driver's trip link, only if it belongs to that trip. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const admin = createAdminClient();
  const { data: trip } = await admin.from("trips").select("id").eq("driver_token", token).maybeSingle();
  if (!trip) return NextResponse.json({ error: "This trip link is not valid." }, { status: 404 });
  const { data: paper } = await admin.from("trip_documents").select("path").eq("id", id).eq("trip_id", trip.id).maybeSingle();
  const url = paper?.path ? await signedUrl("trip-docs", paper.path) : null;
  if (!url) return NextResponse.json({ error: "File not found." }, { status: 404 });
  return NextResponse.redirect(url);
}
