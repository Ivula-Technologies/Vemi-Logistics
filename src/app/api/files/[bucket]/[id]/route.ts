import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";

/**
 * Opens a private file after checking, through the viewer's own session, that they may see it:
 *   /api/files/doc/<document id>         carrier documents (the carrier and admins)
 *   /api/files/pod/<trip id>             proof of delivery (the trip's shipper, carrier and admins)
 *   /api/files/dispute/<trip id>?i=0     damage photos on a dispute (the same people)
 *   /api/files/truck/<truck id>          truck photo (the carrier, admins, and shippers of its trips)
 *   /api/files/driver/<driver id>        driver photo (the carrier, admins, and shippers of live trips)
 *   /api/files/paper/<trip document id>  border papers (the trip's shipper, carrier and admins)
 */
export async function GET(request: Request, { params }: { params: Promise<{ bucket: string; id: string }> }) {
  const { bucket, id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  let url: string | null = null;
  if (bucket === "doc") {
    const { data } = await supabase.from("carrier_documents").select("path").eq("id", id).maybeSingle();
    if (data) url = await signedUrl("carrier-docs", data.path);
  } else if (bucket === "pod") {
    const { data } = await supabase.from("trips").select("pod_path").eq("id", id).maybeSingle();
    if (data?.pod_path) url = await signedUrl("pod", data.pod_path);
  } else if (bucket === "dispute") {
    const index = Number.parseInt(new URL(request.url).searchParams.get("i") ?? "0", 10);
    const { data } = await supabase.from("trips").select("dispute_files").eq("id", id).maybeSingle();
    const path = data?.dispute_files?.[index];
    if (path) url = await signedUrl("pod", path);
  } else if (bucket === "paper") {
    const { data } = await supabase.from("trip_documents").select("path").eq("id", id).maybeSingle();
    if (data?.path) url = await signedUrl("trip-docs", data.path);
  } else if (bucket === "truck" || bucket === "driver") {
    const { data } = await supabase.from(bucket === "truck" ? "trucks" : "drivers").select("photo_path").eq("id", id).maybeSingle();
    if (data?.photo_path) url = await signedUrl("photos", data.photo_path);
  }
  if (!url) return NextResponse.json({ error: "File not found." }, { status: 404 });
  return NextResponse.redirect(url);
}
