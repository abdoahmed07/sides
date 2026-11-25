/**
 * Which pages the bench recites, and the slips it makes on purpose: skipping an ayah, and saying a
 * look-alike ayah from elsewhere (a mutashabih) in place of the right one.
 */
import { fold } from "../src/recite/match";
import { nameOf, q, quran, words } from "./common";

/** A spread over the whole Quran: every 10th page, the first pages, and surahs that open with letters. */
export const PAGES = [
  ...new Set([1, 2, 3, ...Array.from({ length: 61 }, (_, k) => 4 + 10 * k), 50, 151, 249, 305, 312, 367, 440, 453, 483, 518, 564]),
].sort((a, b) => a - b);

export const pageAyahs = (page: number) => {
  const [a, b] = q.pageRange(page);
  return Array.from({ length: b - a + 1 }, (_, k) => a + k);
};

const plainWords = (ayah: number) => words(ayah).map(fold).filter(Boolean);
const pairs = (ws: string[]) => new Set(ws.slice(1).map((w, k) => ws[k] + " " + w));
let allPairs: Set<string>[] | null = null;

/** How alike two ayahs are: the share of word pairs they have in common (1: the same words). */
function alike(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const p of a) if (b.has(p)) shared++;
  return shared / Math.max(a.size, b.size);
}

/** The ayah from elsewhere most like one of the page's ayahs (but not the same words): a slip to make. */
export function lookAlike(page: number): { ayah: number; instead: number; alike: number } | null {
  allPairs ??= quran.map((_, i) => pairs(plainWords(i)));
  const mine = new Set(pageAyahs(page));
  let best: { ayah: number; instead: number; alike: number } | null = null;
  for (const ayah of mine) {
    if (plainWords(ayah).length < 4) continue;
    for (let other = 0; other < quran.length; other++) {
      if (mine.has(other)) continue;
      const s = alike(allPairs[ayah], allPairs[other]);
      if (s < 1 && s >= 0.4 && (!best || s > best.alike)) best = { ayah, instead: other, alike: s };
    }
  }
  return best;
}

/** The ayah skipped: one in the middle of the page (a slip from one ayah to the one after next). */
export function skipped(page: number): number | null {
  const ayahs = pageAyahs(page);
  return ayahs.length >= 4 ? ayahs[Math.floor(ayahs.length / 2)] : null;
}

/** Every ayah the bench needs audio for: the pages', and the look-alikes said in their place. */
export function neededAyahs(): number[] {
  const out = new Set<number>();
  for (const p of PAGES) {
    for (const a of pageAyahs(p)) out.add(a);
    const l = lookAlike(p);
    if (l) out.add(l.instead);
  }
  return [...out].sort((a, b) => a - b);
}

if (process.argv[1]?.endsWith("pages.ts")) {
  const need = neededAyahs();
  console.log(`${PAGES.length} pages, ${need.length} ayahs of audio`);
  for (const p of PAGES.slice(0, 6)) {
    const l = lookAlike(p);
    console.log(`page ${p}: ${pageAyahs(p).length} ayahs; look-alike ${l ? `${nameOf(l.instead)} for ${nameOf(l.ayah)} (${l.alike.toFixed(2)})` : "none"}`);
  }
}
