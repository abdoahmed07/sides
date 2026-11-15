/**
 * Server-only Claude client. Calls the Messages API with structured output,
 * validates the result with our own Zod schemas and retries once (with the
 * validation error) when the output is invalid.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import { validateOutput } from "./validate";
import type { AssistantErrorCode } from "./schemas";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const TIMEOUT_MS = Number(process.env.ANTHROPIC_TIMEOUT_MS || 60_000);

let systemPrompt: string | null = null;
function getSystemPrompt(): string {
  if (!systemPrompt) systemPrompt = readFileSync(join(process.cwd(), "src/ai/system-prompt.md"), "utf8");
  return systemPrompt;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  return client;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export class AssistantError extends Error {
  constructor(public code: AssistantErrorCode, message: string) {
    super(message);
  }
}

type Turn = { role: "user" | "assistant"; content: string };

/** Models whose fallbacks can use the server-side "default" chain. */
const FALLBACK_MODELS = /^claude-(opus-5|sonnet-5-5|fable-5)/;

export async function callStructured<S extends z.ZodTypeAny>(opts: {
  schema: S;
  messages: Turn[];
  /** Short mode header appended to the system prompt. */
  modeNote: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  const effort = opts.effort ?? "medium";
  const anthropic = getClient();
  const system = `${getSystemPrompt()}\n\n# Current mode\n\n${opts.modeNote}`;
  let messages: Turn[] = opts.messages;
  let lastError = "";
  let useFormat = true;

  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string;
    try {
      const useFallbacks = FALLBACK_MODELS.test(MODEL);
      const res = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 4000,
        system,
        messages,
        output_config: useFormat ? { format: betaZodOutputFormat(opts.schema), effort } : { effort },
        ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      if (res.stop_reason === "refusal") throw new AssistantError("refused", "The assistant declined this request.");
      if (res.stop_reason === "max_tokens") {
        lastError = "Output was cut off (max_tokens)";
        continue;
      }
      text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    } catch (err) {
      if (err instanceof AssistantError) throw err;
      // A schema the API cannot compile: retry once with prompt-only JSON.
      if (err instanceof Anthropic.BadRequestError && useFormat && /schema|output_config|format/i.test(err.message)) {
        useFormat = false;
        attempt--;
        continue;
      }
      throw mapError(err);
    }

    const v = validateOutput(text, opts.schema);
    if (v.ok) return v.value;
    lastError = v.error;
    // Retry once, telling the model exactly what was wrong.
    messages = [
      ...opts.messages,
      { role: "assistant", content: text.slice(0, 4000) || "(empty)" },
      {
        role: "user",
        content: `That output was rejected by the app's validator: ${v.error}. Return one corrected JSON object only.`,
      },
    ];
  }
  console.warn("[plan-assistant] invalid output after retry:", lastError);
  throw new AssistantError("invalid_output", "The assistant returned something the app could not use.");
}

function mapError(err: unknown): AssistantError {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new AssistantError("timeout", "The assistant took too long to answer.");
  if (err instanceof Anthropic.RateLimitError) return new AssistantError("upstream_rate_limited", "The AI service is busy right now.");
  if (err instanceof Anthropic.AuthenticationError) return new AssistantError("not_configured", "The API key was rejected. Check ANTHROPIC_API_KEY.");
  if (err instanceof Anthropic.APIConnectionError) return new AssistantError("upstream_error", "Could not reach the AI service.");
  if (err instanceof Anthropic.APIError) {
    console.warn("[plan-assistant] API error", err.status, err.message);
    return new AssistantError("upstream_error", "The AI service returned an error.");
  }
  console.error("[plan-assistant] unexpected error", err);
  return new AssistantError("upstream_error", "Something went wrong while asking the assistant.");
}
