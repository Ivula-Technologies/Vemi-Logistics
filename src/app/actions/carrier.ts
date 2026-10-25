"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { carrierSchema, documentKindSchema, driverSchema, truckSchema } from "@/lib/validations";
import { fieldErrors } from "@/lib/forms";
import { removePrivateFile, storePrivateFile, uploadProblem } from "@/lib/storage";
import { notifyOps } from "@/lib/notify";
import type { ActionState } from "@/lib/types";

export async function saveCarrierProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, carrier } = await requireRole("carrier");
  const parsed = carrierSchema.safeParse({
    businessName: formData.get("businessName"), baseTown: formData.get("baseTown") ?? "", crossBorder: formData.get("crossBorder") === "on",
    countries: formData.getAll("countries").map(String), kraPin: formData.get("kraPin") ?? "", idNumber: formData.get("idNumber") ?? "",
    payoutPhone: formData.get("payoutPhone"), payoutName: formData.get("payoutName"),
  });
  if (!parsed.success) return { status: "error", message: "Check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  const countries = input.countries.includes("KE") ? input.countries : ["KE", ...input.countries];
  const supabase = await createClient();
  const details = { business_name: input.businessName, base_town: input.baseTown, cross_border: input.crossBorder || countries.length > 1, countries };
  const { error } = carrier
    ? await supabase.from("carriers").update(details).eq("id", user.id)
    : await supabase.from("carriers").insert({ id: user.id, ...details });
  if (error) return { status: "error", message: error.message };
  const { error: privateError } = await supabase.from("carrier_private").upsert({ carrier_id: user.id, kra_pin: input.kraPin, id_number: input.idNumber, payout_phone: input.payoutPhone, payout_name: input.payoutName });
  if (privateError) return { status: "error", message: privateError.message };
  if (!carrier) after(() => notifyOps("New carrier to verify", `${input.businessName} signed up as a carrier. Check their documents and verify them.`, `/admin/carriers/${user.id}`));
  revalidatePath("/profile");
  revalidatePath("/home");
  return { status: "success", message: carrier ? "Saved." : "Saved. Now add your trucks, drivers and documents so we can verify you." };
}

export async function addTruck(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, carrier } = await requireRole("carrier");
  if (!carrier) return { status: "error", message: "Save your carrier profile first." };
  const parsed = truckSchema.safeParse({ plate: formData.get("plate"), truckType: formData.get("truckType"), capacityTonnes: formData.get("capacityTonnes"), makeModel: formData.get("makeModel") ?? "" });
  if (!parsed.success) return { status: "error", message: "Check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("trucks").insert({ carrier_id: user.id, plate: parsed.data.plate.replace(/\s+/g, " "), truck_type: parsed.data.truckType, capacity_tonnes: parsed.data.capacityTonnes, make_model: parsed.data.makeModel });
  if (error) return { status: "error", message: error.code === "23505" ? "That number plate is already on Vemi. If it is yours, contact support." : error.message };
  revalidatePath("/fleet");
  return { status: "success", message: "Truck added." };
}

export async function addDriver(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, carrier } = await requireRole("carrier");
  if (!carrier) return { status: "error", message: "Save your carrier profile first." };
  const parsed = driverSchema.safeParse({ fullName: formData.get("fullName"), phone: formData.get("phone"), licenceNo: formData.get("licenceNo") ?? "" });
  if (!parsed.success) return { status: "error", message: "Check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("drivers").insert({ carrier_id: user.id, full_name: parsed.data.fullName, phone: parsed.data.phone, licence_no: parsed.data.licenceNo });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/fleet");
  return { status: "success", message: "Driver added." };
}

export async function toggleFleetItem(formData: FormData) {
  await requireRole("carrier");
  const table = formData.get("kind") === "driver" ? "drivers" : "trucks";
  const supabase = await createClient();
  await supabase.from(table).update({ active: formData.get("active") === "true" }).eq("id", String(formData.get("id")));
  revalidatePath("/fleet");
}

export async function uploadDocument(formData: FormData) {
  const { user, carrier } = await requireRole("carrier");
  if (!carrier) redirect("/profile?error=" + encodeURIComponent("Save your carrier profile first."));
  const kind = documentKindSchema.safeParse(formData.get("kind"));
  const file = formData.get("file") as File | null;
  const problem = !kind.success ? "Choose the document type." : uploadProblem(file);
  if (problem) redirect("/profile?error=" + encodeURIComponent(problem) + "#documents");
  const path = await storePrivateFile("carrier-docs", user.id, file!);
  const expires = String(formData.get("expiresOn") ?? "");
  // Inserts go through the service key: storage paths are only ever written by the server.
  const { error } = await createAdminClient().from("carrier_documents").insert({ carrier_id: user.id, kind: kind.data, path, file_name: file!.name.slice(0, 120), expires_on: /^\d{4}-\d{2}-\d{2}$/.test(expires) ? expires : null });
  if (error) { await removePrivateFile("carrier-docs", path); redirect("/profile?error=" + encodeURIComponent(error.message) + "#documents"); }
  revalidatePath("/profile");
  redirect("/profile?saved=document#documents");
}

export async function deleteDocument(formData: FormData) {
  const { user } = await requireRole("carrier");
  const supabase = await createClient();
  const { data } = await supabase.from("carrier_documents").delete().eq("id", String(formData.get("id"))).eq("carrier_id", user.id).select("path").maybeSingle();
  if (data?.path) await removePrivateFile("carrier-docs", data.path);
  revalidatePath("/profile");
  redirect("/profile#documents");
}
