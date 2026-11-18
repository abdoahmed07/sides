/**
 * The memorization sequence: which ayahs the plan covers and in what order.
 *  - forward:  mushaf order (e.g. Al-Baqarah onwards).
 *  - backward: surahs in descending order, each surah read top to bottom
 *              (the traditional "Juz 30 backwards": An-Nas, Al-Falaq, ...).
 * The sequence is rotated to begin at the configured start ayah.
 */
import type { QuranIndex } from "../quran";
import type { MemorizedSelection, PlanConfig, Target } from "./schema";

export function targetIndices(target: Target, q: QuranIndex): number[] {
  const out = new Set<number>();
  const addRange = ([a, b]: [number, number]) => {
    for (let i = a; i <= b; i++) out.add(i);
  };
  switch (target.type) {
    case "quran":
      addRange([0, q.count - 1]);
      break;
    case "juz":
      target.juz.forEach((j) => addRange(q.juzRange(j)));
      break;
    case "surah":
      target.surahs.forEach((s) => addRange(q.surahRange(s)));
      break;
    case "pages":
      for (let p = target.from; p <= target.to; p++) addRange(q.pageRange(p));
      break;
  }
  return [...out].sort((a, b) => a - b);
}

export function selectionIndices(sel: MemorizedSelection, q: QuranIndex): number[] {
  switch (sel.type) {
    case "surah":
      return targetIndices({ type: "surah", surahs: sel.surahs }, q);
    case "juz":
      return targetIndices({ type: "juz", juz: sel.juz }, q);
    case "pages":
      return targetIndices({ type: "pages", from: sel.from, to: sel.to }, q);
    case "ayahs": {
      const a = q.indexOf(sel.surah, sel.from);
      const b = q.indexOf(sel.surah, sel.to);
      if (a < 0 || b < 0) return [];
      return Array.from({ length: b - a + 1 }, (_, k) => a + k);
    }
  }
}

function orderKey(direction: PlanConfig["direction"], q: QuranIndex, i: number): number {
  return direction === "forward" ? i : (115 - q.surahOf[i]) * 1000 + q.ayahOf[i];
}

export function buildSequence(config: Pick<PlanConfig, "target" | "direction" | "start">, q: QuranIndex): number[] {
  const ordered = targetIndices(config.target, q).sort(
    (a, b) => orderKey(config.direction, q, a) - orderKey(config.direction, q, b),
  );
  const startIdx = q.indexOf(config.start.surah, config.start.ayah);
  if (startIdx < 0 || ordered.length === 0) return ordered;
  const startKey = orderKey(config.direction, q, startIdx);
  let pos = ordered.findIndex((i) => orderKey(config.direction, q, i) >= startKey);
  if (pos < 0) pos = 0;
  return pos === 0 ? ordered : [...ordered.slice(pos), ...ordered.slice(0, pos)];
}

export type Portion = { indices: number[]; lines: number };

/**
 * Takes the next daily portion: starting at the first not-yet-memorized ayah
 * at or after `fromPos`, add ayahs in sequence order while that brings the
 * portion closer to `quotaLines` (so the average matches the daily amount;
 * a single ayah longer than the quota is taken alone).
 * Stops at a gap (already-memorized ayah) or a jump of more than one page.
 */
export function takePortion(
  seq: number[],
  memorized: Uint8Array,
  quotaLines: number,
  q: QuranIndex,
  fromPos = 0,
): Portion & { startPos: number; endPos: number } {
  let pos = fromPos;
  while (pos < seq.length && memorized[seq[pos]]) pos++;
  const startPos = pos;
  const indices: number[] = [];
  const spans = new Map<number, [number, number]>();
  let lines = 0;
  if (quotaLines <= 0) return { indices, lines, startPos, endPos: pos };
  while (pos < seq.length) {
    const i = seq[pos];
    if (memorized[i]) break;
    const p = q.pageOf[i];
    if (indices.length) {
      const prevPage = q.pageOf[indices[indices.length - 1]];
      if (Math.abs(p - prevPage) > 1) break;
    }
    const cur = spans.get(p);
    const s = q.startLineOf[i];
    const e = q.endLineOf[i];
    const nextSpan: [number, number] = cur ? [Math.min(cur[0], s), Math.max(cur[1], e)] : [s, e];
    const nextLines = lines - (cur ? cur[1] - cur[0] + 1 : 0) + (nextSpan[1] - nextSpan[0] + 1);
    // Aim for the closest fit: go over the quota only if that lands nearer to it
    // than stopping short (long ayahs would otherwise make every day too small).
    if (indices.length && nextLines > quotaLines && nextLines - quotaLines >= quotaLines - lines) break;
    spans.set(p, nextSpan);
    lines = nextLines;
    indices.push(i);
    pos++;
  }
  return { indices, lines, startPos, endPos: pos };
}

export type ContinuationStep = { index: number; lines: number };

/**
 * The ayahs that come right after `afterIndex` in the plan's order, for
 * recording extra memorization ("I went further today"). Each step carries the
 * total lines up to and including that ayah. Stops at already-memorized
 * material, at the end of the target, or after `maxLines`.
 */
export function continuation(
  seq: number[],
  memorized: Uint8Array,
  afterIndex: number,
  q: QuranIndex,
  maxLines = 45,
): ContinuationStep[] {
  const at = seq.indexOf(afterIndex);
  if (at < 0) return [];
  const out: ContinuationStep[] = [];
  const picked: number[] = [];
  for (let pos = at + 1; pos < seq.length; pos++) {
    const i = seq[pos];
    if (memorized[i]) break;
    picked.push(i);
    const lines = q.linesOf(picked);
    if (lines > maxLines && out.length) break;
    out.push({ index: i, lines });
  }
  return out;
}
