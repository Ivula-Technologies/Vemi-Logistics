/** Upload limit the browser checks before sending. Vercel functions take at most 4.5 MB per request. */
export const CLIENT_MAX_UPLOAD_BYTES = (process.env.NEXT_PUBLIC_VERCEL_ENV ? 4 : 8) * 1024 * 1024;

const MAX_SIDE = 1920;

/**
 * Phone cameras save 3-8 MB photos. Scale big ones down to 1920 px JPEG in the browser so they upload fast on
 * mobile data and fit the host's request limit. PDFs, small images and anything the browser can't decode pass through.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 900 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
