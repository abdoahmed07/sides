import { describe, expect, it } from "vitest";
import { applyPatch } from "../src/core/plan/patch";
import { PlanConfigSchema } from "../src/core/plan/schema";
import { evaluateChange } from "../src/core/plan/preview";
import { cfg, q, TODAY } from "./helpers";

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

describe("weekly readings", () => {
  it("sets, replaces and clears the list", () => {
    const r = applyPatch(cfg(), { set: { weeklyReadings: [{ day: "fri", surah: 18 }] } }, TODAY);
    expect(r.ok && r.config.weeklyReadings).toEqual([{ day: "fri", surah: 18 }]);
    if (!r.ok) return;
    const cleared = applyPatch(r.config, { set: { weeklyReadings: [] } }, TODAY);
    expect(cleared.ok && cleared.config.weeklyReadings).toEqual([]);
  });

  it("rejects bad surahs, days and duplicates", () => {
    expect(applyPatch(cfg(), { set: { weeklyReadings: [{ day: "fri", surah: 115 }] } }, TODAY).ok).toBe(false);
    expect(applyPatch(cfg(), { set: { weeklyReadings: [{ day: "friday", surah: 18 }] } }, TODAY).ok).toBe(false);
    const dup = [{ day: "fri", surah: 18 }, { day: "fri", surah: 18 }];
    expect(applyPatch(cfg(), { set: { weeklyReadings: dup } }, TODAY).ok).toBe(false);
  });

  it("plans saved before the field existed are still valid", () => {
    const old = cfg();
    delete (old as Partial<typeof old>).weeklyReadings;
    expect(PlanConfigSchema.safeParse(old).success).toBe(true);
  });

  it("does not change the finish date and shows in the change list", () => {
    const today = TODAY;
    const base = evaluateChange({ base: cfg(), hasPlan: true, patch: null, units: [], today, q });
    const withKahf = evaluateChange({ base: cfg(), hasPlan: true, patch: { set: { weeklyReadings: [{ day: "fri", surah: 18 }] } }, units: [], today, q });
    if (!base.ok || !withKahf.ok) throw new Error("preview failed");
    expect(withKahf.after.completionDate).toBe(base.after.completionDate);
    expect(withKahf.changes).toContain("Weekly reading: none → Al-Kahf on Fri");
  });
});
