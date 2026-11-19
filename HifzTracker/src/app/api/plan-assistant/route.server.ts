/**
 * POST /api/plan-assistant — the only server code in the app.
 *
 * Named route.server.ts so it only exists in the server builds (local and
 * Vercel); the GitHub Pages static build leaves it out (see next.config.ts
 * pageExtensions). On Vercel it needs a signed-in account and has a daily
 * limit per account (src/ai/access.ts).
 *
 * Receives only the user's messages, the plan settings, which ayahs are
 * memorized and aggregate stats — never the day-by-day history. The model
 * can call `preview_plan`, which runs the deterministic engine here, so every
 * number it tells the user comes from the engine. Every reply is validated
 * before it is returned.
 */
import { NextResponse, type NextRequest } from "next/server";
import { checkAccess } from "@/ai/access";
import { aiConfigured, AssistantError, callStructured, MODEL, type LocalTool } from "@/ai/client";
import { rateLimit } from "@/ai/rate-limit";
import {
  AssistantRequestSchema,
  CheckinReplySchema,
  PlanReplySchema,
  PreviewToolInputSchema,
  type AssistantErrorCode,
  type AssistantResponse,
  type PlanRequest,
} from "@/ai/schemas";
import { unapprovedNumbers } from "@/ai/validate";
import { defaultConfig } from "@/core/plan/schema";
import { evaluateChange, unitsFromRanges } from "@/core/plan/preview";
import { allowedNumbers, type KeyNumbers } from "@/core/plan/summary";
import { getQuran } from "@/core/quran";

const MAX_BODY_BYTES = 200_000;

// On Vercel: a plan conversation can take several model calls.
export const maxDuration = 120;

function fail(code: AssistantErrorCode, message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json<AssistantResponse>({ ok: false, error: { code, message } }, { status, headers });
}

export async function GET() {
  return NextResponse.json({ configured: aiConfigured(), model: MODEL });
}

/** The numbers the model sees from the engine (and may quote). */
function toolNumbers(k: KeyNumbers | null) {
  if (!k) return null;
  return {
    dailyNewLines: k.dailyNewLines,
    dailyNewPages: k.dailyNewPages,
    studyDaysPerWeek: k.studyDaysPerWeek,
    remainingPages: k.remainingPages,
    remainingLines: k.remainingLines,
    estimatedFinish: k.done ? "already done" : k.completionDate,
    daysToFinish: k.daysToComplete,
    minutesPerDayNow: k.typicalMinutes,
    minutesPerDayAtEnd: k.peakMinutes,
    targetFinishDate: k.targetFinishDate,
    meetsTarget: k.meetsTarget,
    linesPerDayToFinishByTarget: k.linesToFinishByTarget ?? null,
    dailyMinutesBudget: k.dailyMinutesBudget,
    withinBudget: k.withinBudget,
    // Time over budget is information, not a reason to call the plan unrealistic.
    realistic: k.meetsTarget !== false && (k.done || k.completionDate !== null),
  };
}

function planTools(r: PlanRequest, seen: unknown[]): LocalTool[] {
  const q = getQuran();
  const today = r.context.today;
  const base = r.context.config ?? defaultConfig(today);
  const units = unitsFromRanges(r.context.memorizedRanges, q, today, base.manzilCycleDays);
  return [
    {
      name: "preview_plan",
      description:
        "Runs the app's planning engine on a candidate change and returns the real numbers: daily amount, estimated finish date, " +
        "minutes per day now and at the end, whether a target date and time budget are met, the daily lines needed to finish by the " +
        "target date, a plain list of what the change does, and realistic alternatives. Pass the exact patch/markMemorized you intend " +
        "to propose. Use it before every proposal and whenever you need a number.",
      schema: PreviewToolInputSchema,
      run: (input) => {
        const { patch, markMemorized } = input as { patch: never; markMemorized: never };
        const p = evaluateChange({ base, hasPlan: !!r.context.config, patch, markMemorized, units, today, q });
        const out = p.ok
          ? {
              ok: true,
              changes: p.changes,
              current: toolNumbers(p.before),
              afterChange: toolNumbers(p.after),
              alternatives: p.alternatives.map((a) => ({ label: a.label, patch: a.patch, numbers: toolNumbers(a.numbers) })),
            }
          : { ok: false, errors: p.errors };
        seen.push(out);
        return out;
      },
    },
  ];
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
    return fail(
      tooLong ? "too_long" : "bad_request",
      tooLong ? "That message is too long (4000 characters max)." : "Invalid request.",
      tooLong ? 413 : 400,
    );
  }
  if (!aiConfigured()) return fail("not_configured", "AI is not set up. Add ANTHROPIC_API_KEY to .env.local.", 503);
  // Last, so only well-formed requests count against the daily limit.
  const access = await checkAccess(req.headers.get("authorization"));
  if (!access.ok) return fail(access.code, access.message, access.status);

  const r = parsed.data;
  try {
    if (r.mode === "plan") {
      // Drop any leading assistant greeting: the conversation must start with the user.
      const firstUser = r.messages.findIndex((m) => m.role === "user");
      if (firstUser < 0) return fail("bad_request", "Invalid request.", 400);
      const turns = r.messages.slice(firstUser).map((m) => ({ role: m.role, content: m.text }));
      const { memorizedRanges, ...ctx } = r.context;
      void memorizedRanges; // the model sees the summary; the engine uses the ranges
      turns[0] = { role: "user", content: `<context>${JSON.stringify(ctx)}</context>\n\n${turns[0].content}` };

      const seen: unknown[] = [];
      const userText = r.messages.filter((m) => m.role === "user").map((m) => m.text);
      const reply = await callStructured({
        schema: PlanReplySchema,
        messages: turns,
        tools: planTools(r, seen),
        modeNote:
          r.purpose === "create"
            ? "Plan mode, creating a new plan. The context's `config` is the default starting point; your patch is applied on top of it."
            : "Plan mode, adjusting the existing plan in the context. Change only what the person asks for.",
        check: (v) => {
          // Every number in the reply must come from the engine, the context or the person's own words.
          const allowed = allowedNumbers([seen, ctx, userText, v.patch, v.markMemorized]);
          const bad = unapprovedNumbers([v.message, ...v.questions].join(" "), allowed);
          if (bad.length) return `the message uses numbers that did not come from preview_plan or the user (${bad.join(", ")}). Call preview_plan and use its numbers, or leave numbers out.`;
          if (v.kind === "propose" && seen.length === 0) return "call preview_plan with this exact change before proposing it";
          return null;
        },
      });
      return NextResponse.json<AssistantResponse>({ ok: true, mode: "plan", reply });
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
