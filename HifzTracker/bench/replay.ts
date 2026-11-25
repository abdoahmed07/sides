/**
 * Replays a recitation recording (saved from the app: "Save a recording of this recitation") through the
 * app's logic as it is now, with the phone's results at the moments they came: what each word comes to,
 * and every word flagged with what the phone wrote.
 *
 *   tsx bench/replay.ts <recording.json>…
 */
import { readFileSync } from "node:fs";
import { Hearing, type Settled } from "../src/recite/hearing";
import { ayahWords, quranWords } from "../src/recite/match";
import { assemble } from "../src/recite/webspeech";
import { q, quran } from "./common";

/** The app settles what was heard once the text hasn't changed for this long (ReciteCheck's SETTLE_MS). */
const SETTLE_MS = 1800;
const known = quranWords(quran);

type Event = [number, string, unknown?];

export function replay(path: string) {
  const rec = JSON.parse(readFileSync(path, "utf8")) as { meta: { ayahs: [number, number] }; events: Event[] };
  const [a, b] = rec.meta.ayahs;
  const ayahs = Array.from({ length: b - a + 1 }, (_, k) => a + k);
  const ayahOf = ayahs.flatMap((ay) => ayahWords(quran[ay]).map(() => ay));
  const expected = ayahs.flatMap((ay) => ayahWords(quran[ay]));
  // The portion's mushaf pages, as the app has them, and where it looks for you: no further than the next page.
  const pages: [number, number][] = [];
  ayahOf.forEach((ay, i) => {
    const last = pages[pages.length - 1];
    if (last && q.pageOf[ayahOf[last[0]]] === q.pageOf[ay]) last[1] = i + 1;
    else pages.push([i, i + 1]);
  });
  const pageOf = (i: number) => Math.max(0, pages.findIndex(([x, y]) => i >= x && i < y));
  const status: (Settled | "pending")[] = expected.map(() => "pending");
  const h = new Hearing(expected, known, (from) => pages[Math.min(pages.length - 1, pageOf(from) + 1)]?.[1] ?? expected.length, {
    statuses: (updates) => {
      for (const [i, s] of updates) status[i] = s;
    },
  });
  let lastText = "";
  let deadline = Infinity;
  for (const [t, kind, data] of rec.events) {
    if (deadline <= t) {
      h.settle(false);
      deadline = Infinity;
    }
    if (kind === "listen") h.newSession();
    else if (kind === "result") {
      const parts = (data as [string, boolean][]).map((r) => r[0]);
      lastText = assemble(parts);
      h.hear(lastText);
      if ((data as [string, boolean][]).every((r) => r[1])) {
        h.settle(false);
        deadline = Infinity;
      } else deadline = t + SETTLE_MS;
    } else if (kind === "end") {
      h.sessionEnded();
      deadline = Infinity;
    }
  }
  h.settle(true);
  const reached = status.findLastIndex((s) => s !== "pending") + 1;
  const flagged = status.flatMap((s, i) => (s === "wrong" || s === "skipped" ? [`${expected[i]} (${s}, ${q.surahOf[ayahOf[i]]}:${q.ayahOf[ayahOf[i]]})`] : []));
  return { right: status.slice(0, reached).filter((s) => s === "correct").length, reached, flagged, lastText };
}

if (process.argv[1]?.endsWith("replay.ts"))
  for (const path of process.argv.slice(2)) {
    const r = replay(path);
    console.log(`${path.split("/").pop()}: ${r.right} of ${r.reached} words right`);
    for (const f of r.flagged) console.log(`  ${f}`);
  }
