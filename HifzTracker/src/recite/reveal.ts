/**
 * What the reciter sees while reciting: which words are revealed, and when a
 * mistake shows. Pure, so it can be tested.
 *
 *  - Words are revealed strictly in order: nothing after the first word still
 *    being listened for (a later word heard first waits for it).
 *  - A word from a live (still changing) result shows as soon as it's heard
 *    right; the last heard word only when (almost) exact, since it may be cut
 *    off mid-word.
 *  - A live mistake shows only once you've said a couple of right words after
 *    it, so a word that's simply still coming isn't flagged. (When you pause,
 *    what you said is settled, a mistake you stopped on included: see
 *    `align`'s `stopped`.)
 */
import type { Alignment, WordStatus } from "./match";

/** Right words after a live mistake before it's shown. */
export const FLAG_AFTER = 2;
/** The last heard word of a live result is shown only when this close (it may be cut off). */
export const LAST_WORD_SURE = 0.9;

export type Live = { statuses: Alignment["statuses"]; heard: number };

/**
 * @param settled the words' settled statuses (from earlier parts)
 * @param live the current live result (aligned from the first unsettled word), if any
 * @param confirmed words already heard right by an earlier check (on-device mode)
 * @param start where you started reciting (the words before it aren't part of it)
 * @param wait not marking mistakes: a word not heard right stays hidden (waiting for you to say it
 *   again) until you've gone on and a word after it is heard right; then it shows as not heard
 * @returns what to show per word, and the first word still hidden
 */
export function reveal(
  settled: WordStatus[],
  live: Live | null,
  confirmed?: Set<number>,
  start = 0,
  wait = false,
): { status: WordStatus[]; next: number } {
  const status = settled.map((s, i): WordStatus => (s === "pending" && confirmed?.has(i) ? "correct" : s));
  if (live) {
    const ok = live.statuses.map(
      (s) => s.status === "correct" && (s.heard !== live.heard - 1 || s.score >= LAST_WORD_SURE),
    );
    let rightAfter = 0;
    for (let k = live.statuses.length - 1; k >= 0; k--) {
      const s = live.statuses[k];
      if (status[s.index] === "pending") {
        if (ok[k]) status[s.index] = "correct";
        else if (s.status !== "correct" && rightAfter >= FLAG_AFTER) status[s.index] = s.status;
      }
      if (ok[k]) rightAfter++;
    }
  }
  if (wait) {
    let lastRight = status.length - 1;
    while (lastRight >= 0 && status[lastRight] !== "correct") lastRight--;
    for (let i = lastRight + 1; i < status.length; i++) if (status[i] === "wrong" || status[i] === "skipped") status[i] = "pending";
  }
  let next = Math.min(start, status.length);
  while (next < status.length && status[next] !== "pending") next++;
  for (let i = next + 1; i < status.length; i++) status[i] = "pending";
  return { status, next };
}
