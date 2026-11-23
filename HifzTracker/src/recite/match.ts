/**
 * Recite and check: comparing what the speech model heard with the real text.
 * Pure and tested. Only words are checked (skipped, wrong), not tajweed.
 *
 * The Quran text is Uthmani; the model writes plain Arabic. Both are folded to
 * a common spelling (no vowel marks, one alef, etc.) and compared fuzzily, so
 * small spelling differences between the scripts don't count as mistakes.
 */

/** Waqf (pause) signs and other marks that stand alone between words in the Uthmani text. */
const STANDALONE_MARK = /^[ۖ-ٰۭ࣓-ࣿؐ-ؚ۞۩]+$/;

/** The words of one ayah as written (for display), without stand-alone pause signs. */
export function ayahWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w && !STANDALONE_MARK.test(w));
}

/** One word in a common spelling for comparing Uthmani text with plain Arabic. */
export function fold(word: string): string {
  return word
    .replace(/ٰ/g, "ا") // superscript alef → alef (Uthmani الكتـٰب = الكتاب)
    .replace(/[آأإٱٲٳ]/g, "ا") // alef forms
    .replace(/ى/g, "ي") // alef maqsura → ya
    .replace(/ة/g, "ه") // ta marbuta → ha
    .replace(/[ؤ]/g, "و") // waw hamza → waw
    .replace(/[ئ]/g, "ي") // ya hamza → ya
    .replace(/[ً-ٟۖ-ۭ࣓-ࣿؐ-ؚـ]/g, "") // vowel marks, Quranic marks, tatweel
    .replace(/[^ء-ي]/g, ""); // letters only
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** 1 = same word, 0 = nothing alike. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const len = Math.max(a.length, b.length);
  return len ? 1 - editDistance(a, b) / len : 0;
}

/**
 * Close enough to count as the right word: allows the usual script
 * differences and a misheard letter or two (the small model's typical slips,
 * e.g. ملك heard as تلك). Real mistakes are mostly other words or missing ones;
 * a false "mistake" is worse for the person than a missed one.
 */
export const SAME = 0.5;

export type WordStatus = "pending" | "correct" | "wrong" | "skipped";

export type Alignment = {
  /**
   * Status per expected word, from `from` on (earlier words are untouched).
   * `score`: how alike the heard and expected word were (0–1); `heard`: which heard word it was paired with.
   */
  statuses: { index: number; status: Exclude<WordStatus, "pending">; score: number; heard: number }[];
  /** First expected word not yet covered. */
  next: number;
};

/**
 * Aligns heard words to the expected words starting at `from` (edit-distance
 * alignment). Extra heard words (repeating yourself, "a'udhu billah") are
 * ignored. Expected words left out between two matched words are "skipped";
 * a heard word in the place of an expected one that doesn't match is "wrong".
 * Words after the last heard one stay pending.
 */
/** Cost of a heard word that isn't in the text (repeating yourself): cheaper than a skip, dearer than a near-match. */
const EXTRA = 0.8;

export function align(expected: string[], heard: string[], from: number): Alignment {
  const e = expected.slice(from, from + heard.length + 8).map(fold);
  const h = heard.map(fold).filter(Boolean);
  if (!h.length || !e.length) return { statuses: [], next: from };
  const n = e.length;
  const m = h.length;
  // cost[i][j]: aligning e[0..i) with h[0..j). Skipping an expected word costs 1, an extra heard word EXTRA,
  // pairing two words 1.3 × (1 − similarity): a near-match is cheap, a wrong word ~1.3.
  const cost = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 1 diag, 2 skip expected, 3 extra heard
  for (let i = 1; i <= n; i++) {
    cost[i][0] = i;
    move[i][0] = 2;
  }
  for (let j = 1; j <= m; j++) {
    cost[0][j] = j * EXTRA;
    move[0][j] = 3;
  }
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      // A wrong word costs a bit more than a skipped one, so a later exact match pulls the alignment into place.
      const diag = cost[i - 1][j - 1] + 1.3 * (1 - similarity(e[i - 1], h[j - 1]));
      const skip = cost[i - 1][j] + 1;
      const extra = cost[i][j - 1] + EXTRA;
      if (diag <= skip && diag <= extra) {
        cost[i][j] = diag;
        move[i][j] = 1;
      } else if (skip <= extra) {
        cost[i][j] = skip;
        move[i][j] = 2;
      } else {
        cost[i][j] = extra;
        move[i][j] = 3;
      }
    }
  // Everything heard must be used; the expected side may stop early (the rest is still to come).
  let best = 0;
  for (let i = 1; i <= n; i++) if (cost[i][m] < cost[best][m]) best = i;
  const statuses: Alignment["statuses"] = [];
  let i = best;
  let j = m;
  while (i > 0 || j > 0) {
    const mv = move[i][j];
    if (mv === 1) {
      const score = similarity(e[i - 1], h[j - 1]);
      statuses.push({ index: from + i - 1, status: score >= SAME ? "correct" : "wrong", score, heard: j - 1 });
      i--;
      j--;
    } else if (mv === 2) {
      statuses.push({ index: from + i - 1, status: "skipped", score: 0, heard: -1 });
      i--;
    } else j--;
  }
  statuses.reverse();
  // Trailing skips aren't mistakes yet: the person may simply not have got there.
  while (statuses.length && statuses[statuses.length - 1].status === "skipped") statuses.pop();
  const last = statuses[statuses.length - 1];
  return { statuses, next: last ? last.index + 1 : from };
}

/** A match this close is trusted from a single pass (it locks the word in as right). */
export const SURE = 0.75;

export type Rating = "strong" | "okay" | "weak";

/**
 * A suggested rating from the result: no mistakes and no help → Strong; a few
 * (up to 1 in 20 words, at least 2) → Okay; more → Weak. Each hint counts as
 * half a mistake.
 */
export function suggestRating(words: number, mistakes: number, hints: number): Rating {
  const score = mistakes + hints / 2;
  if (score === 0) return "strong";
  if (score <= Math.max(2, words / 20)) return "okay";
  return "weak";
}

/**
 * The hint for a word after `presses` presses: short words show whole at
 * once; longer ones one more letter each time, then the whole word.
 */
export function hintText(word: string, presses: number): string {
  if (presses <= 0) return "";
  const letters = [...word.matchAll(/[ء-يٱ][ً-ٰٟۖ-ۭ]*/g)].map((m) => m[0]);
  if (letters.length <= 3 || presses >= letters.length) return word;
  return letters.slice(0, presses).join("") + "…";
}
