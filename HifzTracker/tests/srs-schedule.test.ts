import { describe, expect, it } from "vitest";
import { applyRating, newUnit, unitStatus, EASE_MIN } from "../src/core/srs";
import { buildDay } from "../src/core/schedule/day";
import { markPrior, memorizeNew, unmark } from "../src/core/memorize";
import { detectMissed, recommendMissed, missedChoicePatch } from "../src/core/missed";
import { streaks, pageStatuses } from "../src/core/stats";
import { addDays } from "../src/core/dates";
import { targetIndices } from "../src/core/plan/sequence";
import { cfg, q, TODAY } from "./helpers";

describe("spaced repetition", () => {
  const u = newUnit(600, [6200], TODAY, "plan");

  it("strong pushes the next review later; weak brings it back tomorrow", () => {
    const strong = applyRating(u, "strong", TODAY, 30);
    const weak = applyRating(u, "weak", TODAY, 30);
    expect(strong.nextDue > weak.nextDue).toBe(true);
    expect(weak.nextDue).toBe(addDays(TODAY, 1));
    expect(weak.ease).toBeLessThan(u.ease);
    expect(strong.ease).toBeGreaterThan(u.ease);
  });

  it("repeated strong ratings grow the interval but never past the manzil cycle", () => {
    let x = u;
    let d = TODAY;
    for (let k = 0; k < 10; k++) {
      x = applyRating(x, "strong", d, 30);
      d = x.nextDue;
    }
    expect(x.intervalDays).toBe(30);
  });

  it("ease never drops below the minimum", () => {
    let x = u;
    for (let k = 0; k < 20; k++) x = applyRating(x, "weak", TODAY, 30);
    expect(x.ease).toBe(EASE_MIN);
  });

  it("status reflects weak / due / strong", () => {
    expect(unitStatus(applyRating(u, "weak", TODAY, 30), TODAY)).toBe("weak");
    expect(unitStatus(u, addDays(TODAY, 5))).toBe("due");
    expect(unitStatus(applyRating(u, "strong", TODAY, 30), TODAY)).toBe("strong");
  });
});

describe("memorize / unmark", () => {
  it("groups ayahs into page units and merges additions", () => {
    const [a] = q.surahRange(114);
    let units = memorizeNew([], [a, a + 1], q, TODAY);
    expect(units).toHaveLength(1);
    units = memorizeNew(units, [a + 2], q, addDays(TODAY, 1));
    expect(units[0].ayahs).toEqual([a, a + 1, a + 2]);
    expect(units[0].lastAdded).toBe(addDays(TODAY, 1));
    expect(unmark(units, [a, a + 1, a + 2])).toHaveLength(0);
  });

  it("prior material gets spread-out due dates", () => {
    const units = markPrior([], targetIndices({ type: "juz", juz: [30] }, q), q, TODAY, 30);
    const due = new Set(units.map((u) => u.nextDue));
    expect(due.size).toBeGreaterThan(10);
  });
});

