/**
 * Fast, read-only index over the Mushaf layout (no text). Every ayah has a
 * global index 0..6235 in mushaf order. No ayah crosses a page in the Madinah
 * Mushaf, so an ayah sits on exactly one page between startLine and endLine.
 */
import layoutJson from "../../../data/quran-layout.json";

export type SurahInfo = { n: number; name: string; nameEn: string; ayahs: number; revelation: string };
export type LayoutRow = [surah: number, ayah: number, juz: number, page: number, startLine: number, endLine: number];
export type Layout = { surahs: SurahInfo[]; ayahs: LayoutRow[] };

export const TOTAL_PAGES = 604;
export const LINES_PER_PAGE = 15;

export class QuranIndex {
  readonly count: number;
  readonly surahs: SurahInfo[];
  readonly surahOf: Uint8Array;
  readonly ayahOf: Uint16Array;
  readonly juzOf: Uint8Array;
  readonly pageOf: Uint16Array;
  readonly startLineOf: Uint8Array;
  readonly endLineOf: Uint8Array;
  private surahStart: number[] = [];
  private pageFirst = new Int16Array(TOTAL_PAGES + 1).fill(-1);
  private pageLast = new Int16Array(TOTAL_PAGES + 1).fill(-1);
  private juzFirst = new Int16Array(31).fill(-1);
  private juzLast = new Int16Array(31).fill(-1);
  /** Lines with text on each page (15 for all but pages 1-2). */
  readonly linesOnPage = new Uint8Array(TOTAL_PAGES + 1);

  constructor(layout: Layout) {
    const n = layout.ayahs.length;
    this.count = n;
    this.surahs = layout.surahs;
    this.surahOf = new Uint8Array(n);
    this.ayahOf = new Uint16Array(n);
    this.juzOf = new Uint8Array(n);
    this.pageOf = new Uint16Array(n);
    this.startLineOf = new Uint8Array(n);
    this.endLineOf = new Uint8Array(n);
    layout.ayahs.forEach(([s, a, j, p, sl, el], i) => {
      this.surahOf[i] = s;
      this.ayahOf[i] = a;
      this.juzOf[i] = j;
      this.pageOf[i] = p;
      this.startLineOf[i] = sl;
      this.endLineOf[i] = el;
      if (a === 1) this.surahStart[s] = i;
      if (this.pageFirst[p] < 0) this.pageFirst[p] = i;
      this.pageLast[p] = i;
      if (this.juzFirst[j] < 0) this.juzFirst[j] = i;
      this.juzLast[j] = i;
    });
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      // Pages whose last text line is 14 have a surah header on line 15; count the full page.
      const last = this.endLineOf[this.pageLast[p]];
      this.linesOnPage[p] = last >= 14 ? LINES_PER_PAGE : last;
    }
  }

  surah(n: number): SurahInfo {
    return this.surahs[n - 1];
  }

  indexOf(surah: number, ayah: number): number {
    const s = this.surahs[surah - 1];
    if (!s || ayah < 1 || ayah > s.ayahs) return -1;
    return this.surahStart[surah] + ayah - 1;
  }

  surahRange(surah: number): [number, number] {
    const first = this.surahStart[surah];
    return [first, first + this.surahs[surah - 1].ayahs - 1];
  }

  pageRange(page: number): [number, number] {
    return [this.pageFirst[page], this.pageLast[page]];
  }

  juzRange(juz: number): [number, number] {
    return [this.juzFirst[juz], this.juzLast[juz]];
  }

  juzPages(juz: number): [number, number] {
    return [this.pageOf[this.juzFirst[juz]], this.pageOf[this.juzLast[juz]]];
  }

  ayahsOnPage(page: number): number {
    return this.pageLast[page] - this.pageFirst[page] + 1;
  }

  /**
   * Size of a set of ayahs in Mushaf lines: for each page, the span from the
   * first ayah's start line to the last ayah's end line. Shared lines count once.
   */
  linesOf(indices: Iterable<number>): number {
    const span = new Map<number, [number, number]>();
    for (const i of indices) {
      const p = this.pageOf[i];
      const cur = span.get(p);
      const s = this.startLineOf[i];
      const e = this.endLineOf[i];
      if (!cur) span.set(p, [s, e]);
      else span.set(p, [Math.min(cur[0], s), Math.max(cur[1], e)]);
    }
    let total = 0;
    for (const [a, b] of span.values()) total += b - a + 1;
    return total;
  }

  label(i: number): string {
    return `${this.surah(this.surahOf[i]).nameEn} ${this.ayahOf[i]}`;
  }

  /**
   * Human label for a contiguous-ish set of ayahs, e.g. "Al-Mulk 1–12".
   * Surahs keep the order they appear in (so a backward portion reads
   * "Al-Falaq 1–5, Al-Ikhlas 1–4"); ayahs within a surah are sorted.
   */
  rangeLabel(indices: number[]): string {
    if (indices.length === 0) return "";
    const bySurah = new Map<number, number[]>();
    for (const i of indices) {
      const s = this.surahOf[i];
      const g = bySurah.get(s);
      if (g) g.push(i);
      else bySurah.set(s, [i]);
    }
    return [...bySurah.values()]
      .map((g) => g.sort((x, y) => x - y))
      .map((g) => {
        const s = this.surah(this.surahOf[g[0]]).nameEn;
        const a = this.ayahOf[g[0]];
        const b = this.ayahOf[g[g.length - 1]];
        return a === b ? `${s} ${a}` : `${s} ${a}–${b}`;
      })
      .join(", ");
  }
}

let cached: QuranIndex | null = null;
export function getQuran(): QuranIndex {
  if (!cached) cached = new QuranIndex(layoutJson as unknown as Layout);
  return cached;
}

export const SURAH_AYAH_COUNTS: number[] = (layoutJson as unknown as Layout).surahs.map((s) => s.ayahs);
