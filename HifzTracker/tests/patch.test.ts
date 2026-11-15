import { describe, expect, it } from "vitest";
import { applyPatch } from "../src/core/plan/patch";
import { PlanConfigSchema } from "../src/core/plan/schema";
import { cfg, TODAY } from "./helpers";

const id = () => "x1";

describe("PlanConfig validation", () => {
  it("accepts the default config", () => {
    expect(PlanConfigSchema.safeParse(cfg()).success).toBe(true);
  });

  it("rejects out-of-range and unknown fields", () => {
    expect(PlanConfigSchema.safeParse({ ...cfg(), dailyNewLines: 900 }).success).toBe(false);
    expect(PlanConfigSchema.safeParse({ ...cfg(), studyWeekdays: [] }).success).toBe(false);
    expect(PlanConfigSchema.safeParse({ ...cfg(), start: { surah: 1, ayah: 8 } }).success).toBe(false);
    expect(PlanConfigSchema.safeParse({ ...cfg(), hacked: true }).success).toBe(false);
    expect(PlanConfigSchema.safeParse({ ...cfg(), startDate: "2026-02-30" }).success).toBe(false);
  });
});

describe("applyPatch", () => {
  it("changes only what the patch sets", () => {
    const r = applyPatch(cfg(), { set: { dailyNewLines: 10 } }, TODAY, id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.dailyNewLines).toBe(10);
    expect(r.config.studyWeekdays).toEqual(cfg().studyWeekdays);
    expect(r.changed).toEqual(["dailyNewLines"]);
  });

  it("adds a travel exception and clips its past part to today", () => {
    const r = applyPatch(cfg(), { addExceptions: [{ from: "2026-11-10", to: "2026-11-27", kind: "travel" }] }, TODAY, id);
    expect(r.ok && r.config.exceptions[0]).toMatchObject({ id: "x1", from: TODAY, to: "2026-11-27" });
  });

  it("rejects exceptions entirely in the past (history is never rewritten)", () => {
    const r = applyPatch(cfg(), { addExceptions: [{ from: "2026-01-01", to: "2026-01-05", kind: "rest" }] }, TODAY, id);
    expect(r.ok).toBe(false);
  });

  it("keeps past exceptions even when asked to remove them", () => {
    const c = cfg({ exceptions: [{ id: "old", from: "2026-10-01", to: "2026-10-03", kind: "travel" }] });
    const r = applyPatch(c, { removeExceptionIds: ["old"] }, TODAY, id);
    expect(r.ok && r.config.exceptions).toHaveLength(1);
  });

  it("makes Fridays lighter via a weekday override", () => {
    const r = applyPatch(cfg(), { weekdayOverrides: [{ day: "fri", newMultiplier: 0.5 }] }, TODAY, id);
    expect(r.ok && r.config.weekdayOverrides.fri).toEqual({ newMultiplier: 0.5 });
    const r2 = r.ok ? applyPatch(r.config, { weekdayOverrides: [{ day: "fri", remove: true }] }, TODAY, id) : r;
    expect(r2.ok && r2.config.weekdayOverrides.fri).toBeUndefined();
  });

  it("clears the target date with 'none' and refuses past dates", () => {
    const withDate = cfg({ targetFinishDate: "2027-06-01" });
    const r = applyPatch(withDate, { set: { targetFinishDate: "none" } }, TODAY, id);
    expect(r.ok && r.config.targetFinishDate).toBeNull();
    expect(applyPatch(withDate, { set: { targetFinishDate: "2020-01-01" } }, TODAY, id).ok).toBe(false);
  });

  it("experience change resets the pace to that level's defaults", () => {
    const r = applyPatch(cfg(), { set: { experience: "advanced" } }, TODAY, id);
    expect(r.ok && r.config.pace.minutesPerNewLine).toBe(3);
  });

  it("rejects malicious or malformed patches without touching the config", () => {
    const base = cfg();
    const before = JSON.stringify(base);
    for (const bad of [
      { set: { dailyNewLines: -5 } },
      { set: { dailyNewLines: 1e9 } },
      { set: { studyWeekdays: ["funday"] } },
      { set: { start: { surah: 115, ayah: 1 } } },
      { set: { __proto__: { polluted: true }, dailyNewLines: 3, extra: 1 } },
      { addExceptions: Array.from({ length: 11 }, () => ({ from: TODAY, to: TODAY, kind: "rest" })) },
      { addExceptions: [{ from: TODAY, to: "2030-01-01", kind: "travel" }] },
      { deleteEverything: true },
      "not an object",
      null,
    ]) {
      expect(applyPatch(base, bad, TODAY, id).ok).toBe(false);
    }
    expect(JSON.stringify(base)).toBe(before);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
