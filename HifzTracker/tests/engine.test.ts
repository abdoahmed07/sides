import { describe, expect, it } from "vitest";
import { buildSequence, takePortion, targetIndices } from "../src/core/plan/sequence";
import { alternatives, dayIntensity, forecast, requiredLinesForTarget } from "../src/core/plan/engine";
import { cfg, memorizedRange, noneMemorized, q, TODAY } from "./helpers";
import { addDays } from "../src/core/dates";

describe("sequence", () => {
  it("backward Juz 30 starts at An-Nas and reads each surah top to bottom", () => {
    const seq = buildSequence(cfg({ direction: "backward", target: { type: "juz", juz: [30] }, start: { surah: 114, ayah: 1 } }), q);
    expect(seq[0]).toBe(q.indexOf(114, 1));
    expect(seq[1]).toBe(q.indexOf(114, 2));
    expect(seq[6]).toBe(q.indexOf(113, 1));
    expect(seq.at(-1)).toBe(q.indexOf(78, 40));
    expect(seq).toHaveLength(targetIndices({ type: "juz", juz: [30] }, q).length);
  });

  it("forward from Al-Baqarah follows mushaf order", () => {
    const seq = buildSequence(cfg({ direction: "forward", target: { type: "surah", surahs: [2] }, start: { surah: 2, ayah: 1 } }), q);
    expect(seq[0]).toBe(q.indexOf(2, 1));
    expect(seq.at(-1)).toBe(q.indexOf(2, 286));
  });

  it("rotates to a mid-target start point", () => {
    const seq = buildSequence(cfg({ direction: "forward", target: { type: "surah", surahs: [2] }, start: { surah: 2, ayah: 100 } }), q);
    expect(seq[0]).toBe(q.indexOf(2, 100));
    expect(seq.at(-1)).toBe(q.indexOf(2, 99));
  });
});

describe("takePortion", () => {
  const seq = buildSequence(cfg({ direction: "forward", target: { type: "surah", surahs: [2] }, start: { surah: 2, ayah: 1 } }), q);

  it("stays within the line quota", () => {
    const p = takePortion(seq, noneMemorized(), 7, q);
    expect(p.indices[0]).toBe(q.indexOf(2, 1));
    expect(p.lines).toBeLessThanOrEqual(7);
    expect(p.lines).toBeGreaterThan(0);
  });

  it("skips memorized ayahs and continues after them", () => {
    const m = memorizedRange(q.indexOf(2, 1), q.indexOf(2, 5));
    const p = takePortion(seq, m, 5, q);
    expect(p.indices[0]).toBe(q.indexOf(2, 6));
  });

  it("takes a single long ayah even when it exceeds the quota", () => {
    const debt = q.indexOf(2, 282);
    const s = buildSequence(cfg({ direction: "forward", target: { type: "surah", surahs: [2] }, start: { surah: 2, ayah: 282 } }), q);
    const p = takePortion(s, noneMemorized(), 2, q);
    expect(p.indices).toEqual([debt]);
    expect(p.lines).toBeGreaterThan(2);
  });

  it("returns nothing with a zero quota", () => {
    expect(takePortion(seq, noneMemorized(), 0, q).indices).toEqual([]);
  });
});

describe("dayIntensity", () => {
  it("non-study weekdays are inactive", () => {
    const c = cfg({ studyWeekdays: ["mon"] });
    expect(dayIntensity(c, "2026-11-16").active).toBe(true); // Monday
    expect(dayIntensity(c, "2026-11-17").active).toBe(false);
  });

  it("weekday overrides lighten a day", () => {
    const c = cfg({ studyWeekdays: ["mon", "fri"], weekdayOverrides: { fri: { newMultiplier: 0.5 } } });
    expect(dayIntensity(c, "2026-11-20").newMultiplier).toBe(0.5);
  });

  it("travel exceptions stop new material but keep light revision", () => {
    const c = cfg({ exceptions: [{ id: "t", from: "2026-11-20", to: "2026-11-27", kind: "travel" }] });
    const d = dayIntensity(c, "2026-11-22");
    expect(d.newMultiplier).toBe(0);
    expect(d.revision).toBe("light");
  });

  it("a catch-up exception activates even a non-study day", () => {
    const c = cfg({ studyWeekdays: ["mon"], exceptions: [{ id: "c", from: "2026-11-18", to: "2026-11-18", kind: "catchup" }] });
    const d = dayIntensity(c, "2026-11-18");
    expect(d.active).toBe(true);
    expect(d.revision).toBe("extra");
  });
});

