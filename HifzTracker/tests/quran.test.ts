import { describe, expect, it } from "vitest";
import { q } from "./helpers";

describe("Quran index", () => {
  it("has the full mushaf", () => {
    expect(q.count).toBe(6236);
    expect(q.surahs).toHaveLength(114);
    expect(q.pageOf[q.count - 1]).toBe(604);
  });

  it("looks up ayahs, surahs, pages and juz", () => {
    expect(q.indexOf(2, 1)).toBe(7);
    expect(q.indexOf(2, 287)).toBe(-1);
    expect(q.surahRange(114)).toEqual([6230, 6235]);
    expect(q.pageOf[q.indexOf(2, 1)]).toBe(2);
    expect(q.juzPages(30)[1]).toBe(604);
    expect(q.juzOf[q.indexOf(78, 1)]).toBe(30);
  });

  it("measures lines per page span, counting shared lines once", () => {
    const [a, b] = q.pageRange(300);
    const all = Array.from({ length: b - a + 1 }, (_, k) => a + k);
    expect(q.linesOf(all)).toBeLessThanOrEqual(15);
    expect(q.linesOf(all)).toBeGreaterThanOrEqual(13);
    expect(q.linesOf([])).toBe(0);
  });

  it("labels ranges", () => {
    const [a] = q.surahRange(67);
    expect(q.rangeLabel([a, a + 1, a + 2])).toBe("Al-Mulk 1–3");
  });
});
