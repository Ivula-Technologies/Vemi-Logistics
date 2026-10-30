import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removePrivateFile, storePrivateFile, uploadProblem } from "@/lib/storage";
import { BORDER_PAPER_KINDS } from "@/lib/trips";

/** The driver adds a border paper on the way: a seal number, a photo of stamped papers, or both. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: trip } = await admin.from("trips").select("id").eq("driver_token", token).maybeSingle();
  if (!trip) return NextResponse.json({ error: "This trip link is not valid." }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const kind = String(form?.get("kind") ?? "");
  const reference = String(form?.get("reference") ?? "").trim().slice(0, 80);
  const raw = form?.get("file");
  const file = raw instanceof File && raw.size > 0 ? raw : null;
  if (!(BORDER_PAPER_KINDS as string[]).includes(kind)) return NextResponse.json({ error: "Choose which paper this is." }, { status: 400 });
  if (!reference && !file) return NextResponse.json({ error: "Add a number or a photo." }, { status: 400 });
  const problem = file ? uploadProblem(file) : null;
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const path = file ? await storePrivateFile("trip-docs", trip.id, file) : null;
  const { error } = await admin.rpc("driver_add_trip_document", { p_token: token, p_kind: kind, p_reference: reference || null, p_path: path });
  if (error) {
    if (path) await removePrivateFile("trip-docs", path);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