describe("forecast / completion date", () => {
  it("one page a day, every day, finishes Juz 30 in about 23 study days", () => {
    const c = cfg({ dailyNewLines: 15, studyWeekdays: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] });
    const f = forecast({ config: c, q, memorized: noneMemorized(), today: TODAY });
    expect(f.done).toBe(false);
    expect(f.newStudyDays).toBeGreaterThanOrEqual(20);
    expect(f.newStudyDays).toBeLessThanOrEqual(30);
    expect(f.completionDate).toBe(addDays(TODAY, f.newStudyDays - 1));
  });

  it("fewer study days push the completion date later", () => {
    const every = forecast({ config: cfg({ studyWeekdays: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] }), q, memorized: noneMemorized(), today: TODAY });
    const three = forecast({ config: cfg({ studyWeekdays: ["mon", "wed", "fri"] }), q, memorized: noneMemorized(), today: TODAY });
    expect(three.completionDate! > every.completionDate!).toBe(true);
  });

  it("a travel week delays completion by about a week", () => {
    const base = cfg({ studyWeekdays: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] });
    const travel = { ...base, exceptions: [{ id: "t", from: addDays(TODAY, 2), to: addDays(TODAY, 8), kind: "travel" as const }] };
    const a = forecast({ config: base, q, memorized: noneMemorized(), today: TODAY });
    const b = forecast({ config: travel, q, memorized: noneMemorized(), today: TODAY });
    expect(b.daysToComplete! - a.daysToComplete!).toBe(7);
  });

  it("already-memorized material is not scheduled again", () => {
    const [a, b] = q.juzRange(30);
    const f = forecast({ config: cfg(), q, memorized: memorizedRange(a, b), today: TODAY });
    expect(f.done).toBe(true);
    expect(f.remainingLines).toBe(0);
    expect(f.completionDate).toBeNull();
  });

  it("reports infeasible when the deadline cannot be met", () => {
    const c = cfg({
      target: { type: "quran" },
      direction: "forward",
      start: { surah: 1, ayah: 1 },
      dailyNewLines: 5,
      targetFinishDate: addDays(TODAY, 60),
      dailyMinutesBudget: 20,
    });
    const f = forecast({ config: c, q, memorized: noneMemorized(), today: TODAY });
    expect(f.meetsTarget).toBe(false);
    expect(f.feasible).toBe(false);
    // Whole Quran in 60 days needs more than the 45-line maximum.
    expect(requiredLinesForTarget({ config: c, q, memorized: noneMemorized(), today: TODAY })).toBeNull();
  });

  it("offers realistic, feasible alternatives for an unrealistic goal", () => {
    const c = cfg({ dailyNewLines: 3, targetFinishDate: addDays(TODAY, 40), dailyMinutesBudget: 60 });
    const alts = alternatives({ config: c, q, memorized: noneMemorized(), today: TODAY });
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.length).toBeLessThanOrEqual(3);
    for (const a of alts) expect(a.forecast.feasible).toBe(true);
  });

  it("time estimate grows with the daily amount", () => {
    const small = forecast({ config: cfg({ dailyNewLines: 3 }), q, memorized: noneMemorized(), today: TODAY });
    const big = forecast({ config: cfg({ dailyNewLines: 15 }), q, memorized: noneMemorized(), today: TODAY });
    expect(big.typicalMinutes).toBeGreaterThan(small.typicalMinutes);
  });
});
