import "server-only";
/**
 * Who may use the assistant. On the hosted app every message costs the owner
 * money, so it needs a signed-in account and counts against a daily limit
 * (supabase/ai-usage.sql). Locally (`pnpm dev`) this is off unless
 * AI_REQUIRE_SIGN_IN=1, so development doesn't need an account.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Same rule the browser uses (set in next.config.ts). */
export const SIGN_IN_REQUIRED = process.env.NEXT_PUBLIC_AI_REQUIRES_SIGN_IN === "1";

export function dailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 30;
}

export type Access = { ok: true; userId: string | null } | { ok: false; code: "sign_in_required" | "daily_limit" | "upstream_error"; message: string; status: number };

export async function checkAccess(authorization: string | null): Promise<Access> {
  if (!SIGN_IN_REQUIRED) return { ok: true, userId: null };
  if (!URL || !KEY) return { ok: false, code: "upstream_error", message: "Accounts aren't set up on the server.", status: 503 };
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { ok: false, code: "sign_in_required", message: "Sign in to use the assistant.", status: 401 };

  // Acts as the person: the token is checked by Supabase, and the usage function only counts their own messages.
  const sb = createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: user, error: userError } = await sb.auth.getUser(token);
  if (userError || !user.user) return { ok: false, code: "sign_in_required", message: "Your sign-in has expired. Sign in again.", status: 401 };

  const limit = dailyLimit();
  const { data: count, error } = await sb.rpc("hifz_ai_take", { p_limit: limit });
  if (error) {
    console.error("hifz_ai_take failed:", error.message);
    return { ok: false, code: "upstream_error", message: "Couldn't check your daily limit. Try again shortly.", status: 503 };
  }
  if (count === null)
    return { ok: false, code: "daily_limit", message: `You've used today's ${limit} assistant messages. It resets at midnight (UTC).`, status: 429 };
  return { ok: true, userId: user.user.id };
}
