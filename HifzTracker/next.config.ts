import type { NextConfig } from "next";

/**
 * Two builds from one codebase:
 *  - Local (default): `pnpm dev` / `pnpm build && pnpm start`. Includes the
 *    /api/plan-assistant route, so the AI features work.
 *  - GitHub Pages (`STATIC_EXPORT=1 pnpm build:pages`): a static export under
 *    /sides/hifz with no server. Files named *.server.ts are left out, so
 *    the AI route does not exist and the UI hides the AI features.
 *    With NEXT_PUBLIC_MOVED_TO set, it tells people the app has moved there.
 *  - Vercel: the local build, hosted. The AI needs a signed-in account there.
 */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = isStatic ? process.env.PAGES_BASE_PATH ?? "/sides/hifz" : "";
const hasAccounts = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// Hosted builds (Vercel, `pnpm build`) only let signed-in people use the AI, with a daily limit.
// `pnpm dev` doesn't, unless AI_REQUIRE_SIGN_IN=1.
const aiNeedsSignIn = !isStatic && hasAccounts && (process.env.NODE_ENV === "production" || process.env.AI_REQUIRE_SIGN_IN === "1");

const nextConfig: NextConfig = {
  ...(isStatic ? { output: "export" as const, trailingSlash: true, basePath } : {}),
  pageExtensions: isStatic ? ["tsx", "ts"] : ["server.ts", "tsx", "ts"],
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_AI_ENABLED: isStatic ? "0" : "1",
    NEXT_PUBLIC_AI_REQUIRES_SIGN_IN: aiNeedsSignIn ? "1" : "0",
    NEXT_PUBLIC_MOVED_TO: isStatic ? (process.env.NEXT_PUBLIC_MOVED_TO ?? "").replace(/\/+$/, "") : "",
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
