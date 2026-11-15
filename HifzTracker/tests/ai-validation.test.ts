import { describe, expect, it } from "vitest";
import { CheckinReplySchema, ExplainReplySchema, PlanReplySchema, AssistantRequestSchema } from "../src/ai/schemas";
import { containsArabic, unapprovedNumbers, validateOutput } from "../src/ai/validate";
import { allowedNumbers } from "../src/core/plan/summary";
import { rateLimit } from "../src/ai/rate-limit";
import { cfg, TODAY } from "./helpers";

const valid = {
  kind: "propose",
  message: "Here is a gentle plan: 5 lines a day, Saturday to Thursday, starting from An-Nas.",
  questions: [],
  patch: {
    set: { target: { type: "juz", juz: [30] }, start: { surah: 114, ayah: 1 }, direction: "backward", dailyNewLines: 5 },
    addExceptions: [{ from: "2026-11-20", to: "2026-11-27", kind: "travel" }],
  },
  markMemorized: [{ type: "surah", surahs: [1, 112, 113] }],
};

describe("plan replies", () => {
  it("accepts a valid proposal", () => {
    const r = validateOutput(JSON.stringify(valid), PlanReplySchema);
    expect(r.ok).toBe(true);
  });

  it("accepts a follow-up question with no patch", () => {
    const r = validateOutput(
      JSON.stringify({ kind: "ask", message: "A couple of quick questions.", questions: ["Where would you like to start?", "How many minutes a day?"], patch: null, markMemorized: null }),
      PlanReplySchema,
    );
    expect(r.ok).toBe(true);
  });

  it("tolerates a fenced JSON block", () => {
    expect(validateOutput("```json\n" + JSON.stringify(valid) + "\n```", PlanReplySchema).ok).toBe(true);
  });

  it("rejects non-JSON and truncated output", () => {
    expect(validateOutput("Sure! Here's your plan…", PlanReplySchema).ok).toBe(false);
    expect(validateOutput(JSON.stringify(valid).slice(0, 80), PlanReplySchema).ok).toBe(false);
  });

  it("rejects more than 3 follow-up questions", () => {
    const r = validateOutput(JSON.stringify({ ...valid, kind: "ask", questions: ["a", "b", "c", "d"], patch: null }), PlanReplySchema);
    expect(r.ok).toBe(false);
  });

  it("rejects 'ask' without questions and 'propose' without a change", () => {
    expect(validateOutput(JSON.stringify({ ...valid, kind: "ask", questions: [], patch: null, markMemorized: null }), PlanReplySchema).ok).toBe(false);
    expect(validateOutput(JSON.stringify({ ...valid, patch: null, markMemorized: null }), PlanReplySchema).ok).toBe(false);
  });

  it.each([
    ["absurd daily amount", { set: { dailyNewLines: 600 } }],
    ["negative amount", { set: { dailyNewLines: -1 } }],
    ["fractional lines", { set: { dailyNewLines: 2.5 } }],
    ["invalid surah", { set: { start: { surah: 200, ayah: 1 } } }],
    ["ayah past the end of the surah", { set: { start: { surah: 1, ayah: 9 } } }],
    ["fake weekday", { set: { studyWeekdays: ["someday"] } }],
    ["impossible date", { set: { targetFinishDate: "2027-02-31" } }],
    ["huge multiplier", { weekdayOverrides: [{ day: "fri", newMultiplier: 50 }] }],
    ["unknown field (injection)", { set: { dailyNewLines: 5 }, schedule: [{ date: TODAY, ayahs: [1, 2, 3] }] }],
    ["unknown set field", { set: { isAdmin: true } }],
    ["too many exceptions", { addExceptions: Array.from({ length: 11 }, () => ({ from: TODAY, to: TODAY, kind: "rest" })) }],
    ["exception longer than a year", { addExceptions: [{ from: "2026-12-01", to: "2028-12-01", kind: "travel" }] }],
    ["unknown exception kind", { addExceptions: [{ from: TODAY, to: TODAY, kind: "party" }] }],
  ])("rejects malicious / out-of-range patch: %s", (_, patch) => {
    const r = validateOutput(JSON.stringify({ ...valid, patch }), PlanReplySchema);
    expect(r.ok).toBe(false);
  });

  it("rejects any Arabic script (the AI must never output Quran text)", () => {
    const withQuran = { ...valid, message: "Start with قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ today." };
    expect(validateOutput(JSON.stringify(withQuran), PlanReplySchema).ok).toBe(false);
    expect(containsArabic("Al-Mulk")).toBe(false);
  });

  it("rejects overly long messages", () => {
    expect(validateOutput(JSON.stringify({ ...valid, message: "x".repeat(5000) }), PlanReplySchema).ok).toBe(false);
  });
});

describe("explanations may only use engine numbers", () => {
  const facts = { after: { dailyNewLines: 7, completionDate: "2027-08-14", typicalMinutes: 32, studyDaysPerWeek: 6 } };
  const allowed = allowedNumbers(facts);

  it("passes when every number comes from the facts", () => {
    const text = "You'll learn 7 lines a day on 6 days a week, about 32 minutes, finishing around 14 August 2027.";
    expect(unapprovedNumbers(text, allowed)).toEqual([]);
  });

  it("flags invented numbers", () => {
    expect(unapprovedNumbers("This takes about 45 minutes and finishes in 90 days.", allowed)).toEqual(["45", "90"]);
  });

  it("explain/check-in schemas validate shape and limits", () => {
    expect(validateOutput(JSON.stringify({ text: "Fine." }), ExplainReplySchema).ok).toBe(true);
    expect(validateOutput(JSON.stringify({ text: "" }), ExplainReplySchema).ok).toBe(false);
    expect(validateOutput(JSON.stringify({ message: "Well done.", suggestions: [] }), CheckinReplySchema).ok).toBe(true);
    const four = Array.from({ length: 4 }, () => ({ title: "t", reason: "r", patch: { set: { dailyNewLines: 3 } } }));
    expect(validateOutput(JSON.stringify({ message: "m", suggestions: four }), CheckinReplySchema).ok).toBe(false);
  });
});

describe("request validation and rate limiting", () => {
  it("rejects over-long user messages", () => {
    const req = {
      mode: "plan",
      purpose: "create",
      messages: [{ role: "user", text: "a".repeat(4001) }],
      context: { today: TODAY, config: cfg(), memorizedSummary: "", current: null, upcomingExceptions: [], nextRamadanStart: null },
    };
    expect(AssistantRequestSchema.safeParse(req).success).toBe(false);
    req.messages[0].text = "I want to memorize Juz 30.";
    expect(AssistantRequestSchema.safeParse(req).success).toBe(true);
  });

  it("limits requests per window", () => {
    const t = 1_000_000;
    for (let k = 0; k < 3; k++) expect(rateLimit("test-ip", 3, 1000, t + k).ok).toBe(true);
    expect(rateLimit("test-ip", 3, 1000, t + 5).ok).toBe(false);
    expect(rateLimit("test-ip", 3, 1000, t + 2000).ok).toBe(true);
  });
});
