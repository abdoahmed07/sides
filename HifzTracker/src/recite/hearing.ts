/**
 * Following what the phone's speech recognition writes, as it writes it. Its text comes as a running
 * transcript per session, changing as it goes (a guess, then its final version). This settles words
 * at pauses (`settle`), keeps a word it once wrote right, and checks words again when it rewrites
 * them. No timers and no screen: the recite screen drives it (and decides when you've paused), and so
 * does the recognition bench (bench/), so both follow a recitation exactly alike.
 */
import { follow, type Step } from "./follow";
import { align, fold, LOOSE_SCORE, wordFits, type WordStatus } from "./match";
import type { Live } from "./reveal";
import { heardWords } from "./webspeech";

/** The session's words, how many of them are settled, and the words not settled yet. */
type Pending = { words: string[]; base: number; fresh: string[] };

export type Settled = Exclude<WordStatus, "pending">;

export type HearingEvents = {
  /** Words settled, or turned right since. */
  statuses(updates: [index: number, status: Settled][]): void;
  /** Where you started, when it isn't where the portion starts (found from your first words). */
  start?(index: number): void;
  /** What's still being heard, to show while reciting (null: nothing). */
  live?(live: Live | null): void;
  /** Heard words just settled (for "what the app heard"). */
  said?(words: string[]): void;
  /** For a recording. */
  trace?(kind: string, data?: unknown): void;
};

/** A step in a recording: where matching started, heard words used, what was settled (index + s/c/w), where it goes on. */
export const stepTrace = (from: number, s: Step) => ({
  from,
  used: s.used,
  next: s.next,
  ...(s.start !== undefined && { start: s.start }),
  settled: s.settled.map((x) => `${x.index}${x.status[0]}`).join(" "),
});

export class Hearing {
  /** The first word not settled yet: what's heard next is matched from here. */
  pointer: number;
  /** Whether you've started: any word settled yet. */
  begun = false;
  /** Where you started, when it isn't where the portion starts. */
  start: number | null = null;
  /** Words of the current session already settled (what comes after them is new)… */
  private settledWords: string[] = [];
  /** …and the word of the text each was taken for (-1: none), to check again if the phone rewrites it. */
  private settledAt: number[] = [];
  /** What's being heard and isn't settled yet. */
  private pending: Pending | null = null;
  /** Words from an ended session that may be the start of the next word ("يا" of يا أيها). */
  private waiting: string[] = [];
  /** All the words waiting so far (those from ended sessions and the current one's). */
  private lastRest: string[] = [];
  /** A wrong word you stopped on: if the phone then corrects itself to the right word, it's no mistake. */
  private lastFlag: number | null = null;
  /** Words settled as mistakes (wrong or skipped), which may still turn right. */
  private mistakes = new Set<number>();
  /** Words the phone wrote right at some point: you said them, whatever it writes later. */
  private right = new Set<number>();

  constructor(
    private readonly expected: string[],
    private readonly known: Set<string>,
    /** Where to look for you when you aren't where you were (reciting page by page: the end of the next page). */
    private readonly searchEnd: (from: number) => number,
    private readonly on: HearingEvents,
    from = 0,
  ) {
    this.pointer = from;
  }

  /** Not started yet, a later page shown: reciting starts there. */
  startAt(index: number) {
    if (this.begun) return;
    this.pointer = index;
    this.start = index;
  }

  /** The current session's text so far, as the phone wrote it. */
  hear(transcript: string) {
    const heard = heardWords(transcript);
    // The words at the start that were already settled are skipped. If the recognizer started
    // over or changed its mind, fewer words match, and the rest simply counts as new.
    const done = this.settledWords;
    let base = 0;
    while (base < done.length && base < heard.length && fold(heard[base]) === fold(done[base])) base++;
    // The phone changed its mind about the word you'd stopped on (a drawn-out word it caught late):
    // if it's the right word now, it's no mistake.
    const flagged = this.lastFlag;
    if (flagged !== null && base < done.length && heard.slice(base, base + 2).some((w) => wordFits(this.expected[flagged], w, this.known))) {
      this.lastFlag = null;
      this.turnRight([flagged], "unflag");
    }
    if (base < done.length) this.recheck(heard, base);
    let p: Pending = { words: heard, base, fresh: [...this.waiting, ...heard.slice(base)] };
    const from = this.pointer;
    const step = follow(this.expected, p.fresh, from, { known: this.known, mode: "live", begun: this.begun, searchEnd: this.searchEnd(from) });
    if (step.settled.length || step.start !== undefined) this.on.trace?.("step", stepTrace(from, step));
    p = this.apply(p, step);
    this.pending = p;
    // Words written right (not the last, which may be cut off): they stay right whatever the phone writes later.
    for (const s of step.live?.statuses ?? [])
      if (s.status === "correct" && s.score > LOOSE_SCORE && s.heard >= 0 && s.heard < p.fresh.length - 1) this.right.add(s.index);
    this.on.live?.(step.live && { statuses: step.live.statuses, heard: p.fresh.length });
  }

