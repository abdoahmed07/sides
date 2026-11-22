/**
 * Contracts between the client, the /api/plan-assistant route and the model.
 * Everything the model returns is validated against these schemas; anything
 * invalid is rejected (and retried once) and never reaches the app's state.
 */
import { z } from "zod";
import { MemorizedSelectionSchema, PlanConfigSchema, PlanPatchSchema } from "@/core/plan/schema";

export const MAX_MESSAGE_CHARS = 4000;
export const MAX_MESSAGES = 20;

const ChatTurn = z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(MAX_MESSAGE_CHARS) }).strict();

/* ---------------- requests (client → route) ---------------- */

export const PlanRequestSchema = z
  .object({
    mode: z.literal("plan"),
    purpose: z.enum(["create", "adjust"]),
    messages: z.array(ChatTurn).min(1).max(MAX_MESSAGES),
    context: z
      .object({
        today: z.string().max(10),
        config: PlanConfigSchema.nullable(),
        /** Aggregates only: e.g. "Juz 30 memorized (37 surahs); 23 pages total". */
        memorizedSummary: z.string().max(600),
        /** Which ayahs are memorized, as [first, last] global ayah index ranges (no dates or history). */
        memorizedRanges: z.array(z.tuple([z.number().int().min(0).max(6235), z.number().int().min(0).max(6235)])).max(3000),
        /** Key numbers from the engine for the current plan, if any. */
        current: z.record(z.string(), z.unknown()).nullable(),
        upcomingExceptions: z.array(z.object({ id: z.string(), from: z.string(), to: z.string(), kind: z.string() })).max(60),
        nextRamadanStart: z.string().max(10).nullable(),
        /** The app's language; the reply is written in it. */
        language: z.enum(["en", "sv", "ar"]).optional(),
      })
      .strict(),
  })
  .strict();

export const CheckinRequestSchema = z
  .object({
    mode: z.literal("checkin"),
    today: z.string().max(10),
    config: PlanConfigSchema,
    summary: z.record(z.string(), z.unknown()),
    language: z.enum(["en", "sv", "ar"]).optional(),
  })
  .strict();

export const AssistantRequestSchema = z.discriminatedUnion("mode", [PlanRequestSchema, CheckinRequestSchema]);
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

/* ---------------- model outputs ---------------- */

export const PlanReplySchema = z
  .object({
    kind: z.enum(["ask", "propose", "chat"]).describe(
      "ask = you need more info (put up to 3 short questions in `questions`); propose = you have a plan change (put it in `patch`/`markMemorized`); chat = no plan change.",
    ),
    message: z.string().min(1).max(1500).describe("Short, calm reply. Numbers only from preview_plan results or the user's own words. Never Quran text."),
    questions: z.array(z.string().min(1).max(200)).max(3),
    patch: PlanPatchSchema.nullable(),
    markMemorized: z.array(MemorizedSelectionSchema).max(20).nullable(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.kind === "ask" && r.questions.length === 0) ctx.addIssue({ code: "custom", message: "ask needs at least one question" });
    if (r.kind === "propose" && !r.patch && !r.markMemorized?.length)
      ctx.addIssue({ code: "custom", message: "propose needs a patch or markMemorized" });
  });
export type PlanReply = z.infer<typeof PlanReplySchema>;

/** Input of the `preview_plan` tool: a candidate change the model wants the engine to evaluate. */
export const PreviewToolInputSchema = z
  .object({
    patch: PlanPatchSchema.nullable(),
    markMemorized: z.array(MemorizedSelectionSchema).max(20).nullable(),
  })
  .strict();

export const CheckinReplySchema = z
  .object({
    message: z.string().min(1).max(800),
    suggestions: z
      .array(
        z
          .object({
            title: z.string().min(1).max(100),
            reason: z.string().min(1).max(400),
            patch: PlanPatchSchema,
          })
          .strict(),
      )
      .max(3),
  })
  .strict();
export type CheckinReply = z.infer<typeof CheckinReplySchema>;

/* ---------------- route responses (route → client) ---------------- */

export type AssistantResponse =
  | { ok: true; mode: "plan"; reply: PlanReply }
  | { ok: true; mode: "checkin"; reply: CheckinReply }
  | { ok: false; error: { code: AssistantErrorCode; message: string } };

export type AssistantErrorCode =
  | "bad_request"
  | "too_long"
  | "rate_limited"
  | "not_configured"
  | "timeout"
  | "upstream_rate_limited"
  | "upstream_error"
  | "invalid_output"
  | "refused"
  | "sign_in_required"
  | "daily_limit";
