import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/dates";
import { markPrior } from "../src/core/memorize";
import { buildDay } from "../src/core/schedule/day";
import { manzilRound, sabqiDay } from "../src/core/schedule/revision-info";
import { targetIndices } from "../src/core/plan/sequence";
import { newUnit } from "../src/core/srs";
import { pagesLabel, totals } from "../src/core/stats";
import { cfg, q, TODAY } from "./helpers";

describe("memorized pages", () => {
  it("counts the short opening pages as whole pages", () => {
    const units = markPrior([], targetIndices({ type: "pages", from: 1, to: 43 }, q), q, TODAY, 30);
    const t = totals(units, q);
    expect(t.fullPages).toBe(43);
    expect(t.partialPages).toBe(0);
    expect(t.pagesEquivalent).toBeLessThan(43); // lines ÷ 15: why it isn't shown as a page count
  });

  it("labels whole and part pages", () => {
    expect(pagesLabel(43)).toBe("43 pages");
    expect(pagesLabel(1)).toBe("1 page");
    expect(pagesLabel(43, 1)).toBe("43 pages + part of 1 more");
    expect(pagesLabel(0, 2)).toBe("part of 2 pages");
  });
});

describe("sabqi days", () => {
  it("counts the days after memorizing and says when the page moves to manzil", () => {
    const u = newUnit(300, [3000], addDays(TODAY, -2), "plan");
    expect(sabqiDay(u, 7, TODAY)).toEqual({ day: 2, of: 6, manzilFrom: addDays(TODAY, 5), kept: false });
    const last = newUnit(300, [3000], addDays(TODAY, -6), "plan");
    expect(sabqiDay(last, 7, TODAY).day).toBe(6);
  });

  it("matches the schedule: in sabqi on its last day, in manzil the day after", () => {
    const c = cfg({ sabqiWindowDays: 7 });
    const u = newUnit(300, [3000], addDays(TODAY, -6), "plan");
    expect(buildDay(c, q, [u], TODAY).sabqi).toEqual([300]);
    expect(buildDay(c, q, [u], addDays(TODAY, 1)).sabqi).toEqual([]);
    expect(manzilRound(c, [u], addDays(TODAY, 1)).total).toBe(1);
  });
});

describe("manzil round", () => {
  it("splits manzil pages into revised lately and still to come, in schedule order", () => {
    const c = cfg({ manzilCycleDays: 30, sabqiWindowDays: 7 });
    const units = markPrior([], targetIndices({ type: "pages", from: 582, to: 604 }, q), q, addDays(TODAY, -40), 30).map((u) =>
      u.page <= 585 ? { ...u, lastRevised: addDays(TODAY, -3), nextDue: addDays(TODAY, 20) } : u,
    );
    const r = manzilRound(c, units, TODAY);
    expect(r.total).toBe(23);
    expect(r.revised.map((x) => x.page)).toEqual([582, 583, 584, 585]);
    expect(r.coming).toHaveLength(19);
    // The first pages to come are the ones the schedule picks today.
    const today = buildDay(c, q, units, TODAY).manzil;
    expect(r.coming.slice(0, today.length)).toEqual(today);
  });

  it("leaves out pages that are still in sabqi", () => {
    const fresh = newUnit(600, [6200], addDays(TODAY, -2), "plan");
    expect(manzilRound(cfg(), [fresh], TODAY).total).toBe(0);
  });
});