  /**
   * Settles what was heard: you paused (or the phone says the words are final), so what you said last
   * counts too, and a wrong word you stopped on is a mistake. `end`: you've finished. Returns the words
   * that wait for what comes next (the start of a word, like "يا" of يا أيها).
   */
  settle(end: boolean): string[] {
    let p = this.pending ?? (this.waiting.length ? { words: this.settledWords, base: this.settledWords.length, fresh: this.waiting } : null);
    this.pending = null;
    if (!p) return this.lastRest;
    const from = this.pointer;
    const step = follow(this.expected, p.fresh, from, { known: this.known, mode: end ? "end" : "pause", begun: this.begun, searchEnd: this.searchEnd(from) });
    this.on.trace?.(end ? "end-settle" : "settle", stepTrace(from, step));
    // A wrong word you stopped on (last of what was settled): remembered in case the phone corrects itself.
    const last = step.settled.reduce<Step["settled"][number] | null>((m, x) => (!m || x.index > m.index ? x : m), null);
    if (last) this.lastFlag = last.status === "wrong" ? last.index : null;
    const said = p.fresh.slice(0, step.used);
    p = this.apply(p, step);
    if (said.length) this.on.said?.(said);
    this.on.live?.(null);
    this.lastRest = p.fresh;
    return p.fresh;
  }

  /** A new session of the phone's recognition: its text starts empty. */
  newSession() {
    this.settledWords = [];
    this.settledAt = [];
    this.pending = null;
  }

  /** The session ended (its text is gone): words still waiting for what comes next go on to the next one. */
  sessionEnded() {
    this.waiting = this.pending ? this.settle(false) : this.lastRest;
    this.settledWords = [];
    this.settledAt = [];
  }

  /** Going on while the session stopped by pausing may still be ending (and is let go): settles what it heard. */
  catchUp() {
    if (this.pending) this.waiting = this.settle(false);
  }

  /** Settles a step's words, moves on, and returns what's still being heard. */
  private apply(p: Pending, step: Step): Pending {
    if (step.start !== undefined) {
      this.start = step.start;
      this.on.start?.(step.start);
    }
    if (step.settled.length) {
      this.begun = true;
      // Which word of the session's text each one was (the words waiting from an earlier session come first).
      const waited = p.fresh.length - (p.words.length - p.base);
      for (const s of step.settled) if (s.heard >= waited) this.settledAt[p.base + s.heard - waited] = s.index;
      const heardRight = step.settled.filter((s) => s.status !== "correct" && this.right.has(s.index)).map((s) => s.index);
      if (heardRight.length) this.on.trace?.("heard-right", heardRight);
      const updates = step.settled.map((s): [number, Settled] => [s.index, this.right.has(s.index) ? "correct" : s.status]);
      for (const [i, status] of updates) {
        if (status === "correct") this.mistakes.delete(i);
        else this.mistakes.add(i);
      }
      this.on.statuses(updates);
    }
    this.pointer = Math.max(this.pointer, step.next);
    return this.consume(p, step.used);
  }

  /** Takes words off the front of what's being heard (settled, or let go): waiting ones first, then the session's. */
  private consume(p: Pending, used: number): Pending {
    const fromWaiting = Math.min(used, p.fresh.length - (p.words.length - p.base));
    this.waiting = this.waiting.slice(fromWaiting);
    const base = p.base + used - fromWaiting;
    this.settledWords = p.words.slice(0, base);
    this.settledAt = this.settledAt.slice(0, base);
    while (this.settledAt.length < base) this.settledAt.push(-1);
    return { words: p.words, base, fresh: p.fresh.slice(used) };
  }

  /**
   * The phone rewrote words already settled (its final version of what you said, after a guess): those
   * that are the right word now count as right (never the other way round).
   */
  private recheck(heard: string[], base: number) {
    const at = this.settledAt;
    let from = -1;
    for (let k = base - 1; k >= 0 && from < 0; k--) if (at[k] >= 0) from = at[k] + 1;
    for (let k = base; k < at.length && from < 0; k++) if (at[k] >= 0) from = at[k];
    if (from < 0) return;
    const r = align(this.expected, heard.slice(base), from, { known: this.known });
    const right = r.statuses.filter((s) => s.index < this.pointer && s.status === "correct" && s.score > LOOSE_SCORE).map((s) => s.index);
    for (const i of right) this.right.add(i);
    this.turnRight(right, "rewritten-right");
  }

  /** Words settled as mistakes that turn out right. */
  private turnRight(indices: number[], why: string) {
    const fixed = indices.filter((i) => this.mistakes.has(i));
    if (!fixed.length) return;
    for (const i of fixed) this.mistakes.delete(i);
    this.on.trace?.(why, fixed.length === 1 ? fixed[0] : fixed);
    this.on.statuses(fixed.map((i): [number, Settled] => [i, "correct"]));
  }
}
