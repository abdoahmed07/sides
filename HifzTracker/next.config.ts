import type { NextConfig } from "next";

/**
 * Two builds from one codebase:
 *  - Local (default): `pnpm dev` / `pnpm build && pnpm start`. Includes the
 *    /api/plan-assistant route, so the AI features work.
 *  - GitHub Pages (`STATIC_EXPORT=1 pnpm build:pages`): a static export under
 *    /sides/hifz with no server. Files named *.server.ts are left out, so
 *    the AI route does not exist and the UI hides the AI features.
 */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = isStatic ? process.env.PAGES_BASE_PATH ?? "/sides/hifz" : "";

const nextConfig: NextConfig = {
  ...(isStatic ? { output: "export" as const, trailingSlash: true, basePath } : {}),
  pageExtensions: isStatic ? ["tsx", "ts"] : ["server.ts", "tsx", "ts"],
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_AI_ENABLED: isStatic ? "0" : "1",
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
