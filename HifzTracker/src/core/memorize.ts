/**
 * Turning ayahs into memorized page units (and back). Pure.
 */
import type { IsoDate } from "./dates";
import type { QuranIndex } from "./quran";
import { addAyahs, priorUnit, type MemUnit } from "./srs";

function groupByPage(indices: number[], q: QuranIndex): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const i of indices) {
    const p = q.pageOf[i];
    const arr = m.get(p);
    if (arr) arr.push(i);
    else m.set(p, [i]);
  }
  return m;
}

/** Ayahs memorized today through the plan (the sabaq). */
export function memorizeNew(units: MemUnit[], indices: number[], q: QuranIndex, date: IsoDate): MemUnit[] {
  const byPage = new Map(units.map((u) => [u.page, u]));
  for (const [page, ayahs] of groupByPage(indices, q)) byPage.set(page, addAyahs(byPage.get(page), page, ayahs, date));
  return [...byPage.values()].sort((a, b) => a.page - b.page);
}

/** Material memorized before the app: due dates spread across one cycle. */
export function markPrior(
  units: MemUnit[],
  indices: number[],
  q: QuranIndex,
  date: IsoDate,
  cycleDays: number,
): MemUnit[] {
  const byPage = new Map(units.map((u) => [u.page, u]));
  let slot = 0;
  for (const [page, ayahs] of groupByPage(indices, q)) {
    const existing = byPage.get(page);
    if (existing) {
      const set = new Set([...existing.ayahs, ...ayahs]);
      byPage.set(page, { ...existing, ayahs: [...set].sort((a, b) => a - b) });
    } else {
      byPage.set(page, priorUnit(page, ayahs, date, slot++, cycleDays));
    }
  }
  return [...byPage.values()].sort((a, b) => a.page - b.page);
}

/** Removes ayahs from memorized units (e.g. marked by mistake). Empty pages disappear. */
export function unmark(units: MemUnit[], indices: number[]): MemUnit[] {
  const remove = new Set(indices);
  return units
    .map((u) => ({ ...u, ayahs: u.ayahs.filter((i) => !remove.has(i)) }))
    .filter((u) => u.ayahs.length > 0);
}
