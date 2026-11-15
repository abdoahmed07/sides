/**
 * Derives data/quran-layout.json (numbers only, no text) from data/quran.json.
 * The planning engine only needs layout, so the home screen never loads the
 * full text; the text is loaded lazily when you open a portion.
 *
 * Run:  pnpm build:layout   (fetch:quran runs it automatically)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "data");
const q = JSON.parse(readFileSync(join(dir, "quran.json"), "utf8"));
const layout = {
  source: q.source,
  surahs: q.surahs,
  // [surah, ayah, juz, page, startLine, endLine]  (no ayah crosses a page in this mushaf)
  ayahs: q.ayahs.map((r: unknown[]) => [r[0], r[1], r[2], r[3], r[4], r[6]]),
};
writeFileSync(join(dir, "quran-layout.json"), JSON.stringify(layout));
// Text only, same order as layout.ayahs.
writeFileSync(join(dir, "quran-text.json"), JSON.stringify(q.ayahs.map((r: unknown[]) => r[7])));
console.log("Wrote data/quran-layout.json and data/quran-text.json");
