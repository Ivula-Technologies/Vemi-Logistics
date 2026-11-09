import { assetLinks } from "@/lib/android-app";

// Read at request time, so a fingerprint added on Vercel works after a redeploy.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(assetLinks(), { headers: { "Cache-Control": "public, max-age=3600" } });
}
