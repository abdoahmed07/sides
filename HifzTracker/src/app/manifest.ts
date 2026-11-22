import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Lets phones and computers install Hifz Tracker as an app (home screen icon, full screen, offline). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hifz Tracker",
    short_name: "Hifz",
    description: "Plan, memorize and revise the Quran at a sustainable pace.",
    id: `${base}/`,
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f5f0",
    theme_color: "#2f6b4f",
    categories: ["education", "lifestyle"],
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
