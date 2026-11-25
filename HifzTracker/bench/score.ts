/**
 * Scores what a recognizer heard, the way the app follows it (Hearing, the same code as the recite
 * screen): each page recited as a phone would send it, word by word with a pause after each ayah.
 * Three times per page: recited right (every word flagged is a false mistake), with an ayah skipped,
 * and with a look-alike ayah said in place of the right one (both should be caught).
 *
 *   tsx bench/score.ts [recognizer…]     (default: every recognizer heard so far)
 * Writes bench/.cache/report.md.
 */
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Hearing, type Settled } from "../src/recite/hearing";
import { align, fold, quranWords } from "../src/recite/match";
import { heardWords } from "../src/recite/webspeech";
import { CACHE, fileOf, nameOf, quran, RECITATIONS, words } from "./common";
import { loadHeard, type HeardFile } from "./hear";
import { lookAlike, pageAyahs, PAGES, skipped } from "./pages";

const known = quranWords(quran);

type Outcome = { status: (Settled | "pending")[]; at: number[] };

/** Recites `said` (the transcripts of these ayahs, in order) against the page and what follows it. */
function recite(expectedAyahs: number[], said: string[]): Outcome {
  const at = expectedAyahs.flatMap((a) => words(a).map(() => a));
  const expected = expectedAyahs.flatMap(words);
  const status: Outcome["status"] = expected.map(() => "pending");
  const h = new Hearing(expected, known, () => expected.length, {
    statuses: (updates) => {
      for (const [i, s] of updates) status[i] = s;
    },
  });
  // One session, as on a phone: its text grows word by word, and you pause after each ayah.
  let text = "";
  for (const ayah of said) {
    for (const w of ayah.split(/\s+/).filter(Boolean)) {
      text = `${text} ${w}`.trim();
      h.hear(text);
    }
    h.settle(false);
  }
  h.settle(true);
  return { status, at };
}

type PageScore = {
  page: number;
  words: number;
  /** Recited right: words flagged anyway (false mistakes), and words never reached. */
  falseFlags: { word: string; ayah: number; status: string }[];
  notReached: number;
  skip?: { caught: boolean; falseFlags: number };
  swap?: { caught: boolean; falseFlags: number; ayah: number; instead: number };
};

function scorePage(page: number, heard: HeardFile): PageScore | null {
  const ayahs = pageAyahs(page);
  const textOf = (a: number) => (heard[fileOf(a)]?.text ?? "").trim();
  if (ayahs.some((a) => !heard[fileOf(a)])) return null;
  // What's recited against: this page and the next (as in the app, which looks a page ahead).
  const next = page < 604 ? pageAyahs(page + 1) : [];
  const portion = [...ayahs, ...next];
  const flagsIn = (o: Outcome, only?: (ayah: number) => boolean) =>
    o.status.flatMap((s, i) => ((s === "wrong" || s === "skipped") && ayahs.includes(o.at[i]) && (!only || only(o.at[i])) ? [i] : []));
  const clean = recite(portion, ayahs.map(textOf));
  const expected = portion.flatMap(words);
  const score: PageScore = {
    page,
    words: ayahs.reduce((n, a) => n + words(a).length, 0),
    falseFlags: flagsIn(clean).map((i) => ({ word: expected[i], ayah: clean.at[i], status: clean.status[i] })),
    notReached: clean.status.filter((s, i) => s === "pending" && ayahs.includes(clean.at[i])).length,
  };
  const skip = skipped(page);
  if (skip !== null) {
    const o = recite(portion, ayahs.filter((a) => a !== skip).map(textOf));
    const inSkipped = flagsIn(o, (a) => a === skip).length;
    score.skip = { caught: inSkipped >= words(skip).length / 2, falseFlags: flagsIn(o, (a) => a !== skip).length };
  }
  const swap = lookAlike(page);
  if (swap && heard[fileOf(swap.instead)]) {
    const o = recite(portion, ayahs.map((a) => (a === swap.ayah ? textOf(swap.instead) : textOf(a))));
    // Caught: one of the words that differ is flagged.
    const theirs = new Set(words(swap.instead).map(fold));
    const differs = (i: number) => !theirs.has(fold(expected[i]));
    const flagged = flagsIn(o, (a) => a === swap.ayah);
    score.swap = { caught: flagged.some(differs), falseFlags: flagsIn(o, (a) => a !== swap.ayah).length, ayah: swap.ayah, instead: swap.instead };
  }
  return score;
}

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "–");

/**
 * How the recognizer got words wrong, ayah by ayah (each heard on its own and checked against its own
 * words): what the app can forgive (a spelling) and what it can't (another word, or nothing at all).
 */
