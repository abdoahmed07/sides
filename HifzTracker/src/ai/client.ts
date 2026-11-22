/**
 * Server-only Claude client. Calls the Messages API with structured output
 * and optional tools (run locally, e.g. the planning engine), validates the
 * final answer with our own Zod schemas plus an optional content check, and
 * retries once (telling the model what was wrong) when it is invalid.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlockParam, BetaMessageParam, BetaToolResultBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { validateOutput } from "./validate";
import type { AssistantErrorCode } from "./schemas";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const TIMEOUT_MS = Number(process.env.ANTHROPIC_TIMEOUT_MS || 60_000);
const MAX_STEPS = 8;

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
  constructor(
    public code: AssistantErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type LocalTool = {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  run: (input: unknown) => unknown;
};

/** Models whose fallbacks can use the server-side "default" chain. */
const FALLBACK_MODELS = /^claude-(opus-5|sonnet-5-5|fable-5)/;

function toInputSchema(schema: z.ZodTypeAny) {
  const js = z.toJSONSchema(schema, { unrepresentable: "any" }) as Record<string, unknown>;
  delete js.$schema;
  return js as { type: "object"; [k: string]: unknown };
}

export async function callStructured<S extends z.ZodTypeAny>(opts: {
  schema: S;
  messages: BetaMessageParam[];
  /** Short mode header appended to the system prompt. */
  modeNote: string;
  tools?: LocalTool[];
  /** Extra content check on a schema-valid answer; return an error message to reject it. */
  check?: (value: z.infer<S>) => string | null;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  /** The person's language: Arabic replies may use Arabic script (but never Quran text). */
  language?: "en" | "sv" | "ar";
}): Promise<z.infer<S>> {
  const effort = opts.effort ?? "medium";
  const anthropic = getClient();
  const lang = { en: "English", sv: "Swedish", ar: "Arabic" }[opts.language ?? "en"];
  const system = `${getSystemPrompt()}\n\n# Current mode\n\n${opts.modeNote}\n\nReply language: ${lang}.`;
  const tools = (opts.tools ?? []).map((t) => ({ name: t.name, description: t.description, input_schema: toInputSchema(t.schema) }));
  const messages: BetaMessageParam[] = [...opts.messages];
  let useFormat = true;
  let retries = 0;
  let lastError = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    let res: Anthropic.Beta.Messages.BetaMessage;
    try {
      res = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 16000,
        system,
        messages,
        ...(tools.length ? { tools } : {}),
        output_config: useFormat ? { format: betaZodOutputFormat(opts.schema), effort } : { effort },
        ...(FALLBACK_MODELS.test(MODEL) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
    } catch (err) {
      // A schema the API cannot compile: continue once with prompt-only JSON.
      if (err instanceof Anthropic.BadRequestError && useFormat && /schema|output_config|format/i.test(err.message)) {
        useFormat = false;
        continue;
      }
      throw mapError(err);
    }

    if (res.stop_reason === "refusal") throw new AssistantError("refused", "The assistant declined this request.");

    if (res.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: res.content as BetaContentBlockParam[] });
      const results: BetaToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        const tool = opts.tools?.find((t) => t.name === block.name);
        const parsed = tool?.schema.safeParse(block.input);
        if (!tool || !parsed?.success) {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: tool ? `Invalid input: ${parsed?.error?.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` : "Unknown tool",
          });
          continue;
        }
        let out: unknown;
        try {
          out = tool.run(parsed.data);
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: `Tool failed: ${(e as Error).message}` });
          continue;
        }
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    if (res.stop_reason === "max_tokens") {
      lastError = "Output was cut off (max_tokens)";
      if (retries++ >= 1) break;
      continue;
    }

    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const v = await validateOutput(text, opts.schema, { arabic: opts.language === "ar" });
    const problem = v.ok ? opts.check?.(v.value) ?? null : v.error;
    if (v.ok && !problem) return v.value;
    lastError = problem ?? "invalid";
    if (retries++ >= 1) break;
    // Retry once, telling the model exactly what was wrong.
    messages.push({ role: "assistant", content: res.content as BetaContentBlockParam[] });
    messages.push({ role: "user", content: `That answer was rejected by the app: ${lastError}. Fix it and return one corrected JSON object.` });
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
