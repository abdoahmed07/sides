/**
 * POST /api/plan-assistant — the only server code in the app.
 *
 * Named route.server.ts so it only exists in the local (server) build; the
 * GitHub Pages static build leaves it out (see next.config.ts pageExtensions).
 *
 * Receives only the user's goal text and aggregate stats, never their full
 * history. Every model output is validated before it is returned.
 */
import { NextResponse, type NextRequest } from "next/server";
import { aiConfigured, AssistantError, callStructured, MODEL } from "@/ai/client";
import { rateLimit } from "@/ai/rate-limit";
import {
  AssistantRequestSchema,
  CheckinReplySchema,
  ExplainReplySchema,
  PlanReplySchema,
  type AssistantErrorCode,
  type AssistantResponse,
} from "@/ai/schemas";
import { unapprovedNumbers } from "@/ai/validate";
import { allowedNumbers } from "@/core/plan/summary";

const MAX_BODY_BYTES = 120_000;

function fail(code: AssistantErrorCode, message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json<AssistantResponse>({ ok: false, error: { code, message } }, { status, headers });
}

export async function GET() {
  return NextResponse.json({ configured: aiConfigured(), model: MODEL });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(ip);
  if (!rl.ok) return fail("rate_limited", "Too many requests. Please wait a few minutes.", 429, { "Retry-After": String(rl.retryAfterSec) });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return fail("too_long", "That message is too long.", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("bad_request", "Invalid request.", 400);
  }
  const parsed = AssistantRequestSchema.safeParse(body);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.code === "too_big");
    return fail(tooLong ? "too_long" : "bad_request", tooLong ? "That message is too long (4000 characters max)." : "Invalid request.", tooLong ? 413 : 400);
  }
  if (!aiConfigured()) return fail("not_configured", "AI is not set up. Add ANTHROPIC_API_KEY to .env.local.", 503);

  const r = parsed.data;
  try {
    if (r.mode === "plan") {
      const ctx = JSON.stringify(r.context);
      // Drop any leading assistant greeting: the conversation must start with the user.
      const firstUser = r.messages.findIndex((m) => m.role === "user");
      if (firstUser < 0) return fail("bad_request", "Invalid request.", 400);
      const turns = r.messages.slice(firstUser).map((m) => ({ role: m.role, content: m.text }));
      // The context rides on the first user turn so the conversation stays a plain chat.
      turns[0] = { role: "user", content: `<context>${ctx}</context>\n\n${turns[0].content}` };
      const reply = await callStructured({
        schema: PlanReplySchema,
        messages: turns,
        modeNote:
          r.purpose === "create"
            ? "Plan mode, creating a new plan. The context's `config` is the default starting point; your patch is applied on top of it."
            : "Plan mode, adjusting the existing plan in the context. Change only what the person asks for.",
      });
      return NextResponse.json<AssistantResponse>({ ok: true, mode: "plan", reply });
    }

    if (r.mode === "explain") {
      const facts = JSON.stringify(r.facts);
      const allowed = allowedNumbers(r.facts);
      const messages = [
        { role: "user" as const, content: `<request>${r.request}</request>\n<facts>${facts}</facts>\nExplain this plan.` },
      ];
      let reply = await callStructured({ schema: ExplainReplySchema, messages, modeNote: "Explain mode.", maxTokens: 1500, effort: "low" });
      let bad = unapprovedNumbers(reply.text, allowed);
      if (bad.length) {
        reply = await callStructured({
          schema: ExplainReplySchema,
          messages: [
            ...messages,
            { role: "assistant", content: JSON.stringify(reply) },
            { role: "user", content: `You used numbers that are not in the facts: ${bad.join(", ")}. Rewrite using only numbers from the facts.` },
          ],
          modeNote: "Explain mode.",
          maxTokens: 1500,
          effort: "low",
        });
        bad = unapprovedNumbers(reply.text, allowed);
      }
      return NextResponse.json<AssistantResponse>({ ok: true, mode: "explain", reply, verified: bad.length === 0 });
    }

    const reply = await callStructured({
      schema: CheckinReplySchema,
      messages: [
        {
          role: "user",
          content: `<today>${r.today}</today>\n<config>${JSON.stringify(r.config)}</config>\n<week>${JSON.stringify(r.summary)}</week>\nSuggest 0-3 adjustments.`,
        },
      ],
      modeNote: "Check-in mode.",
    });
    return NextResponse.json<AssistantResponse>({ ok: true, mode: "checkin", reply });
  } catch (err) {
    const e = err instanceof AssistantError ? err : new AssistantError("upstream_error", "Something went wrong.");
    const status = e.code === "timeout" ? 504 : e.code === "upstream_rate_limited" ? 429 : e.code === "not_configured" ? 503 : 502;
    return fail(e.code, e.message, status);
  }
}