function kinds(heard: HeardFile): string[] {
  const count = new Map<string, { n: number; examples: string[] }>();
  let words_ = 0;
  for (const a of PAGES.flatMap(pageAyahs)) {
    const exp = words(a);
    const h = heardWords(heard[fileOf(a)]?.text ?? "");
    const r = align(exp, h, 0, { known, stopped: "end" });
    words_ += exp.length;
    exp.forEach((w, i) => {
      const s = r.statuses.find((x) => x.index === i);
      if (s?.status === "correct") return;
      const e = fold(w);
      const x = s && s.heard >= 0 ? fold(h[s.heard]) : "";
      let kind = !x ? "not written at all" : known.has(x) ? "another word of the Quran" : "a word the Quran doesn't have";
      if (x && e[0] === "و" && e.slice(1) === x) kind = "its و left out";
      else if (x && (x === "ال" + e || (e.startsWith("ال") && e.slice(2) === x))) kind = "ال added or left out";
      else if (x && (e.startsWith(x) || x.startsWith(e))) kind += " (the ending differs)";
      const k = count.get(kind) ?? { n: 0, examples: [] };
      k.n++;
      if (k.examples.length < 6) k.examples.push(`${w} ← ${x || "∅"}`);
      count.set(kind, k);
    });
  }
  return [...count].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `- ${pct(v.n, words_)} ${k}: ${v.examples.join(" · ")}`);
}

function report(recognizer: string, folder: string): { summary: string; detail: string } {
  const heard = loadHeard(recognizer, folder);
  const scores = PAGES.map((p) => scorePage(p, heard)).filter((s): s is PageScore => !!s);
  const words = scores.reduce((n, s) => n + s.words, 0);
  const falseFlags = scores.reduce((n, s) => n + s.falseFlags.length, 0);
  const cleanPages = scores.filter((s) => !s.falseFlags.length && !s.notReached).length;
  const skips = scores.filter((s) => s.skip);
  const swaps = scores.filter((s) => s.swap);
  const summary = [
    `| ${recognizer} · ${folder} | ${scores.length} | ${pct(falseFlags, words)} (${falseFlags} of ${words}) | ${cleanPages} of ${scores.length} |`,
    `${skips.filter((s) => s.skip!.caught).length}/${skips.length} | ${swaps.filter((s) => s.swap!.caught).length}/${swaps.length} |`,
  ].join(" ");
  const lines = [`## ${recognizer} · ${folder}`, "", "Words it got wrong, by kind (each ayah on its own):", "", ...kinds(heard), ""];
  lines.push("Words flagged on pages recited right (false mistakes), with what was heard for the ayah:", "");
  for (const s of scores)
    for (const f of s.falseFlags) lines.push(`- p${s.page} ${nameOf(f.ayah)} **${f.word}** (${f.status}) ← ${(heard[fileOf(f.ayah)]?.text ?? "").trim() || "(nothing heard)"}`);
  const missedSkips = skips.filter((s) => !s.skip!.caught);
  const missedSwaps = swaps.filter((s) => !s.swap!.caught);
  if (missedSkips.length) lines.push("", `Skipped ayahs not caught: ${missedSkips.map((s) => `p${s.page} ${nameOf(skipped(s.page)!)}`).join(", ")}`);
  if (missedSwaps.length)
    lines.push("", "Look-alike ayahs not caught:", ...missedSwaps.map((s) => `- p${s.page} ${nameOf(s.swap!.instead)} said for ${nameOf(s.swap!.ayah)}: ${quran[s.swap!.instead]} ← ${heard[fileOf(s.swap!.instead)]?.text}`));
  const notReached = scores.filter((s) => s.notReached);
  if (notReached.length) lines.push("", `Words never reached (lost its place): ${notReached.map((s) => `p${s.page} ${s.notReached}`).join(", ")}`);
  return { summary, detail: lines.join("\n") };
}

function main() {
  const asked = process.argv.slice(2);
  const recognizers = asked.length ? asked : existsSync(join(CACHE, "heard")) ? readdirSync(join(CACHE, "heard")) : [];
  const rows: string[] = [];
  const details: string[] = [];
  for (const r of recognizers)
    for (const folder of Object.values(RECITATIONS)) {
      if (!existsSync(join(CACHE, "heard", r, folder + ".json"))) continue;
      const { summary, detail } = report(r, folder);
      rows.push(summary);
      details.push(detail);
    }
  const out = [
    "# Recognition bench",
    "",
    `${PAGES.length} pages from all over the Quran (bench/pages.ts), recited by professional reciters (EveryAyah), heard by each recognizer and followed by the app's own logic.`,
    "",
    "| Recognizer · recitation | Pages | Words wrongly flagged | Pages with no false flag | Skipped ayahs caught | Look-alike ayahs caught |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    ...details,
  ].join("\n");
  writeFileSync(join(CACHE, "report.md"), out + "\n");
  console.log(["| Recognizer · recitation | Pages | Words wrongly flagged | Clean pages | Skips caught | Look-alikes caught |", ...rows].join("\n"));
}
main();
