/**
 * Following a recitation from the phone's speech recognition as the words come in: where you are,
 * which words are settled (they won't change any more), and what's still live. Pure, so it can be tested.
 *
 *  - Words are matched from where you are (`align`, strictly).
 *  - What you say may not follow on from where you were: you started further on in the portion
 *    (Ayat al-Kursi in a whole Al-Baqarah), or skipped ahead. Then it's looked up in the text and
 *    followed from there; words you went past are skipped. Going back to repeat yourself isn't a
 *    mistake.
 *  - Reciting on without a pause, words are settled once they're well behind the latest, so each new
 *    word takes as little checking however long you go on.
 *  - When you pause or finish, everything heard is settled (`align`'s `stopped`).
 */
import { align, findRun, isAround, LOOSE_SCORE, wordFits, type Alignment } from "./match";

/** Words in a row it takes to tell where you are, when it isn't where you were. */
export const JUMP_RUN = 4;
/**
 * A run found in more than one place is listened to for up to this many words, to tell which (Ash-Shu'ara
 * repeats whole ayahs, Al-Hajj 22:3 and 22:8 open with the same eight words).
 */
const RUN_MAX = 30;
/** Live words: past this many, the older ones are settled… */
const LIVE_MAX = 30;
/** …all but this many. */
const LIVE_KEEP = 10;
/** Where you started has to fit at least this share of the words heard. */
const FIT_MOST = 0.7;
/** How far back going back to repeat yourself is recognized. */
const REPEAT_BACK = 250;
/** A few words you stopped on that are said a little further on (this many words at most): you skipped to them. */
const NEAR = 40;

type Statuses = Alignment["statuses"];

export type Step = {
  /** Settled: these words won't change. */
  settled: Statuses;
  /** The first word not settled: reciting goes on from here. */
  next: number;
  /** How many of the heard words are used up (from the start); the rest are heard again with what comes next. */
  used: number;
  /** What's still live, matched from `next` (to show while reciting). */
  live: Alignment | null;
  /** Where you started, when you started further on than where you were. */
  start?: number;
};

export type FollowOptions = {
  /** Every word of the Quran (`quranWords`), for the strict check. */
  known: Set<string>;
  /** live: still reciting; pause: you've paused (and may go on); end: you've finished. */
  mode: "live" | "pause" | "end";
  /** Whether you've started reciting (any word settled yet). */
  begun: boolean;
  /**
   * Where to look for you when you aren't where you were: only before this word (the end of the next
   * page, reciting page by page), so a phrase that comes again much later can't pull you there.
   */
  searchEnd?: number;
};