describe("daily plan", () => {
  const juz30 = targetIndices({ type: "juz", juz: [30] }, q);

  it("gives sabaq, sabqi from the window and a manzil slice", () => {
    const c = cfg({ target: { type: "juz", juz: [29] }, direction: "backward", start: { surah: 77, ayah: 1 } });
    let units = markPrior([], juz30, q, addDays(TODAY, -1), 30);
    const [m1] = q.surahRange(77);
    units = memorizeNew(units, [m1, m1 + 1], q, addDays(TODAY, -2));
    const day = buildDay(c, q, units, TODAY);
    expect(day.sabaq?.indices.length).toBeGreaterThan(0);
    expect(day.sabaq!.indices).not.toContain(m1);
    expect(day.sabqi).toContain(q.pageOf[m1]);
    expect(day.manzil.length).toBeGreaterThan(0);
    expect(day.manzil.length).toBeLessThanOrEqual(5);
  });

  it("overdue revision takes priority over new material", () => {
    const c = cfg({ target: { type: "juz", juz: [29] }, direction: "backward", start: { surah: 77, ayah: 1 } });
    // Everything in Juz 30 was due 40 days ago.
    const units = markPrior([], juz30, q, addDays(TODAY, -100), 30).map((u) => ({ ...u, nextDue: addDays(TODAY, -40) }));
    const day = buildDay(c, q, units, TODAY);
    expect(day.sabaq).toBeNull();
    expect(day.sabaqNote).toMatch(/revision/i);
  });

  it("pause flag stops new material while anything is overdue", () => {
    const c = cfg({ target: { type: "juz", juz: [29] }, start: { surah: 77, ayah: 1 }, pauseNewUntilCaughtUp: true });
    const units = markPrior([], juz30.slice(0, 200), q, addDays(TODAY, -100), 30).map((u, k) =>
      k < 3 ? { ...u, nextDue: addDays(TODAY, -10) } : { ...u, nextDue: addDays(TODAY, 20) },
    );
    const day = buildDay({ ...c, manzilCycleDays: 120 }, q, units, TODAY);
    expect(day.sabaq).toBeNull();
  });

  it("a catch-up day revises every due page and adds nothing new", () => {
    const c = cfg({ exceptions: [{ id: "c", from: TODAY, to: TODAY, kind: "catchup" }], target: { type: "juz", juz: [29] }, start: { surah: 77, ayah: 1 } });
    const units = markPrior([], juz30, q, addDays(TODAY, -100), 30).map((u) => ({ ...u, nextDue: addDays(TODAY, -1) }));
    const day = buildDay(c, q, units, TODAY);
    expect(day.sabaq).toBeNull();
    expect(day.manzil.length).toBe(units.length);
  });

  it("rest days schedule nothing", () => {
    const c = cfg({ exceptions: [{ id: "r", from: TODAY, to: TODAY, kind: "rest" }] });
    const day = buildDay(c, q, markPrior([], juz30, q, addDays(TODAY, -50), 30), TODAY);
    expect(day.sabaq).toBeNull();
    expect(day.manzil).toEqual([]);
    expect(day.sabqi).toEqual([]);
  });
});

describe("missed days", () => {
  const c = cfg({ startDate: addDays(TODAY, -14), studyWeekdays: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] });

  it("counts study days since the last active day", () => {
    const active = new Set([addDays(TODAY, -5)]);
    const m = detectMissed(c, active, TODAY, null);
    expect(m.missedDays).toHaveLength(4);
  });

  it("ignores days already handled", () => {
    const active = new Set([addDays(TODAY, -5)]);
    expect(detectMissed(c, active, TODAY, addDays(TODAY, -1)).missedDays).toHaveLength(0);
  });

  it("recommends shift, catch-up or pause by how many were missed", () => {
    expect(recommendMissed(1)).toBe("shift");
    expect(recommendMissed(5)).toBe("catchup");
    expect(recommendMissed(12)).toBe("pause");
    expect(missedChoicePatch("shift", TODAY)).toBeNull();
    expect(missedChoicePatch("catchup", TODAY)?.addExceptions?.[0].kind).toBe("catchup");
  });
});

describe("stats", () => {
  it("streaks skip non-study days and do not break on today", () => {
    const c = cfg({ studyWeekdays: ["mon", "tue", "wed", "thu", "fri"] });
    // Thu 12, Fri 13, (Sat/Sun off), Mon 16 = today not yet done
    const active = new Set(["2026-11-12", "2026-11-13"]);
    expect(streaks(c, active, "2026-11-16")).toEqual({ current: 2, longest: 2 });
    // Missing Wed 11 breaks an earlier run
    const active2 = new Set(["2026-11-09", "2026-11-10", "2026-11-12"]);
    expect(streaks(c, active2, "2026-11-13")).toEqual({ current: 1, longest: 2 });
  });

  it("colours pages by status", () => {
    const units = markPrior([], targetIndices({ type: "pages", from: 600, to: 600 }, q), q, TODAY, 30);
    const s = pageStatuses([{ ...units[0], strength: "weak" }], q, TODAY);
    expect(s[600]).toBe("weak");
    expect(s[1]).toBe("none");
  });

  it("only counts pages left on today's list as due when the list is known", () => {
    const [u] = markPrior([], targetIndices({ type: "pages", from: 600, to: 600 }, q), q, TODAY, 30);
    const overdue = { ...u, strength: "okay" as const, nextDue: "2026-11-01" };
    expect(pageStatuses([overdue], q, TODAY)[600]).toBe("due");
    // Not on today's list (left for a later manzil day), or already revised: not due.
    expect(pageStatuses([overdue], q, TODAY, new Set())[600]).toBe("memorized");
    // Still to do today: due, even if its review date is later.
    expect(pageStatuses([{ ...u, nextDue: "2026-12-30" }], q, TODAY, new Set([600]))[600]).toBe("due");
  });
});
