import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export function uploadProblem(file: File | null) {
  if (!file || file.size === 0) return "Choose a file.";
  if (file.size > MAX_UPLOAD_BYTES) return "That file is over 8 MB. Take a smaller photo or scan.";
  if (!TYPES[file.type]) return "Upload a photo (JPG, PNG, WebP) or a PDF.";
  return null;
}

/** Stores a file in a private bucket under folder/ and returns its path. The caller has already checked access. */
export async function storePrivateFile(bucket: "carrier-docs" | "pod", folder: string, file: File) {
  const path = `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}.${TYPES[file.type]}`;
  const { error } = await createAdminClient().storage.from(bucket).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

/** A link that works for 10 minutes. Only call after checking the viewer may see the file. */
export async function signedUrl(bucket: "carrier-docs" | "pod", path: string) {
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUrl(path, 600);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function removePrivateFile(bucket: "carrier-docs" | "pod", path: string) {
  await createAdminClient().storage.from(bucket).remove([path]);
}
