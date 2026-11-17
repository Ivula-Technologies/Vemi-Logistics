import { webManifest } from "@/lib/web-manifest";

export const dynamic = "force-static";

export function GET() {
  return Response.json(webManifest("partner"), { headers: { "Content-Type": "application/manifest+json" } });
}
