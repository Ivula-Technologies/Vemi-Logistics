import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { storePrivateFile, uploadProblem } from "@/lib/storage";

/** Proof of delivery photo from the driver's phone. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: trip } = await admin.from("trips").select("id, status").eq("driver_token", token).maybeSingle();
  if (!trip) return NextResponse.json({ error: "This trip link is not valid." }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  const problem = uploadProblem(file);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const path = await storePrivateFile("pod", trip.id, file!);
  const { error } = await admin.rpc("driver_attach_pod", { p_token: token, p_path: path });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
