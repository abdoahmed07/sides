/**
 * Recite with the phone's own speech recognition (the browser's Web Speech API):
 * Google on Android and in Chrome, Apple on iPhone and in Safari. Nothing to
 * download, it's trained on all kinds of voices, and words come back while
 * you're still speaking. Like voice typing, the audio is processed by Google
 * or Apple; the private mode (on-device model) is the alternative.
 *
 * Browsers differ, so this smooths them out:
 *  - Chrome sends the text in pieces, each marked final once it's settled.
 *  - Android and iPhone often send one result that keeps growing (iPhone may
 *    never mark it final); `assemble` turns either into one running text, and
 *    the app treats text that hasn't changed for a moment as settled.
 *  - A session ends after a silence or a minute; listening carries on in a new one.
 */
import { fold } from "./match";

type Alternative = { transcript: string };
type Result = { isFinal: boolean; length: number; [i: number]: Alternative | undefined };
type ResultEvent = { results: { length: number; [i: number]: Result } };
type ErrorEvent = { error: string };
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: ResultEvent) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  onend: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Whether this browser has speech recognition (Chrome, Edge, Safari, Samsung Internet; not Firefox). */
export const webSpeechAvailable = () => recognitionClass() !== null;

/** Letters only, without spaces or marks: to tell whether one transcript repeats another. */
const squash = (s: string) => s.split(/\s+/).map(fold).join("");

/**
 * One running text from a session's results. Pieces that carry on are joined;
 * a result that repeats everything so far and adds to it (Android, iPhone)
 * replaces it; a repeat of the last piece (an Android quirk) is dropped.
 */
export function assemble(parts: string[]): string {
  let text = "";
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    const p = squash(part);
    const sofar = squash(text);
    if (!sofar || p.startsWith(sofar)) text = part;
    else if (part.split(/\s+/).length > 1 && sofar.endsWith(p)) continue;
    else text = `${text} ${part}`;
  }
  return text;
}

/** The words of a transcript that have letters (no stray punctuation). */
export const heardWords = (text: string) => text.split(/\s+/).filter((w) => fold(w));

/**
 * Why recognition stopped: blocked (permission), unavailable (not here: e.g. dictation off on an
 * iPhone, some installed apps), network, no-mic, or interrupted (it was working, and the browser
 * wouldn't carry on without a tap).
 */
export type SpeechProblem = "blocked" | "unavailable" | "network" | "no-mic" | "interrupted";

export type SpeechHandlers = {
  /** The text heard in this session so far; `final`: the browser says none of it will change. */
  onText: (text: string, final: boolean) => void;
  /** The browser hears sound, speech or words (for the "can't hear you" warning and the mic ring). */
  onActivity?: () => void;
  /** A session ended; anything not settled yet should be settled now. Listening goes on in a new one. */
  onSessionEnd?: () => void;
  /** Recognition stopped and won't come back by itself. */
  onError: (problem: SpeechProblem) => void;
  /** Everything the browser says, as it says it (for a recording): its results, sessions starting and ending, errors. */
  onTrace?: (kind: string, data?: unknown) => void;
};

const PROBLEMS: Record<string, SpeechProblem> = {
  "not-allowed": "blocked",
  "service-not-allowed": "unavailable",
  "language-not-supported": "unavailable",
  network: "network",
  "audio-capture": "no-mic",
};

export class WebSpeech {
  private rec: Recognition | null = null;
  private stopped = true;
  private worked = false;
  private startedAt = 0;
  private quickEnds = 0;
  private onStopped: (() => void) | null = null;

  constructor(private h: SpeechHandlers) {}

  /** Call straight from the tap on the microphone: browsers only start recognition from a tap. */
  start() {
    this.stopped = false;
    this.quickEnds = 0;
    this.session();
  }

  private session() {
    const Rec = recognitionClass();
    if (!Rec) return this.fail("unavailable");
    const rec = new Rec();
    rec.lang = "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      if (this.rec !== rec) return;
      const parts: string[] = [];
      let final = true;
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        parts.push(r[0]?.transcript ?? "");
        if (!r.isFinal) final = false;
      }
      this.h.onTrace?.("result", Array.from({ length: e.results.length }, (_, i) => [parts[i], e.results[i].isFinal]));
      this.worked = true;
      this.quickEnds = 0;
      this.h.onActivity?.();
      this.h.onText(assemble(parts), final);
    };
    rec.onsoundstart = () => {
      this.h.onTrace?.("sound");
      this.h.onActivity?.();
    };
    rec.onspeechstart = () => {
      this.h.onTrace?.("speech");
      this.h.onActivity?.();
    };
    rec.onerror = (e) => {
      if (this.rec !== rec) return;
      this.h.onTrace?.("error", e.error);
      const problem = PROBLEMS[e.error];
      // "no-speech" and "aborted" just end the session; listening goes on in a new one.
      if (!problem) return;
      // Blocked after it already worked: the browser wants a tap to carry on (iPhone).
      this.fail(problem === "blocked" && this.worked ? "interrupted" : problem);
    };
    rec.onend = () => {
      if (this.rec !== rec) return;
      this.h.onTrace?.("end");
      this.rec = null;
      this.h.onSessionEnd?.();
      if (this.stopped) {
        this.onStopped?.();
        this.onStopped = null;
        return;
      }
      // Ending straight away again and again means it can't run here (no network, not allowed…).
      if (Date.now() - this.startedAt < 1000 && ++this.quickEnds >= 3)
        return this.fail(this.worked ? "interrupted" : "unavailable");
      this.session();
    };
    this.rec = rec;
    this.startedAt = Date.now();
    this.h.onTrace?.("start");
    try {
      rec.start();
    } catch {
      this.fail(this.worked ? "interrupted" : "unavailable");
    }
  }

  /** Stops listening; resolves once the last words are in (or after a moment if the browser goes quiet). */
  stop(): Promise<void> {
    this.stopped = true;
    const rec = this.rec;
    if (!rec) return Promise.resolve();
    return new Promise((resolve) => {
      this.onStopped = resolve;
      setTimeout(resolve, 1500);
      try {
        rec.stop();
      } catch {
        resolve();
      }
    });
  }

  private fail(problem: SpeechProblem) {
    this.stopped = true;
    const rec = this.rec;
    this.rec = null;
    try {
      rec?.abort();
    } catch {
      /* already stopped */
    }
    this.h.onSessionEnd?.();
    this.h.onError(problem);
  }
}
