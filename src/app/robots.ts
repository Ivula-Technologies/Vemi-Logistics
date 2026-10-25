import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: ["/", "/signup", "/terms", "/privacy"], disallow: ["/d/", "/api/", "/admin", "/trips", "/loads", "/board"] }] };
}
