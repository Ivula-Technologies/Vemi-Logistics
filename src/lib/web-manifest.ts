import type { MetadataRoute } from "next";
import type { Portal } from "@/lib/portal";

const icons: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];
const shortcutIcon = [{ src: "/icons/icon-192.png", sizes: "192x192" }];

/** The installable app for each portal: "Vemi" for customers, "Vemi Partner" for truck owners. */
export function webManifest(portal: Portal): MetadataRoute.Manifest {
  const common = { scope: "/", display: "standalone", orientation: "portrait", background_color: "#151a24", icons } as const;
  if (portal === "partner") {
    return {
      ...common,
      id: "/partners",
      name: "Vemi Partner",
      short_name: "Vemi Partner",
      description: "For truck owners and logistics companies: find loads across East Africa, bid, run trips and get paid to M-Pesa.",
      start_url: "/partners/login?source=app",
      theme_color: "#c2410c",
      categories: ["business", "productivity"],
      shortcuts: [
        { name: "Find loads", url: "/board", icons: shortcutIcon },
        { name: "My trips", url: "/trips", icons: shortcutIcon },
        { name: "Earnings", url: "/earnings", icons: shortcutIcon },
      ],
    };
  }
  return {
    ...common,
    id: "/",
    name: "Vemi Logistics",
    short_name: "Vemi",
    description: "Book verified trucks across Kenya and East Africa. Post loads, compare bids, pay by M-Pesa and track every trip.",
    start_url: "/home?source=app",
    theme_color: "#151a24",
    categories: ["business", "productivity", "travel"],
    shortcuts: [
      { name: "Post a load", url: "/loads/new", icons: shortcutIcon },
      { name: "My loads", url: "/loads", icons: shortcutIcon },
      { name: "My trips", url: "/trips", icons: shortcutIcon },
    ],
  };
}
