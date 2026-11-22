import { describe, expect, it } from "vitest";
import { diffDays } from "../src/core/dates";
import { NEVER } from "../src/core/plan/engine";
import { inWords, pageDoneDays, pagesBy } from "../src/core/plan/lookahead";
import { forecastFor, memorizeDaysFor } from "../src/core/plan/preview";
import { buildSequence, targetIndices } from "../src/core/plan/sequence";
import { markPrior } from "../src/core/memorize";
import { cfg, q, TODAY } from "./helpers";

describe("look ahead, day by day", () => {
  const c = cfg({ dailyNewLines: 15 });
  const units = markPrior([], targetIndices({ type: "pages", from: 582, to: 590 }, q), q, TODAY, 30);
  const f = forecastFor(c, units, q, TODAY);
  const ayahDays = memorizeDaysFor(c, units, q, TODAY);
  const done = pageDoneDays(ayahDays, q);
  const span = diffDays(TODAY, f.completionDate!);

  it("finishes the whole target exactly on the estimated finish date", () => {
    const seq = buildSequence(c, q);
    expect(Math.max(...seq.map((i) => ayahDays[i]))).toBe(span);
  });

  it("grows a little every study day, from what is memorized now to the whole target", () => {
    expect(pagesBy(done, -1)).toBe(9); // pages 582–590 already
    let prev = pagesBy(done, 0);
    let grewOn = 0;
    for (let d = 1; d <= span; d++) {
      const n = pagesBy(done, d);
      expect(n).toBeGreaterThanOrEqual(prev);
      if (n > prev) grewOn++;
      prev = n;
    }
    expect(prev).toBe(23); // all of Juz 30
    expect(grewOn).toBeGreaterThan(5);
  });

  it("marks pages outside the plan as never", () => {
    expect(done[1]).toBe(NEVER);
    expect(done[585]).toBe(-1);
  });

  it("describes the distance in plain words", () => {
    expect(inWords(1)).toBe("tomorrow");
    expect(inWords(9)).toBe("in 9 days");
    expect(inWords(21)).toBe("in 3 weeks");
    expect(inWords(120)).toBe("in 4 months");
    expect(inWords(900)).toBe("in 2.5 years");
  });
});