/** Follows the heard words from `from`. */
export function follow(expected: string[], heard: string[], from: number, { known, mode, begun, searchEnd = expected.length }: FollowOptions): Step {
  const settled: Statuses = [];
  let at = from;
  let used = 0;
  let start: number | undefined;
  let words = heard;
  /** Heard words before where you started, kept while that may still change. */
  let kept = 0;
  /**
   * Whether `words` still starts with the first word heard since the last pause, whose first sound (a و)
   * the phone may have missed (see align's `clipped`).
   */
  let clipped = true;
  /** How many heard words `words` no longer starts with: settled words say which heard word they were (of all of them). */
  let shift = 0;
  const ofAll = (st: Statuses): Statuses => (shift ? st.map((x) => (x.heard >= 0 ? { ...x, heard: x.heard + shift } : x)) : st);

  const found = findJump(expected, words, at, known, begun, mode, searchEnd);
  // Paused before it's clear where you started (the words so far are in more than one place): wait for more.
  if (found === "wait" && mode === "pause") return { settled, next: at, used, live: null };
  // Paused on a few words from further on: settle what came before, and wait for more of them.
  if (found && typeof found === "object" && "hold" in found) {
    const r = align(expected, words.slice(0, found.hold), at, { known, stopped: "pause", clipped });
    return { settled: r.statuses, next: Math.max(at, r.next), used: found.hold, live: null };
  }
  const jump = found === "wait" ? null : found;
  if (jump) {
    if (begun) {
      // What you said before going on from further on is settled; the words you went past are skipped.
      const before = align(expected, words.slice(0, jump.heard), at, { known, clipped });
      settled.push(...before.statuses);
      for (let i = before.next; i < jump.to; i++) settled.push({ index: i, status: "skipped", score: 0, heard: -1 });
    } else start = jump.to;
    at = jump.to;
    // Not started yet and reciting on, where you started may still change (2:163 or 2:255?): keep the
    // words before it until it's settled.
    if (!begun && mode === "live") kept = jump.heard;
    else used = jump.heard;
    words = words.slice(jump.heard);
    shift = jump.heard;
    clipped = clipped && !jump.heard;
  } else if (
    !begun &&
    mode === "pause" &&
    !align(expected, words, at, { known, clipped }).statuses.some((s) => s.status === "correct" && s.score > LOOSE_SCORE)
  ) {
    // Not started yet, and what you've said doesn't tell where you are: wait for more before deciding anything.
    // (A guess at opening letters, like اللهم for الٓمٓ, needs what comes after it too.)
    return { settled, next: at, used, live: null };
  }

  /**
   * Starting a few words on from where the portion starts is where you started: the words before aren't
   * skipped, just not recited (in a portion you were given, they count as not reached).
   */
  const fromStart = (statuses: Statuses): Statuses => {
    if (begun || start !== undefined) return statuses;
    let k = 0;
    while (k < statuses.length && statuses[k].status === "skipped") k++;
    if (!k || k === statuses.length) return statuses;
    start = statuses[k].index;
    return statuses.slice(k);
  };

  if (mode === "live") {
    let live = align(expected, words, at, { known, clipped });
    live = { ...live, statuses: fromStart(live.statuses) };
    // A long stretch without a pause: the older words are settled (the ones after them confirm them).
    if (words.length > LIVE_MAX) {
      const cut = words.length - LIVE_KEEP;
      const last = live.statuses.filter((s) => s.heard >= 0 && s.heard < cut).pop();
      if (last) {
        const part = live.statuses.filter((s) => s.index <= last.index);
        settled.push(...ofAll(part));
        const u = Math.max(...part.map((s) => s.heard)) + 1;
        used += kept + u;
        kept = 0;
        words = words.slice(u);
        shift += u;
        at = last.index + 1;
        live = align(expected, words, at, { known });
      }
    }
    // (Counted from the first heard word not used up, like `used`.)
    if (kept) live = { ...live, statuses: live.statuses.map((s) => (s.heard >= 0 ? { ...s, heard: s.heard + kept } : s)) };
    return { settled, next: at, used, live, start };
  }

  // Paused or finished: everything heard is settled. Going back to repeat yourself isn't a mistake: all of
  // what was heard (its first words may happen to fit where you are), or the words at the end.
  const live = align(expected, words, at, { known, clipped });
  const paired = live.statuses.reduce((m, s) => Math.max(m, s.heard + 1), 0);
  const fits = paired === words.length && live.statuses.every((s) => s.status === "correct");
  const said = fits
    ? words
    : words.length >= 3 && repeats(expected, words, at, known)
      ? []
      : words.length - paired >= 2 && repeats(expected, words.slice(paired), live.next, known)
        ? words.slice(0, paired)
        : words;
  const r = align(expected, said, at, { known, stopped: mode, clipped: clipped && said.length > 0 });
  settled.push(...ofAll(fromStart(r.statuses)));
  const rest = said === words ? (r.rest ?? 0) : 0;
  return { settled, next: Math.max(at, r.next), used: used + words.length - rest, live: null, start };
}

/**
 * Whether you went on from somewhere other than where you were, and where: the first heard word
 * that's from there and its place in the text.
 */
