/**
 * One-time data pipeline: downloads the Uthmani Quran text plus Madinah Mushaf
 * layout (604 pages, 15 lines) from the Quran.com API v4 and writes it to
 * data/quran.json. The text is never written or edited by hand or by AI.
 *
 * Run:  pnpm fetch:quran
 *
 * Output shape (compact on purpose, ~1.4 MB):
 *   surahs: [{ n, name (Arabic), nameEn, ayahs, revelation }]
 *   ayahs:  [[surah, ayah, juz, page, startLine, endPage, endLine, text], ...]  (6236 rows, mushaf order)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

const API = "https://api.quran.com/api/v4";
const OUT = join(process.cwd(), "data", "quran.json");

type ApiWord = { line_number: number; page_number: number; char_type_name: string };
type ApiVerse = {
  verse_key: string;
  verse_number: number;
  text_uthmani: string;
  juz_number: number;
  page_number: number;
  words: ApiWord[];
};

async function getJson<T>(url: string, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } catch (err) {
      if (i >= tries) throw new Error(`Failed ${url}: ${String(err)}`);
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}

async function fetchPage(page: number): Promise<ApiVerse[]> {
  const url =
    `${API}/verses/by_page/${page}?words=true&word_fields=line_number,page_number` +
    `&fields=text_uthmani,juz_number,page_number&per_page=50`;
  const data = await getJson<{ verses: ApiVerse[]; pagination: { total_pages: number } }>(url);
  if (data.pagination.total_pages !== 1) throw new Error(`Page ${page} has more than 50 ayahs`);
  return data.verses;
}

async function main() {
  const chapters = await getJson<{
    chapters: { id: number; name_arabic: string; name_simple: string; verses_count: number; revelation_place: string }[];
  }>(`${API}/chapters`);

  const verses: ApiVerse[] = [];
  const pages = Array.from({ length: 604 }, (_, i) => i + 1);
  const CONCURRENCY = 6;
  for (let i = 0; i < pages.length; i += CONCURRENCY) {
    const batch = await Promise.all(pages.slice(i, i + CONCURRENCY).map(fetchPage));
    for (const b of batch) verses.push(...b);
    process.stdout.write(`\rpages ${Math.min(i + CONCURRENCY, 604)}/604`);
  }
  process.stdout.write("\n");

  const ayahs = verses.map((v) => {
    const [s, a] = v.verse_key.split(":").map(Number);
    const words = v.words;
    const first = words[0];
    const last = words[words.length - 1];
    return [
      s,
      a,
      v.juz_number,
      first.page_number,
      first.line_number,
      last.page_number,
      last.line_number,
      v.text_uthmani.trim(),
    ] as const;
  });

  // ---- Verification: fail loudly rather than ship a wrong dataset ----
  if (ayahs.length !== 6236) throw new Error(`Expected 6236 ayahs, got ${ayahs.length}`);
  const seen = new Set<string>();
  for (const r of ayahs) {
    const k = `${r[0]}:${r[1]}`;
    if (seen.has(k)) throw new Error(`Duplicate ayah ${k}`);
    seen.add(k);
    if (r[4] < 1 || r[4] > 15 || r[6] < 1 || r[6] > 15) throw new Error(`Bad line at ${k}`);
    if (!r[7]) throw new Error(`Empty text at ${k}`);
  }
  for (const c of chapters.chapters) {
    const n = ayahs.filter((r) => r[0] === c.id).length;
    if (n !== c.verses_count) throw new Error(`Surah ${c.id}: expected ${c.verses_count}, got ${n}`);
  }
  const pageSet = new Set(ayahs.map((r) => r[3]));
  if (pageSet.size !== 604) throw new Error(`Expected 604 start pages, got ${pageSet.size}`);

  const out = {
    source: "Quran.com API v4 (text_uthmani; Madinah Mushaf 15-line layout)",
    fetchedAt: new Date().toISOString().slice(0, 10),
    surahs: chapters.chapters.map((c) => ({
      n: c.id,
      name: c.name_arabic,
      nameEn: c.name_simple,
      ayahs: c.verses_count,
      revelation: c.revelation_place,
    })),
    ayahs,
  };
  const json = JSON.stringify(out);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, json);
  const sha = createHash("sha256").update(json).digest("hex");
  writeFileSync(OUT + ".sha256", sha + "\n");
  console.log(`Wrote ${OUT} (${(json.length / 1e6).toFixed(2)} MB), sha256 ${sha.slice(0, 12)}…`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
