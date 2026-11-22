import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/dates";
import { lookAheadStops, pageCounts } from "../src/core/plan/lookahead";
import { forecastFor, projectionFor } from "../src/core/plan/preview";
import { buildSequence } from "../src/core/plan/sequence";
import { markPrior } from "../src/core/memorize";
import { targetIndices } from "../src/core/plan/sequence";
import { cfg, q, TODAY } from "./helpers";

describe("look-ahead steps", () => {
  it("goes week by week for a short plan and ends on the finish date", () => {
    const s = lookAheadStops(TODAY, addDays(TODAY, 27));
    expect(s.map((x) => x.label)).toEqual(["in 1 week", "in 2 weeks", "in 3 weeks", "End of plan"]);
    expect(s.at(-1)).toEqual({ date: addDays(TODAY, 27), label: "End of plan", end: true });
  });

  it("uses bigger steps for long plans and never too many", () => {
    const year = lookAheadStops(TODAY, addDays(TODAY, 365));
    expect(year.length).toBeLessThanOrEqual(15);
    expect(year[0].label).toBe("in 4 weeks");
    expect(year.map((x) => x.label)).toContain("in 2 months");
    const tenYears = lookAheadStops(TODAY, addDays(TODAY, 3650));
    expect(tenYears.length).toBeLessThanOrEqual(15);
    expect(tenYears.at(-1)!.end).toBe(true);
  });

  it("has nothing to show when there is no finish date or it is today", () => {
    expect(lookAheadStops(TODAY, null)).toEqual([]);
    expect(lookAheadStops(TODAY, TODAY)).toEqual([]);
  });
});

describe("projection", () => {
  it("grows step by step and has the whole target on the estimated finish date", () => {
    const c = cfg({ dailyNewLines: 15 });
    const units = markPrior([], targetIndices({ type: "pages", from: 582, to: 590 }, q), q, TODAY, 30);
    const f = forecastFor(c, units, q, TODAY);
    expect(f.completionDate).not.toBeNull();
    const stops = lookAheadStops(TODAY, f.completionDate);
    const snaps = projectionFor(c, units, q, TODAY, stops.map((s) => s.date));
    const pages = snaps.map((m) => pageCounts(m, q).full);
    for (let k = 1; k < pages.length; k++) expect(pages[k]).toBeGreaterThanOrEqual(pages[k - 1]);
    const last = snaps.at(-1)!;
    expect(buildSequence(c, q).every((i) => last[i] === 1)).toBe(true);
    // ...and not the day before.
    const before = projectionFor(c, units, q, TODAY, [addDays(f.completionDate!, -1)])[0];
    expect(buildSequence(c, q).every((i) => before[i] === 1)).toBe(false);
  });
});
