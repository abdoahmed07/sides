/**
 * Links to the Quran reader (/read/). What to show is in the link, so it
 * works on the static build and can be bookmarked:
 *   ?a=6230-6235,6225-6229   ayahs (0-based, in reading order: a plan "from
 *                            the end" lists An-Nas before Al-Falaq)
 *   ?page=604 · ?surah=18 · ?juz=30
 *   &item=…&date=…           opened from a portion on Today (Recite can save it as done)
 */
export type ReadTarget =
  | { kind: "ayahs"; ayahs: number[] }
  | { kind: "page"; page: number }
  | { kind: "surah"; surah: number }
  | { kind: "juz"; juz: number }
  | { kind: "index" };

/** "6230-6235,6225-6229": runs of consecutive ayahs, keeping their order. */
export function encodeAyahs(ayahs: number[]): string {
  const runs: [number, number][] = [];
  for (const a of ayahs) {
    const last = runs[runs.length - 1];
    if (last && a === last[1] + 1) last[1] = a;
    else runs.push([a, a]);
  }
  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(",");
}

export function decodeAyahs(s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(",")) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = a; i <= b && i <= 6235 && out.length < 6236; i++) out.push(i);
  }
  return out;
}

const inRange = (v: string | null, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
};

export function parseTarget(params: URLSearchParams): ReadTarget {
  const a = params.get("a");
  if (a) {
    const ayahs = decodeAyahs(a);
    if (ayahs.length) return { kind: "ayahs", ayahs };
  }
  const page = inRange(params.get("page"), 604);
  if (page) return { kind: "page", page };
  const surah = inRange(params.get("surah"), 114);
  if (surah) return { kind: "surah", surah };
  const juz = inRange(params.get("juz"), 30);
  if (juz) return { kind: "juz", juz };
  return { kind: "index" };
}

export function readHref(target: Exclude<ReadTarget, { kind: "index" }>, from?: { item: string; date: string }): string {
  const p = new URLSearchParams();
  if (target.kind === "ayahs") p.set("a", encodeAyahs(target.ayahs));
  else if (target.kind === "page") p.set("page", String(target.page));
  else if (target.kind === "surah") p.set("surah", String(target.surah));
  else p.set("juz", String(target.juz));
  if (from) {
    p.set("item", from.item);
    p.set("date", from.date);
  }
  return `/read/?${p.toString().replace(/%2C/g, ",")}`;
}
