import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vemi Logistics",
    short_name: "Vemi",
    description: "Book verified trucks across Kenya and East Africa. Post loads, bid, pay by M-Pesa and track every trip.",
    start_url: "/home?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#151a24",
    theme_color: "#151a24",
    categories: ["business", "productivity", "travel"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Post a load", url: "/loads/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Find loads", url: "/board", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My trips", url: "/trips", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
