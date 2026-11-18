import { describe, expect, it } from "vitest";
import { evaluateChange, memorizedRanges, surahListLabel, unitsFromRanges } from "../src/core/plan/preview";
import { defaultConfig } from "../src/core/plan/schema";
import { q } from "./helpers";

// The real conversation that went wrong: re-memorize Al-Baqarah 219–286, keep
// 2:1–218 and Juz 28–30 in revision, every day, "about a page", finish by 31 Dec.
const TODAY = "2026-11-15";
const base = defaultConfig(TODAY);
const restart = {
  set: {
    target: { type: "surah" as const, surahs: [2] },
    start: { surah: 2, ayah: 219 },
    direction: "forward" as const,
    dailyNewLines: 15,
    studyWeekdays: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as ("sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat")[],
    experience: "intermediate" as const,
  },
};
const known = [
  { type: "ayahs" as const, surah: 2, from: 1, to: 218 },
  { type: "juz" as const, juz: [28, 29, 30] },
];

describe("preview of a plan change", () => {
  it("a page a day through Al-Baqarah 219–286 finishes around the end of November", () => {
    const p = evaluateChange({ base, hasPlan: false, patch: restart, markMemorized: known, units: [], today: TODAY, q });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.after.remainingPages).toBeGreaterThan(13);
    expect(p.after.remainingPages).toBeLessThan(17);
    expect(p.after.completionDate! >= "2026-11-26" && p.after.completionDate! <= "2026-12-03").toBe(true);
  });

  it("with a 31 Dec target it reports the lines/day that spread it out, and offers that option", () => {
    const patch = { set: { ...restart.set, targetFinishDate: "2026-12-31" } };
    const p = evaluateChange({ base, hasPlan: false, patch, markMemorized: known, units: [], today: TODAY, q });
    if (!p.ok) throw new Error(p.errors.join());
    expect(p.after.meetsTarget).toBe(true);
    expect(p.after.linesToFinishByTarget).toBeGreaterThanOrEqual(4);
    expect(p.after.linesToFinishByTarget).toBeLessThanOrEqual(6);
    const spread = p.alternatives.find((a) => a.id === "finish-on-date");
    expect(spread?.patch.set?.dailyNewLines).toBe(p.after.linesToFinishByTarget);
    expect(spread!.numbers.completionDate! <= "2026-12-31").toBe(true);
    expect(spread!.numbers.completionDate! > "2026-12-20").toBe(true);
  });

  it("describes exactly what the patch does, independent of the AI's wording", () => {
    const p = evaluateChange({ base, hasPlan: false, patch: restart, markMemorized: known, units: [], today: TODAY, q });
    if (!p.ok) throw new Error();
    expect(p.changes).toContain("New per study day: 15 lines");
    expect(p.changes).toContain("Study days: every day");
    expect(p.changes.some((c) => c.includes("Al-Baqarah 219"))).toBe(true);
    expect(p.changes).toContain("Mark as already memorized: Al-Baqarah 1–218");
    expect(p.changes).toContain("Mark as already memorized: Juz 28, 29, 30");
  });

  it("shows before → after for an existing plan", () => {
    const p1 = evaluateChange({ base, hasPlan: false, patch: restart, units: [], today: TODAY, q });
    if (!p1.ok) throw new Error();
    const p2 = evaluateChange({ base: p1.config, hasPlan: true, patch: { set: { dailyNewLines: 5 } }, units: [], today: TODAY, q });
    if (!p2.ok) throw new Error();
    expect(p2.changes).toEqual(["New per study day: 15 lines → 5 lines"]);
    expect(p2.after.completionDate! > p2.before!.completionDate!).toBe(true);
  });

  it("round-trips memorized ayahs through compact ranges", () => {
    const units = unitsFromRanges([[7, 230], [5600, 6235]], q, TODAY, 30);
    expect(memorizedRanges(units, q)).toEqual([[7, 230], [5600, 6235]]);
  });
});

describe("surah list labels", () => {
  it("names Juz 30 and collapses runs instead of listing every surah", () => {
    const juz30 = Array.from({ length: 37 }, (_, k) => 78 + k);
    expect(surahListLabel([2, ...juz30], q)).toBe("Al-Baqarah, Juz 30");
    expect(surahListLabel([67, 68, 69, 70], q)).toBe(`${q.surah(67).nameEn} to ${q.surah(70).nameEn}`);
    expect(surahListLabel([1, 112, 113], q)).toBe(`${q.surah(1).nameEn}, ${q.surah(112).nameEn}, ${q.surah(113).nameEn}`);
  });
});

describe("memorized pages in the preview", () => {
  it("marking Al-Fatiha shows up as more memorized, with the schedule unchanged", () => {
    const base = { ...defaultConfig("2026-11-16"), target: { type: "surah" as const, surahs: [2] }, direction: "forward" as const, start: { surah: 2, ayah: 219 } };
    const units = unitsFromRanges([[q.indexOf(2, 1), q.indexOf(2, 218)]], q, "2026-11-16", 30);
    const p = evaluateChange({ base, hasPlan: true, patch: null, markMemorized: [{ type: "surah", surahs: [1] }], units, today: "2026-11-16", q });
    if (!p.ok) throw new Error("preview failed");
    expect(p.after.memorizedPages!).toBeGreaterThan(p.before!.memorizedPages!);
    expect(p.after.completionDate).toBe(p.before!.completionDate);
  });
});