function findJump(
  expected: string[],
  words: string[],
  from: number,
  known: Set<string>,
  begun: boolean,
  mode: FollowOptions["mode"],
  searchEnd: number,
): { heard: number; to: number } | { hold: number } | "wait" | null {
  if (words.length < 2) return null;
  // (The words heard since the last pause: the first may be missing its و.)
  const local = align(expected, words, from, { known, clipped: true });
  /** Whether matching from where you are explains these heard words (two or more right, or all if fewer). */
  const explained = (a: number, b: number) =>
    local.statuses.filter((s) => s.status === "correct" && s.heard >= a && s.heard < b).length >= Math.min(2, b - a);
  /**
   * The words just before a run found may be from there too (like الله, which on its own doesn't tell
   * where), one by one or two written as one (يا بني = يَـٰبَنِىٓ).
   */
  const back = (heard: number, to: number, floor: number) => {
    while (heard > 0 && to > floor) {
      if (wordFits(expected[to - 1], words[heard - 1], known)) heard--;
      else if (heard > 1 && wordFits(expected[to - 1], words[heard - 2] + words[heard - 1], known)) heard -= 2;
      else break;
      to--;
    }
    return { heard, to };
  };

  if (!begun) {
    // Not started yet: the first words you say (after the isti'adha and basmala) are where you start,
    // at the start or further on.
    let a = 0;
    while (a < words.length && isAround(words[a])) a++;
    // Reciting, it takes a few words to be sure; once you pause or finish, fewer will do if they're clear.
    const need = mode === "live" ? JUMP_RUN : 2;
    // A word the phone misheard at the very start: try from the next one.
    for (let b = a; b <= a + 2 && b + need <= words.length; b++) {
      // The same words may be in more than one place (يا أيها الذين آمنوا opens many ayahs): listen to
      // more of them, to tell which.
      let places: number[] = [];
      let all = false;
      for (let len = Math.min(JUMP_RUN, words.length - b); len >= need; len++) {
        if (b + len > words.length) {
          all = true;
          break;
        }
        const found = findRun(expected, words.slice(b, b + len), known).filter((c) => c >= from && c < searchEnd);
        if (!found.length) break;
        places = found;
        if (found.length === 1 || len >= RUN_MAX) break;
      }
      if (!places.length) continue;
      // Still in more than one place with all that was heard: paused, wait to hear which; reciting on,
      // follow the first for now (nothing is settled until it's clear).
      if (places.length > 1 && all && mode === "pause") return "wait";
      // Otherwise the one all the words heard fit best (the words after may come after a skip), as long
      // as most of them do: a few words alike in another ayah (لا إله إلا هو is in 2:163 and 2:255) don't
      // make it the place.
      let to = places[0];
      let best = -1;
      for (const c of places.slice(0, 12)) {
        const right = align(expected, words.slice(b), c, { known }).statuses.filter((s) => s.status === "correct").length;
        if (right > best) [best, to] = [right, c];
      }
      if (best < FIT_MOST * (words.length - b)) continue;
      const j = back(b, to, from);
      return j.to > from ? j : null;
    }
    return null;
  }

  // Words that don't follow on from where you were (paired as mistakes, or left over at the end) but are
  // said just like that further on: you skipped to them. Close by, or four words or more, that's clear;
  // a few words further on (after a long ayah), wait for more to be sure (or decide, at the end). Words
  // said before too (a refrain, like Ar-Rahman's) may be you going back or on: wait to hear which.
  const paired = local.statuses.reduce((m, s) => Math.max(m, s.heard + 1), 0);
  const firstBad = Math.min(paired, ...local.statuses.filter((s) => s.status === "wrong").map((s) => s.heard));
  const lastGood = local.statuses.filter((s) => s.status === "correct" && s.heard < firstBad).pop();
  const floor = lastGood ? lastGood.index + 1 : from;
  const bad = words.slice(firstBad);
  if (bad.length >= (mode === "live" ? JUMP_RUN : 2)) {
    const places = findRun(expected, bad, known);
    const ahead = places.filter((c) => c > floor && c < searchEnd);
    if (ahead.length) {
      const before = places.some((c) => c < floor && c >= floor - REPEAT_BACK);
      if (before) {
        if (mode === "pause") return { hold: firstBad };
      } else if (ahead[0] <= floor + NEAR || bad.length >= JUMP_RUN || mode === "end") return back(firstBad, ahead[0], floor);
      else if (mode === "pause") return { hold: firstBad };
    }
  }
  // Going on from elsewhere: the latest words, when they don't follow on from where you are.
  if (words.length < JUMP_RUN) return null;
  const b = words.length - JUMP_RUN;
  if (explained(b, words.length)) return null;
  const places = findRun(expected, words.slice(b), known);
  // Said before: going back to repeat yourself.
  if (places.some((c) => c < local.next && c >= local.next - REPEAT_BACK)) return null;
  const ahead = places.filter((c) => c > local.next && c < searchEnd);
  return ahead.length ? back(b, ahead[0], local.next) : null;
}

/** Whether some heard words, all of them in a row, are a stretch said before (going back to repeat yourself). */
function repeats(expected: string[], run: string[], before: number, known: Set<string>): boolean {
  return findRun(expected, run, known).some((c) => c < before && c >= before - REPEAT_BACK);
}
