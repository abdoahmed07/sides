"use client";
import type { AssistantRequest, AssistantResponse } from "@/ai/schemas";

export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "1";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const FRIENDLY: Record<string, string> = {
  timeout: "The assistant is taking too long. Try again, or edit the plan by hand.",
  rate_limited: "You've sent a lot of requests. Give it a few minutes, or edit the plan by hand.",
  upstream_rate_limited: "The AI service is busy. Try again shortly, or edit the plan by hand.",
  not_configured: "AI isn't set up yet: add ANTHROPIC_API_KEY to .env.local and restart. You can still edit the plan by hand.",
  invalid_output: "The assistant gave an answer the app couldn't use, so nothing was changed. Try rephrasing, or edit by hand.",
  refused: "The assistant couldn't help with that. You can edit the plan by hand.",
  too_long: "That message is too long. Try something shorter.",
  network: "Couldn't reach the assistant. Check that the app is running locally, or edit the plan by hand.",
};

export async function askAssistant(req: AssistantRequest, timeoutMs = 90_000): Promise<AssistantResponse> {
  if (!AI_ENABLED) return { ok: false, error: { code: "not_configured", message: "AI is only available when running the app locally." } };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api/plan-assistant`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => null)) as AssistantResponse | null;
    if (!json) return { ok: false, error: { code: "upstream_error", message: FRIENDLY.network } };
    if (!json.ok) return { ok: false, error: { code: json.error.code, message: FRIENDLY[json.error.code] ?? json.error.message } };
    return json;
  } catch (e) {
    const timeout = (e as Error).name === "AbortError";
    return { ok: false, error: { code: timeout ? "timeout" : "upstream_error", message: timeout ? FRIENDLY.timeout : FRIENDLY.network } };
  } finally {
    clearTimeout(t);
  }
}
