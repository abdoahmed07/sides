/**
 * A recording of one recitation, for finding what went wrong: what the phone's speech recognition
 * wrote and when, how loud the microphone was, and what the app decided. No sound is recorded. It
 * stays in the app until the page is left, unless you save it (to send to whoever helps you); while
 * developing (`pnpm dev`) it's also saved in the project, in `recordings/`.
 */
export type Recording = {
  app: "hifz-recite-recording";
  version: 1;
  meta: Record<string, unknown>;
  /** [ms since the start, kind, data]. */
  events: [number, string, unknown?][];
  result?: unknown;
};

/** Enough for well over an hour of reciting. */
const MAX_EVENTS = 40_000;

export class Recorder {
  private readonly t0 = performance.now();
  private readonly events: Recording["events"] = [];
  private lastLevel = -1000;

  constructor(private readonly meta: Record<string, unknown>) {}

  add(kind: string, data?: unknown) {
    if (this.events.length >= MAX_EVENTS) return;
    this.events.push(data === undefined ? [this.now(), kind] : [this.now(), kind, data]);
  }

  /** The microphone level, ten times a second at most. */
  level(l: number) {
    const t = this.now();
    if (t - this.lastLevel < 100) return;
    this.lastLevel = t;
    this.add("level", Math.round(l * 100) / 100);
  }

  get length() {
    return this.events.length;
  }

  /** When the recording started (it names the recitation). */
  get date() {
    return this.meta.date;
  }

  finish(result: unknown): Recording {
    return { app: "hifz-recite-recording", version: 1, meta: this.meta, events: [...this.events], result };
  }

  private now() {
    return Math.round(performance.now() - this.t0);
  }
}

const UNFINISHED = "hifz:unfinishedRecording";

/**
 * A recitation left without finishing it (you left the screen, or closed the app, because something
 * went wrong): its recording is kept on this device, to save afterwards.
 */
export function keepUnfinished(rec: Recording) {
  try {
    localStorage.setItem(UNFINISHED, JSON.stringify(rec));
  } catch {
    /* too big, or storage is off: nothing kept */
  }
}

/** The recording of a recitation left without finishing it, if there's one from the last day. */
export function unfinished(): Recording | null {
  try {
    const rec = JSON.parse(localStorage.getItem(UNFINISHED) ?? "null") as Recording | null;
    return rec && Date.now() - Date.parse(String(rec.meta.date)) < 24 * 3600_000 ? rec : null;
  } catch {
    return null;
  }
}

/** Lets go of the kept recording (saved, or that recitation was finished after all). */
export function forgetUnfinished(date?: unknown) {
  try {
    if (date === undefined || unfinished()?.meta.date === date) localStorage.removeItem(UNFINISHED);
  } catch {
    /* nothing kept */
  }
}

/** The file name for a recording made now. */
const fileName = () => `hifz-recording-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;

/** Saves a recording: on a phone through the share sheet (AirDrop, Files, Mail…), elsewhere as a download. */
export async function saveRecording(rec: Recording) {
  const file = new File([JSON.stringify(rec)], fileName(), { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Hifz Tracker recording" });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** While developing: keeps the recording in the project too (see /api/recordings). */
export function keepWhileDeveloping(rec: Recording) {
  if (process.env.NODE_ENV !== "development") return;
  void fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/recordings`, { method: "POST", body: JSON.stringify(rec) }).catch(() => {});
}
