import type { MetadataRoute } from "next";
import { webManifest } from "@/lib/web-manifest";

// The customer app. The partner app's manifest is at /partners/manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return webManifest("customer");
}
