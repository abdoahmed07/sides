"use client";
import { memo, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { q } from "@/lib/app";
import { getLang, t, tp, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { audioUrl, newAudio, reciterById } from "@/audio/recitation";
import {
  align,
  ayahWords,
  hintText,
  quranWords,
  SURE,
  suggestRating,
  type Alignment,
  type Rating,
  type WordStatus,
} from "@/recite/match";
import { concat, Mic, PAUSE_S, RATE } from "@/recite/mic";
import { loadModel, modelIsDownloaded, transcribe, type Engine } from "@/recite/recognizer";
import { Hearing } from "@/recite/hearing";
import { LevelMeter, meterFits, meterOff, turnMeterOff } from "@/recite/level";
import {
  forgetUnfinished,
  keepUnfinished,
  keepWhileDeveloping,
  Recorder,
  saveRecording,
  unfinished,
  type Recording,
} from "@/recite/record";
import { LAST_WORD_SURE, reveal, type Live } from "@/recite/reveal";
import { WebSpeech, webSpeechAvailable, type SpeechProblem } from "@/recite/webspeech";
import { loadText } from "./AyahText";
import { Button, Spinner } from "./ui";

const toArabicDigits = (n: number) =>
  String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

type Word = { ayah: number; text: string; last: boolean };
type Phase =
  | "check"
  | "intro"
  | "loading"
  | "ready"
  | "listening"
  | "paused"
  | "finishing"
  | "done"
  | "error";

/**
 * phone: the phone's own speech recognition (Google or Apple): nothing to download, words come
 * back while you speak, and it knows all kinds of voices. device: private mode, a speech model
 * that runs on the device (one-time download, slower).
 */
type Mode = "phone" | "device";
const MODE_KEY = "hifz:reciteMode";

function initialMode(): Mode {
  if (!webSpeechAvailable()) return "device";
  try {
    return localStorage.getItem(MODE_KEY) === "device" ? "device" : "phone";
  } catch {
    return "phone";
  }
}

const RATING_LABEL: Record<Rating, string> = {
  strong: "Strong",
  okay: "Okay",
  weak: "Weak",
};

/**
 * Phone recognition: once the text hasn't changed for this long you've paused, and what you said is
 * settled, a wrong word you stopped on included (iPhone never says "final"). Long enough for a word
 * drawn out in recitation (a madd of four to six counts), which the phone often only writes once it
 * has heard all of it.
 */
const SETTLE_MS = 1800;
/** Problems this soon after the level meter started may be the meter's doing (see level.ts). */
const METER_TRIAL_MS = 8000;
/**
 * The phone's recognition hasn't said it started this long after a tap: it's stuck. (Only once it has
 * said so on this page before: then it's allowed, and isn't waiting for you to allow it. An iPhone
 * takes over a second at the best of times.)
 */
const STUCK_MS = 12000;
/** Whether the phone's recognition has worked on this page (it's allowed: a start that fails is something else). */
let workedBefore = false;
/** Whether it has said it started on this page (some browsers may not say; a start that doesn't come only counts where they do). */
let saysStarted = false;
/** The phone's recognition has worked (words came), or has said it started. */
const noteWorked = () => {
  workedBefore = true;
};
const noteStarted = () => {
  workedBefore = saysStarted = true;
};

/** Every word of the Quran, for checking phone recognition strictly: worked out once, when first needed. */
let knownWords: { text: string[]; words: Set<string> } | null = null;
function known(text: string[]): Set<string> {
  if (knownWords?.text !== text) knownWords = { text, words: quranWords(text) };
  return knownWords.words;
}

const PROBLEM: Record<Exclude<SpeechProblem, "interrupted">, string> = {
  blocked: tx(
    "Speech recognition is blocked. Allow the microphone (and speech recognition) for this site in your settings, then try again.",
  ),
  unavailable: tx(
    "Your phone's speech recognition isn't available here. On iPhone, turn on Dictation (Settings › General › Keyboard) and open the app in Safari, or use private mode.",
  ),
  network: tx(
    "Speech recognition needs an internet connection. Check it, or use private mode, which works offline.",
  ),
  "no-mic": tx("No microphone was found."),
};

/** A part the model couldn't make sense of is kept (up to this long) and heard again with the next part. */
const CARRY_MAX_S = 12;
/**
 * Live checks of a long phrase (longer than this) re-read only its last few seconds once its first words
 * are confirmed: each check is quicker, since the model writes out only what it heard.
 */
const TRIM_FROM_S = 7;
const TRIM_TO_S = 5;
/** The model reads at most 30 s at a time. */
const MODEL_MAX_S = 28;

/** A little silence in front shifts the model's window, so a second listen can hear a word the first one missed. */
function shifted(audio: Float32Array): Float32Array {
  const out = new Float32Array(audio.length + 4000);
  out.set(audio, 4000);
  return out;
}

/**
 * Recite from memory with the text hidden; the app listens and reveals each
 * word you get right, live and strictly in order. A mistake shows once you've
 * moved past it. At the end: a score, the mistakes per ayah (with the correct
 * recitation to listen to) and a suggested rating to confirm.
 */
export function ReciteCheck({
  ayahs,
  onRate,
  slot,
}: {
  ayahs: number[];
  onRate?: (r: Rating) => Promise<void> | void;
  /** Where the live controls go (the reader's pinned header). */
  slot: HTMLElement | null;
}) {
  useLang();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [text, setText] = useState<string[] | null>(null);
  const [phase, setPhase] = useState<Phase>(mode === "phone" ? "ready" : "check");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** Settled statuses: what a finished part or a final result decided. */
  const [statusRaw, setStatus] = useState<WordStatus[]>([]);
  /** What's being heard right now (not settled yet). */
  const [live, setLive] = useState<Live | null>(null);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [hintsRaw, setHints] = useState<number[]>([]);
  const [checking, setChecking] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [heardLog, setHeardLog] = useState<string[]>([]);
  const [rating, setRating] = useState<Rating | null>(null);
  const [saved, setSaved] = useState(false);
  const [engine, setEngine] = useState<Engine | null>(null);
  /** Average time per check, shown under "What the app heard" (helps when it feels slow). */
  const [avgMs, setAvgMs] = useState(0);

  /** First word not settled yet: new speech is matched from here. */
  const pointer = useRef(0);
  const seen = useRef<Set<number>>(new Set());
  const lastSound = useRef(0);
  /** The rings around the microphone button: moved straight from the mic, without redrawing the page. */
  const ring = useRef<HTMLSpanElement>(null);
  const halo = useRef<HTMLSpanElement>(null);
  /** Phone recognition gives no sound level: this listens alongside it for the rings. */
  const meter = useRef<LevelMeter | null>(null);
  const meterSince = useRef(0);
  /** A recording of this recitation (no sound), to save if something went wrong. */
  const recorder = useRef<Recorder | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  /** The recording of a recitation left without finishing it (something went wrong), to save now. */
  const [leftover, setLeftover] = useState<Recording | null>(unfinished);
  /** Without a meter (phones), the rings follow the words coming in: their level as it eases down. */
  const activity = useRef({ level: 0, raf: 0 });

  // Phone recognition.
  const speech = useRef<WebSpeech | null>(null);
  /**
   * The recognition stopped when you paused. An iPhone can take a while to end it, and its last words
   * would mix with the next session's: it's let go of when you go on.
   */
  const stopping = useRef<WebSpeech | null>(null);
  /** Whether the recognition has started listening since the tap (it takes a moment), and when the tap was. */
  const [micOn, setMicOn] = useState(false);
  const micOnNow = useRef(false);
  const listenAt = useRef(0);
  /** Following what the phone writes (see hearing.ts): one per recitation. */
  const hearing = useRef<Hearing | null>(null);
  /** Where you started reciting, when it isn't where the portion starts (found from your first words). */
  const [start, setStart] = useState<number | null>(null);
  const startAt = useRef<number | null>(null);
  /** Whether you've started: any word settled yet. */
  const begun = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // On-device model (private mode).
  const mic = useRef<Mic | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(0);
  /** How long the last check took: very slow phones skip live previews and second listens so they don't fall behind. */
  const lastCheckMs = useRef(0);
  const checkTimes = useRef<number[]>([]);
  /** Audio the model couldn't make sense of yet: checked again together with the next part. */
  const carry = useRef<Float32Array | null>(null);
  /** The latest preview of the part being said: how much of it was heard, and what. */
  const preview = useRef<{ samples: number; heard: string[] } | null>(null);
  /** The previous part and where in the text it started: context for a second listen. */
  const prev = useRef<{ audio: Float32Array; from: number } | null>(null);

  useEffect(() => {
    loadText().then(setText, () => setPhase("error"));
    // A recitation left before you finished it (something went wrong?): its recording is kept, to save.
    const keep = () => {
      if (document.visibilityState === "hidden" && recorder.current) keepUnfinished(recorder.current.finish("unfinished"));
    };
    document.addEventListener("visibilitychange", keep);
    return () => {
      document.removeEventListener("visibilitychange", keep);
      if (recorder.current) {
        recorder.current.add("left");
        keepUnfinished(recorder.current.finish("unfinished"));
      }
      mic.current?.stop();
      meter.current?.stop();
      cancelAnimationFrame(activity.current.raf);
      void speech.current?.stop();
      stopping.current?.detach();
      clearTimeout(settleTimer.current);
    };
  }, []);

  // While reciting, anything that goes wrong in the app goes into the recording too.
  const reciting = phase === "listening" || phase === "paused" || phase === "finishing";
  useEffect(() => {
    if (!reciting) return;
    const onError = (e: ErrorEvent) => recorder.current?.add("js-error", String(e.message).slice(0, 300));
    const onRejection = (e: PromiseRejectionEvent) =>
      recorder.current?.add("js-error", String((e.reason as Error | undefined)?.stack ?? e.reason).slice(0, 300));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [reciting]);

  // Phone recognition is checked against every word of the Quran: work that out ahead (a moment's work).
  useEffect(() => {
    if (!text || mode !== "phone") return;
    const id = setTimeout(() => known(text), 300);
    return () => clearTimeout(id);
  }, [text, mode]);

  // Private mode: is the model already on the device?
  useEffect(() => {
    if (phase !== "check") return;
    let current = true;
    void modelIsDownloaded().then((yes) => {
      if (current) setPhase((p) => (p === "check" ? (yes ? "loading" : "intro") : p));
    });
    return () => {
      current = false;
    };
  }, [phase]);

  const words: Word[] = useMemo(() => {
    if (!text) return [];
    return ayahs.flatMap((a) => {
      const ws = ayahWords(text[a]);
      return ws.map((w, k) => ({
        ayah: a,
        text: w,
        last: k === ws.length - 1,
      }));
    });
  }, [text, ayahs]);
  const expected = useMemo(() => words.map((w) => w.text), [words]);
  /** The portion's mushaf pages ([first word, end) of each): reciting shows one at a time. */
  const pages = useMemo(() => {
    const out: [number, number][] = [];
    words.forEach((w, i) => {
      const last = out[out.length - 1];
      if (last && q.pageOf[words[last[0]].ayah] === q.pageOf[w.ayah]) last[1] = i + 1;
      else out.push([i, i + 1]);
    });
    return out;
  }, [words]);
  const pageOf = useCallback(
    (i: number) => {
      const k = pages.findIndex(([a, b]) => i >= a && i < b);
      return k === -1 ? Math.max(0, pages.length - 1) : k;
    },
    [pages],
  );
  const [page, setPageRaw] = useState(0);
  const setPage = (k: number) => {
    setPageRaw(k);
    recorder.current?.add("page", k);
  };
  /** Where to look for you when you aren't where you were: no further than the end of the next page. */
  const searchEnd = (from: number) => pages[Math.min(pages.length - 1, pageOf(from) + 1)]?.[1] ?? words.length;

  // Per-word state, sized to the words (fresh when the text arrives or after a reset).
  // (Memoized, so the word list below is only redrawn when a word really changes.)
  const status: WordStatus[] = useMemo(
    () => (statusRaw.length === words.length ? statusRaw : words.map(() => "pending")),
    [statusRaw, words],
  );
  const hints: number[] = useMemo(
    () => (hintsRaw.length === words.length ? hintsRaw : words.map(() => 0)),
    [hintsRaw, words],
  );
  /** What shows while reciting: settled words, then live ones, strictly in order (from where you started). */
  const view = useMemo(() => reveal(status, live, confirmed, start ?? 0), [status, live, confirmed, start]);

  const reset = () => {
    pointer.current = 0;
    carry.current = null;
    prev.current = null;
    preview.current = null;
    seen.current = new Set();
    hearing.current = null;
    startAt.current = null;
    begun.current = false;
    recorder.current = null;
    setRecording(null);
    setStart(null);
    setStatus(words.map(() => "pending"));
    setLive(null);
    setConfirmed(new Set());
    setHints(words.map(() => 0));
    setHeardLog([]);
    setRating(null);
    setSaved(false);
  };

  const chooseMode = (m: Mode) => {
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* not saved; fine for now */
    }
    setMode(m);
    setErrorMsg(null);
    setPhase(m === "phone" ? "ready" : "check");
  };

  // Load the model once the person has agreed (or it's already on the device).
  useEffect(() => {
    if (phase !== "loading") return;
    loadModel((loaded, total) => setProgress(total ? loaded / total : 0)).then(
      (e) => {
        if (process.env.NODE_ENV !== "production")
          (window as unknown as { __reciteBackend?: Engine }).__reciteBackend = e;
        setEngine(e);
        setPhase("ready");
      },
      (e: Error) => {
        setErrorMsg(e.message);
        setPhase("error");
      },
    );
  }, [phase]);

  /** Development only: what each check heard and decided (window.__recite in the browser console). */
  const debug = (kind: string, heard: string[], r: Alignment) => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __recite?: unknown[] };
    (w.__recite ??= []).push({
      kind,
      from: pointer.current,
      heard: heard.join(" "),
      next: r.next,
      statuses: r.statuses.map((s) => `${s.index}:${s.status}`).join(" "),
    });
  };

  /** Settles words: a settled word can still turn right (heard right later), never back into a mistake. */
  const commit = (r: Alignment) => {
    if (!r.statuses.length) return;
    const from = pointer.current;
    setStatus((prev) => {
      const next =
        prev.length === expected.length
          ? [...prev]
          : expected.map((): WordStatus => "pending");
      for (const s of r.statuses) {
        if (s.index < from && s.status !== "correct") continue;
        next[s.index] = seen.current.has(s.index) ? "correct" : s.status;
      }
      return next;
    });
    pointer.current = Math.max(from, r.next);
  };

  // ---- Phone recognition ----

  /** The microphone level (0–1) on the rings around the button, straight to the page (no redraw). */
  const showLevel = (l: number) => {
    if (ring.current) ring.current.style.transform = `scale(${1 + l * 0.32})`;
    if (halo.current) {
      halo.current.style.transform = `scale(${1 + l * 0.75})`;
      halo.current.style.opacity = String(0.25 + l * 0.75);
    }
    if (l > 0.3) lastSound.current = Date.now();
  };

  /** Without a level to show (phones), the rings follow the words heard: up with each, easing down after. */
  const pulse = (amount: number) => {
    if (meter.current) return;
    const a = activity.current;
    a.level = Math.max(a.level, amount);
    if (a.raf) return;
    const ease = () => {
      a.level = a.level < 0.02 ? 0 : a.level * 0.95;
      showLevel(a.level);
      a.raf = a.level ? requestAnimationFrame(ease) : 0;
    };
    a.raf = requestAnimationFrame(ease);
  };

  const stopMeter = () => {
    meter.current?.stop();
    meter.current = null;
    cancelAnimationFrame(activity.current.raf);
    activity.current = { level: 0, raf: 0 };
    showLevel(0);
  };

  /** The phone's text is followed by a Hearing (hearing.ts), made when you first start reciting. */
  const hearingNow = (): Hearing => {
    hearing.current ??= new Hearing(
      expected,
      known(text!),
      searchEnd,
      {
        statuses: (updates) =>
          setStatus((prev) => {
            const next = prev.length === expected.length ? [...prev] : expected.map((): WordStatus => "pending");
            for (const [i, st] of updates) next[i] = st;
            return next;
          }),
        start: (i) => {
          startAt.current = i;
          setStart(i);
        },
        live: setLive,
        said: (said) => setHeardLog((l) => [...l.slice(-30), said.join(" ")]),
        trace: (kind, data) => recorder.current?.add(kind, data),
      },
      pointer.current,
    );
    return hearing.current;
  };

  /** Where the Hearing has got to, for the rest of the screen. */
  const caughtUp = () => {
    const h = hearing.current;
    if (!h) return;
    pointer.current = h.pointer;
    begun.current = h.begun;
  };

  /**
   * Settles what was heard: you paused (or the phone says the words are final), so what you said last
   * counts too. `end`: you've finished.
   */
  const settle = (end: boolean) => {
    clearTimeout(settleTimer.current);
    hearing.current?.settle(end);
    caughtUp();
  };

  const onText = (transcript: string, final: boolean) => {
    if (!text) return;
    // Words coming in: it's listening (whether or not the browser said it started).
    noteWorked();
    if (!micOnNow.current) {
      micOnNow.current = true;
      setMicOn(true);
    }
    hearingNow().hear(transcript);
    caughtUp();
    pulse(0.75);
    clearTimeout(settleTimer.current);
    if (final) settle(false);
    else settleTimer.current = setTimeout(() => settle(false), SETTLE_MS);
  };

  const onProblem = (p: SpeechProblem) => {
    speech.current = null;
    recorder.current?.add("problem", p);
    const hadMeter = meter.current !== null && Date.now() - meterSince.current < METER_TRIAL_MS;
    stopMeter();
    // Right after the level meter started, it may be what got in the way (some phones let only one thing
    // use the microphone): no meter on this device from now on, and a tap carries on.
    if (hadMeter && p !== "blocked") {
      turnMeterOff();
      recorder.current?.add("meter-off");
      return setPhase("paused");
    }
    if (p === "interrupted") return setPhase("paused");
    // It worked a moment ago on this page: it isn't unavailable, it just didn't start this time.
    setErrorMsg(p === "unavailable" && workedBefore ? t("The microphone didn't start. Tap it to try again.") : t(PROBLEM[p]));
    setPhase(begun.current || pointer.current > 0 ? "paused" : "ready");
  };

  /** The recognition didn't start after a tap: let it go, and say so (a tap tries again). */
  const stuck = () => {
    recorder.current?.add("stuck");
    const s = speech.current;
    speech.current = null;
    s?.detach();
    stopMeter();
    setErrorMsg(t("The microphone didn't start. Tap it to try again."));
    setPhase("paused");
  };

  // The phone's recognition has no sound level: warn when nothing has been heard for a while. And a
  // start that never came is stuck.
  const checkListening = useEffectEvent(() => {
    setQuiet(Date.now() - lastSound.current > 8000);
    if (!micOnNow.current && saysStarted && Date.now() - listenAt.current > STUCK_MS) stuck();
  });
  useEffect(() => {
    if (phase !== "listening" || mode !== "phone") return;
    const id = setInterval(() => checkListening(), 1000);
    return () => clearInterval(id);
  }, [phase, mode]);

  // ---- On-device model (private mode) ----

  const check = async (audio: Float32Array) => {
    const t0 = performance.now();
    setChecking(true);
    try {
      // A copy goes to the model: the original is still needed for a second listen.
      const heard = (await transcribe(audio.slice())).trim();
      recorder.current?.add("heard", heard);
      if (heard) setHeardLog((l) => [...l.slice(-30), heard]);
      return heard.split(/\s+/).filter(Boolean);
    } finally {
      lastCheckMs.current = performance.now() - t0;
      const times = [...checkTimes.current.slice(-19), lastCheckMs.current];
      checkTimes.current = times;
      setAvgMs(times.reduce((a, b) => a + b, 0) / times.length);
      if (busy.current <= 1) setChecking(false);
    }
  };

  /**
   * Words a check heard clearly stay right, even if another check missed them.
   * Only confident matches count, and the last word of a live preview only when
   * (almost) exact: it's often cut off mid-word and can look like another word.
   */
  const remember = (r: Alignment, heardCount: number, preview: boolean) => {
    let added = false;
    for (const s of r.statuses)
      if (
        s.status === "correct" &&
        s.score >= (preview && s.heard === heardCount - 1 ? LAST_WORD_SURE : SURE) &&
        !seen.current.has(s.index)
      ) {
        seen.current.add(s.index);
        added = true;
      }
    if (added) setConfirmed(new Set(seen.current));
  };

  /**
   * A second listen before anything is called a mistake. With the part before it in front, the
   * model hears a continuation ("…برب الناس ملك الناس"), which it recognizes far better than a
   * fragment on its own; the first part gets a little silence in front instead.
   */
  const listenAgain = async (audio: Float32Array, from: number): Promise<Alignment> => {
    const p = prev.current;
    if (p && p.audio.length + audio.length <= MODEL_MAX_S * RATE) {
      const heard = await check(concat([p.audio, audio]));
      const r = align(expected, heard, p.from);
      debug("second listen, with the part before", heard, r);
      // The part before is settled: its words can only change to right, never to a mistake.
      const statuses = r.statuses.filter((s) => s.index >= from || s.status === "correct");
      remember({ statuses, next: r.next }, heard.length, false);
      return { statuses, next: Math.max(r.next, from) };
    }
    const heard = await check(shifted(audio));
    const r = align(expected, heard, from);
    debug("second listen", heard, r);
    remember(r, heard.length, false);
    return r;
  };

  /** A part with what's carried from before in front of it, if the model can still read it all at once. */
  const withCarry = (audio: Float32Array) =>
    carry.current && carry.current.length + audio.length <= MODEL_MAX_S * RATE ? concat([carry.current, audio]) : audio;

  const onPart = (part: Float32Array) => {
    busy.current++;
    chain.current = chain.current.then(async () => {
      const audio = withCarry(part);
      carry.current = null;
      const from = pointer.current;
      // A preview already heard all of it (all but the pause at its end): no need to check it again.
      const p = preview.current;
      preview.current = null;
      const heardAll = !!p && p.samples <= audio.length && p.samples >= audio.length - PAUSE_S * RATE;
      try {
        if (heardAll) recorder.current?.add("preview-was-enough");
        const heard = heardAll ? p.heard : await check(audio);
        let r = align(expected, heard, from);
        debug("part", heard, r);
        remember(r, heard.length, false);
        const doubtful =
          !r.statuses.length || r.statuses.some((s) => s.status !== "correct" && !seen.current.has(s.index));
        // Listen once more before calling anything a mistake (when the phone is quick enough).
        if (doubtful && lastCheckMs.current < 1800) {
          try {
            const again = await listenAgain(audio, from);
            if (again.next > r.next) r = again;
          } catch {
            /* keep the first result */
          }
        }
        // Nothing recognized at all: don't lose it, hear it again together with the next part.
        if (!r.statuses.length && audio.length < CARRY_MAX_S * RATE) {
          carry.current = audio;
          return;
        }
        commit(r);
        setLive(null);
        prev.current = { audio, from };
      } catch {
        /* a part that couldn't be read is simply skipped */
      } finally {
        busy.current--;
      }
    });
  };

  const onPartial = (audio: Float32Array, stopping: boolean) => {
    // Live preview: whenever the model is free (and not hopelessly slow), so it never falls behind. When
    // you stop, it waits its turn instead: it may be the part's last check (and spare one when it ends).
    if ((busy.current > 0 && !stopping) || busy.current > 1 || lastCheckMs.current > 4000) return;
    busy.current++;
    chain.current = chain.current.then(async () => {
      try {
        const input = withCarry(audio);
        // The phrase's words confirmed so far, from where it started.
        let sure = pointer.current;
        while (seen.current.has(sure)) sure++;
        // Midway through a long phrase whose first words are confirmed: only its last seconds, matched
        // from a couple of words before the first not confirmed (they may be in those seconds too). When
        // you stop, all of it: that check may be the phrase's last.
        const trim = !stopping && input.length > TRIM_FROM_S * RATE && sure > pointer.current;
        const from = trim ? Math.max(pointer.current, sure - 2) : pointer.current;
        const heard = await check(trim ? input.slice(input.length - TRIM_TO_S * RATE) : input);
        preview.current = trim ? null : { samples: input.length, heard };
        const r = align(expected, heard, from);
        debug("preview", heard, r);
        remember(r, heard.length, true);
        setLive({ statuses: r.statuses, heard: heard.length });
      } catch {
        /* ignore */
      } finally {
        busy.current--;
      }
    });
  };

  // ---- Controls ----

  const listen = async () => {
    setErrorMsg(null);
    setQuiet(false);
    lastSound.current = Date.now();
    // Not started yet, on a later page: reciting starts on the page shown.
    if (!begun.current && startAt.current === null && pages[page] && pages[page][0] > pointer.current) {
      pointer.current = pages[page][0];
      startAt.current = pages[page][0];
      setStart(pages[page][0]);
      hearing.current?.startAt(pages[page][0]);
    }
    recorder.current ??= new Recorder({
      ua: navigator.userAgent,
      lang: getLang(),
      mode,
      standalone: matchMedia("(display-mode: standalone)").matches,
      href: location.pathname + location.search,
      ayahs: [ayahs[0], ayahs[ayahs.length - 1]],
      words: expected.length,
      page: q.pageOf[words[pages[page]?.[0] ?? 0]?.ayah ?? ayahs[0]],
      build: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.NODE_ENV,
      date: new Date().toISOString(),
      meter: mode === "phone" && meterFits() && !meterOff(),
    });
    recorder.current.add("listen", { from: pointer.current, ...(stopping.current && { again: true }) });
    if (mode === "phone") {
      // The session stopped when you paused may still be ending (an iPhone can take a while): let it go,
      // so its last words don't mix with the new session's, and settle what it heard.
      const old = stopping.current;
      stopping.current = null;
      if (old) {
        if (old.running) recorder.current.add("let-go");
        old.detach();
        hearing.current?.catchUp();
        caughtUp();
      }
      // (Before the text has loaded there's nothing to follow yet: it starts with the first words.)
      if (text) hearingNow().newSession();
      micOnNow.current = false;
      setMicOn(false);
      listenAt.current = Date.now();
      const s = new WebSpeech({
        onText,
        onActivity: () => {
          lastSound.current = Date.now();
        },
        onStart: () => {
          noteStarted();
          micOnNow.current = true;
          setMicOn(true);
        },
        onSessionEnd: () => {
          // The session's text is gone: words still waiting for what comes next go on to the next one.
          clearTimeout(settleTimer.current);
          hearing.current?.sessionEnded();
          caughtUp();
        },
        onError: onProblem,
        onTrace: (kind, data) => recorder.current?.add(kind, data),
      });
      speech.current = s;
      // Straight from the tap: browsers only start recognition from one.
      s.start();
      // It couldn't start at all (and has said why): not listening.
      if (speech.current !== s) return;
      setPhase("listening");
      // The level, from the microphone alongside the recognition: on computers (phones let one thing use
      // the microphone at a time), and unless it got in the way before.
      if (meterFits() && !meterOff()) {
        const m = new LevelMeter((l) => {
          showLevel(l);
          recorder.current?.level(l);
        });
        meter.current = m;
        meterSince.current = Date.now();
        m.start().catch(() => {
          if (meter.current === m) meter.current = null;
          recorder.current?.add("meter-failed");
        });
      }
      return;
    }
    const m = new Mic({
      onPart,
      onPartial,
      onLevel: (l) => {
        showLevel(l);
        recorder.current?.level(l);
        setQuiet(Date.now() - lastSound.current > 4000);
      },
    });
    try {
      await m.start();
      mic.current = m;
      setPhase("listening");
    } catch {
      setErrorMsg(
        t(
          "The microphone is blocked. Allow it for this site in your browser settings, then try again.",
        ),
      );
    }
  };

  const pause = () => {
    recorder.current?.add("pause");
    stopMeter();
    setPageRaw(pageOf(Math.min(view.next, words.length - 1)));
    if (mode === "phone") {
      const s = speech.current;
      speech.current = null;
      stopping.current = s;
      void s?.stop();
    } else {
      mic.current?.stop();
      mic.current = null;
    }
    setPhase("paused");
  };

  const finish = async () => {
    setPhase("finishing");
    recorder.current?.add("finish");
    stopMeter();
    setPageRaw(pageOf(Math.min(view.next, words.length - 1)));
    if (mode === "phone") {
      const s = speech.current;
      speech.current = null;
      await s?.stop();
      // Finished while paused: the session stopped then may still be sending its last words.
      const old = stopping.current;
      stopping.current = null;
      if (old) {
        await old.stop();
        old.detach();
      }
      settle(true);
    } else {
      mic.current?.stop();
      mic.current = null;
      await chain.current;
    }
    setLive(null);
    // Words a check heard clearly count as right.
    setStatus((prev) =>
      (prev.length === expected.length ? prev : expected.map((): WordStatus => "pending")).map((s, i) =>
        s === "pending" && seen.current.has(i) ? "correct" : s,
      ),
    );
    const rec = recorder.current?.finish(undefined);
    if (recorder.current) forgetUnfinished(recorder.current.date);
    recorder.current = null;
    if (rec) setRecording(rec);
    setPhase("done");
  };

  const done = phase === "done";
  // The next word still hidden: where you are, and where the hint helps.
  const nextHidden = view.next;

  const hint = () => {
    if (nextHidden >= words.length) return;
    recorder.current?.add("hint", nextHidden);
    setHints(hints.map((v, k) => (k === nextHidden ? v + 1 : v)));
  };

  const fix = useCallback(
    (i: number) => setStatus((prev) => prev.map((v, k) => (k === i ? "correct" : v))),
    [],
  );

  /** The page shown: while reciting, the one you're on; otherwise the one picked (where you paused or finished). */
  const shownPage = phase === "listening" || phase === "finishing" ? pageOf(Math.min(nextHidden, words.length - 1)) : Math.min(page, pages.length - 1);
  /** A recording with how it ended (what each word came to), to save. */
  const finished = (rec: Recording): Recording => ({ ...rec, result: { start, statuses: status.map((x) => CODE[x]).join("") } });
  // While developing, finished recordings are kept in the project too (once each).
  const kept = useRef<Recording | null>(null);
  useEffect(() => {
    if (phase !== "done" || !recording || kept.current === recording) return;
    kept.current = recording;
    keepWhileDeveloping(finished(recording));
  });

  // Keep your place in view: when it nears the bottom of the screen (or is under the pinned controls), scroll.
  useEffect(() => {
    if (phase !== "listening" && phase !== "paused") return;
    const el = document.querySelector<HTMLElement>(`[data-w="${nextHidden}"]`);
    if (!el) return;
    const top = slot?.getBoundingClientRect().bottom ?? 0;
    const bottom = window.innerHeight;
    const room = bottom - top;
    const r = el.getBoundingClientRect();
    // Far off (you started further on): straight there. Close by: a gentle scroll.
    if (r.top > bottom * 2 || r.bottom < top - bottom) el.scrollIntoView({ block: "center" });
    else if (r.bottom > bottom - room * 0.3 || r.top < top) window.scrollBy({ top: r.top - (top + room * 0.3), behavior: "smooth" });
  }, [nextHidden, phase, slot]);

  // Results (while reciting: what's shown so far). A portion you were given counts whole (what you didn't
  // get to is "not reached"); reciting freely (from the Quran tab), what counts is the stretch you recited.
  const assigned = !!onRate;
  const scope = useMemo((): [number, number] => {
    if (assigned) return [0, words.length];
    const a = start ?? 0;
    let b = a;
    status.forEach((s, i) => {
      if (s !== "pending" && i >= a) b = i + 1;
    });
    return b > a ? [a, b] : [0, words.length];
  }, [assigned, start, status, words.length]);
  const counted = done ? status : view.status;
  const wrong = counted.filter((s) => s === "wrong").length;
  const skipped = counted.filter((s) => s === "skipped").length;
  const notReached = done ? status.slice(scope[0], scope[1]).filter((s) => s === "pending").length : 0;
  const hinted = hints.filter((h) => h > 0).length;
  const mistakes = wrong + skipped;
  const suggestion = suggestRating(scope[1] - scope[0], mistakes + notReached, hinted);
  const chosen = rating ?? suggestion;
  const currentAyah = words[Math.min(nextHidden, words.length - 1)]?.ayah;
  const ayahNo = currentAyah === undefined ? 0 : ayahs.indexOf(currentAyah) + 1;
  const phoneAvailable = webSpeechAvailable();
  const usePhone = phoneAvailable && (
    <Button onClick={() => chooseMode("phone")}>{t("Use phone recognition instead")}</Button>
  );

  if (!text || phase === "check")
    return <p className="text-sm text-muted">{t("Loading text…")}</p>;

  if (phase === "intro")
    return (
      <div className="space-y-3 rounded-2xl bg-surface-2 p-4 text-sm">
        <p className="font-medium">
          {t("Recite from memory and the app checks every word.")}
        </p>
        <p className="text-muted">
          {t(
            "It needs a one-time download of about 45–70 MB (best on Wi-Fi). It listens on this device: your voice is never sent anywhere.",
          )}
        </p>
        <p className="text-muted">
          {t(
            "It checks words (skipped or wrong), not tajweed. It can mishear sometimes, especially with background noise.",
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setPhase("loading")}>
            {t("Download and start")}
          </Button>
          {usePhone}
        </div>
      </div>
    );

  if (phase === "loading")
    return (
      <div className="space-y-2 rounded-2xl bg-surface-2 p-4 text-sm">
        <p className="flex items-center gap-2">
          <Spinner />{" "}
          {progress > 0 && progress < 1
            ? t("Downloading… {pct}%", { pct: Math.round(progress * 100) })
            : t("Getting ready…")}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
    );

  if (phase === "error")
    return (
      <div className="space-y-2 rounded-2xl bg-danger-soft p-4 text-sm">
        <p>
          {t(
            "Recite and check couldn't start. Check your internet connection and try again.",
          )}
        </p>
        {errorMsg && <p className="text-xs text-muted">{errorMsg}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPhase(mode === "phone" ? "ready" : "loading")}>{t("Try again")}</Button>
          {mode === "device" && usePhone}
        </div>
      </div>
    );

  const listening = phase === "listening";
  const started = listening || phase === "paused" || phase === "finishing";

  return (
    <div className="space-y-5">
      {done ? (
        <Summary
          words={words}
          ayahs={ayahs}
          status={status}
          notReached={notReached}
          scope={scope}
          hinted={hinted}
          suggestion={suggestion}
          chosen={chosen}
          onChoose={setRating}
          saved={saved}
          heardLog={heardLog}
          onSaveRecording={recording ? () => void saveRecording(finished(recording)) : undefined}
          speed={
            mode === "phone"
              ? t("Recognized by your phone's speech recognition.")
              : !engine || !avgMs
                ? undefined
                : engine.backend === "gpu"
                  ? t("Speed: about {s} s per check, using the graphics chip.", { s: (avgMs / 1000).toFixed(1) })
                  : tp(
                      {
                        one: "Speed: about {s} s per check, using {n} processor core.",
                        other: "Speed: about {s} s per check, using {n} processor cores.",
                      },
                      engine.threads,
                      { s: (avgMs / 1000).toFixed(1) },
                    )
          }
          onSave={
            onRate
              ? async () => {
                  await onRate(chosen);
                  setSaved(true);
                }
              : undefined
          }
          onAgain={() => {
            reset();
            setPhase("ready");
          }}
        />
      ) : (
        slot &&
        createPortal(
          <div className="space-y-2 pt-2.5">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                {started
                  ? t("Ayah {n} of {total}", { n: ayahNo, total: ayahs.length })
                  : t("The text is hidden. Recite from memory.")}
              </span>
              <span className="flex items-center gap-2">
                {checking && <Spinner />}
                {started && (
                  <span className={mistakes ? "font-medium text-danger" : ""}>
                    {tp(
                      { one: "{n} mistake", other: "{n} mistakes" },
                      mistakes,
                    )}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-center gap-6">
              <RoundButton
                label={t("Hint")}
                onClick={hint}
                disabled={nextHidden >= words.length || phase === "finishing"}
              >
                <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0012 3z" />
              </RoundButton>
              <button
                onClick={() => (listening ? pause() : void listen())}
                disabled={phase === "finishing"}
                aria-label={
                  listening
                    ? t("Pause")
                    : started
                      ? t("Continue reciting")
                      : t("Start reciting")
                }
                className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-text shadow-lg transition active:scale-95 disabled:opacity-50"
              >
                {listening && (
                  <>
                    <span
                      ref={halo}
                      aria-hidden
                      className="absolute -inset-1 rounded-full bg-accent/20 opacity-25 transition-[transform,opacity] duration-100 ease-out"
                    />
                    <span ref={ring} aria-hidden className="absolute inset-0 rounded-full bg-accent/35 transition-transform duration-75 ease-out" />
                  </>
                )}
                <svg
                  viewBox="0 0 24 24"
                  className="relative h-7 w-7"
                  fill="currentColor"
                  aria-hidden
                >
                  {listening ? (
                    <path d="M8 6h3v12H8zM13 6h3v12h-3z" />
                  ) : (
                    <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.9V21h2v-2.1A7 7 0 0019 12h-2z" />
                  )}
                </svg>
              </button>
              <RoundButton
                label={t("Finish")}
                onClick={() => void finish()}
                disabled={!started || phase === "finishing"}
              >
                <path d="M5 12l5 5L20 7" />
              </RoundButton>
            </div>
            <p className="text-center text-xs text-muted" aria-live="polite">
              {phase === "finishing" ? (
                t("Checking the last part…")
              ) : quiet && listening ? (
                <span className="text-warn">
                  {t(
                    "I can't hear anything. Is the microphone allowed and not muted? Try speaking a little louder.",
                  )}
                </span>
              ) : listening && mode === "phone" && !micOn ? (
                t("Starting the microphone…")
              ) : listening ? (
                t("Listening… recite at your normal pace.")
              ) : phase === "paused" ? (
                t("Paused. Tap the microphone to continue.")
              ) : (
                t(
                  "Tap the microphone and start reciting. Use the bulb if you get stuck.",
                )
              )}
            </p>
            {errorMsg && (
              <p className="text-center text-xs text-danger">{errorMsg}</p>
            )}
            {!started && leftover && (
              <p className="text-center text-[11px] leading-snug text-muted">
                {t("Your last recitation stopped before you finished it.")}{" "}
                <button
                  className="underline underline-offset-2 hover:text-text"
                  onClick={() => {
                    void saveRecording(leftover);
                    forgetUnfinished();
                    setLeftover(null);
                  }}
                >
                  {t("Save its recording")}
                </button>
              </p>
            )}
            {!started && (mode === "phone" || phoneAvailable) && (
              <p className="text-center text-[11px] leading-snug text-muted">
                {mode === "phone"
                  ? t("Uses your phone's speech recognition (Google or Apple), like voice typing: nothing to download.")
                  : t("Private mode: everything stays on this device.")}{" "}
                <button
                  className="underline underline-offset-2 hover:text-text"
                  onClick={() => chooseMode(mode === "phone" ? "device" : "phone")}
                >
                  {mode === "phone" ? t("Use private mode") : t("Use phone recognition instead")}
                </button>
              </p>
            )}
          </div>,
          slot,
        )
      )}

      <PageBar
        pages={pages}
        words={words}
        page={shownPage}
        onPage={setPage}
        locked={phase === "listening" || phase === "finishing"}
        startHere={!started && !done}
      />
      <RecitedText
        words={words}
        range={pages[shownPage] ?? [0, words.length]}
        status={done ? status : view.status}
        hints={hints}
        done={done}
        next={nextHidden}
        started={started}
        onFix={fix}
      />
    </div>
  );
}

/** A word's state in one letter, so a page can tell whether anything on it changed. */
const CODE: Record<WordStatus, string> = { pending: "p", correct: "c", wrong: "w", skipped: "s" };
const STATUS: Record<string, WordStatus> = { p: "pending", c: "correct", w: "wrong", s: "skipped" };

/**
 * The words of the page being recited: hidden bars, revealed words, hints and mistakes. One mushaf page
 * at a time (about as long as Al-Fatiha's whole page), redrawn only when a word on it changes.
 */
const RecitedText = memo(function RecitedText({
  words,
  range: [a, b],
  status,
  hints,
  done,
  next,
  started,
  onFix,
}: {
  words: Word[];
  /** The page shown: [first word, end). */
  range: [number, number];
  status: WordStatus[];
  hints: number[];
  done: boolean;
  next: number;
  started: boolean;
  onFix: (i: number) => void;
}) {
  const lang = useLang();
  return (
    <TextPage
      key={a}
      words={words}
      from={a}
      to={b}
      states={status.slice(a, b).map((s) => CODE[s]).join("")}
      hints={hints.slice(a, b).join(",")}
      done={done}
      next={next >= a && next < b ? next : -1}
      started={started}
      onFix={onFix}
      lang={lang}
    />
  );
});

/**
 * Which mushaf page of the portion is shown, with buttons to turn the page. Before you start, the page
 * shown is where reciting starts; while you recite, it turns by itself.
 */
function PageBar({
  pages,
  words,
  page,
  onPage,
  locked,
  startHere,
}: {
  pages: [number, number][];
  words: Word[];
  page: number;
  onPage: (k: number) => void;
  locked: boolean;
  startHere: boolean;
}) {
  useLang();
  if (pages.length < 2) return null;
  const [a, b] = pages[page];
  const ayahsHere = [...new Set(words.slice(a, b).map((w) => w.ayah))];
  const button = (k: number, label: string, path: string) => (
    <button
      onClick={() => onPage(k)}
      disabled={locked || k < 0 || k >= pages.length}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-text disabled:opacity-30"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={path} />
      </svg>
    </button>
  );
  return (
    <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
      {button(page - 1, t("Previous page"), "M15 6l-6 6 6 6")}
      <div className="min-w-0 flex-1 text-center leading-tight">
        <p className="truncate text-sm font-medium">
          {t("Page {n}", { n: q.pageOf[ayahsHere[0]] })} · {q.rangeLabel(ayahsHere)}
        </p>
        <p className="text-xs text-muted">
          {startHere && page > 0 ? t("You'll start on this page") : t("{n} of {total}", { n: page + 1, total: pages.length })}
        </p>
      </div>
      {button(page + 1, t("Next page"), "M9 6l6 6-6 6")}
    </div>
  );
}

/** One mushaf page of the portion's words. */
const TextPage = memo(function TextPage({
  words,
  from,
  to,
  states,
  hints,
  done,
  next,
  started,
  onFix,
}: {
  words: Word[];
  from: number;
  to: number;
  /** Each word's state, one letter per word (`CODE`). */
  states: string;
  /** Hint presses per word, comma-separated. */
  hints: string;
  done: boolean;
  /** The word you're at, if it's on this page (else -1). */
  next: number;
  started: boolean;
  onFix: (i: number) => void;
  /** Redraws the page when the language changes (its tooltip). */
  lang: string;
}) {
  const hint = hints.split(",").map(Number);
  return (
    <p
      className="quran text-justify [content-visibility:auto]"
      // Until it's drawn, a page off screen takes about the room it will.
      style={{ containIntrinsicSize: `auto ${(to - from) * 14}px` }}
      lang="ar"
      dir="rtl"
    >
      {words.slice(from, to).map((w, k) => {
        const i = from + k;
        const st = STATUS[states[k]];
        const isShown = done || st !== "pending";
        const fixable = done && (st === "wrong" || st === "skipped");
        const hintShown = !isShown && hint[k] > 0;
        const cls = hintShown
          ? "text-muted"
          : st === "wrong"
            ? "rounded-md bg-danger-soft text-danger"
            : st === "skipped"
              ? "rounded-md text-warn underline decoration-dotted decoration-2 underline-offset-8"
              : isShown
                ? done && st === "pending"
                  ? "text-muted"
                  : ""
                : // Hidden: a slim word-shaped bar, as wide as the word itself.
                  `inline-block h-[0.55em] overflow-hidden rounded-full align-middle leading-[0.55em] text-transparent ${
                    i === next && started
                      ? "bg-accent/35 motion-safe:animate-pulse"
                      : "bg-border"
                  }`;
        return (
          <span key={i}>
            <span
              className={`transition-colors duration-500 ${cls} ${fixable ? "cursor-pointer" : ""}`}
              data-w={i}
              data-hidden={!isShown && !hintShown ? "" : undefined}
              title={fixable ? t("Tap if you said it right") : undefined}
              onClick={fixable ? () => onFix(i) : undefined}
            >
              {hintShown ? hintText(w.text, hint[k]) : w.text}
            </span>
            {w.last && (
              <span className="ayah-num">
                ﴿{toArabicDigits(q.ayahOf[w.ayah])}﴾
              </span>
            )}{" "}
          </span>
        );
      })}
    </p>
  );
});

function RoundButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-muted transition hover:text-text active:scale-95 disabled:opacity-30"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}

/** Plays one ayah in the reciter chosen for Listen. */
let player: HTMLAudioElement | null = null;
function playAyah(ayah: number) {
  let id: string | null = null;
  try {
    id = localStorage.getItem("hifz:reciter");
  } catch {
    /* ignore */
  }
  player?.pause();
  player = newAudio(audioUrl(reciterById(id), ayah));
  void player.play().catch(() => {});
}

function Summary(p: {
  words: Word[];
  ayahs: number[];
  status: WordStatus[];
  /** The words that count: all of them, or (reciting freely) the stretch recited. */
  scope: [number, number];
  notReached: number;
  hinted: number;
  suggestion: Rating;
  chosen: Rating;
  onChoose: (r: Rating) => void;
  onSave?: () => Promise<void>;
  saved: boolean;
  heardLog: string[];
  speed?: string;
  /** Saves a recording of this recitation (no sound), to report a problem. */
  onSaveRecording?: () => void;
  onAgain: () => void;
}) {
  const counted = p.status.slice(p.scope[0], p.scope[1]);
  const total = counted.length;
  const right = counted.filter((s) => s === "correct").length;
  const pct = total ? Math.round((right / total) * 100) : 0;
  const wrong = p.status.filter((s) => s === "wrong").length;
  const skipped = p.status.filter((s) => s === "skipped").length;
  const perfect = wrong + skipped + p.notReached + p.hinted === 0;
  const parts = [
    wrong && tp({ one: "{n} wrong word", other: "{n} wrong words" }, wrong),
    skipped &&
      tp({ one: "{n} skipped word", other: "{n} skipped words" }, skipped),
    p.notReached &&
      tp(
        { one: "{n} word not reached", other: "{n} words not reached" },
        p.notReached,
      ),
    p.hinted && tp({ one: "{n} hint", other: "{n} hints" }, p.hinted),
  ].filter(Boolean);
  // Mistakes per ayah, with the correct recitation to listen to.
  const byAyah = p.ayahs
    .map((a) => ({
      ayah: a,
      words: p.words
        .map((w, i) => ({ w, i }))
        .filter(
          ({ w, i }) =>
            w.ayah === a &&
            (p.status[i] === "wrong" || p.status[i] === "skipped"),
        ),
    }))
    .filter((x) => x.words.length);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
          style={{
            background: `conic-gradient(var(--accent) ${pct}%, var(--surface-2) 0)`,
          }}
          aria-label={t("{pct}% correct", { pct })}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface tabular-nums">
            {pct}%
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-medium">
            {perfect ? t("No mistakes. Masha'Allah!") : parts.join(" · ")}
          </p>
          <p className="text-xs text-muted">
            {t("{right} of {total} words right", { right, total })}
          </p>
        </div>
      </div>

      {byAyah.length > 0 && (
        <ul className="space-y-1.5">
          {byAyah.map(({ ayah, words }) => (
            <li
              key={ayah}
              className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2"
            >
              <button
                onClick={() => playAyah(ayah)}
                aria-label={t("Listen to {ayah}", {
                  ayah: q.rangeLabel([ayah]),
                })}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-text"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <span className="shrink-0 text-xs text-muted">
                {q.rangeLabel([ayah])}
              </span>
              <span
                className="quran min-w-0 flex-1 truncate text-end text-lg leading-normal"
                lang="ar"
                dir="rtl"
              >
                {words.map(({ w, i }) => (
                  <span
                    key={i}
                    className={
                      p.status[i] === "wrong" ? "text-danger" : "text-warn"
                    }
                  >
                    {w.text}{" "}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!perfect && (
        <p className="text-xs text-muted">
          {t("Marked wrong but you said it right? Tap the word to correct it.")}
        </p>
      )}

      <div
        className="flex flex-wrap items-center gap-1.5 text-sm"
        role="radiogroup"
        aria-label={t("Rating")}
      >
        <span className="text-muted">{t("Suggested rating:")}</span>
        {(["strong", "okay", "weak"] as Rating[]).map((r) => (
          <button
            key={r}
            role="radio"
            aria-checked={p.chosen === r}
            disabled={p.saved}
            onClick={() => p.onChoose(r)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${p.chosen === r ? "border-accent bg-accent text-accent-text" : "border-border text-muted hover:text-text"}`}
          >
            {t(RATING_LABEL[r])}
            {r === p.suggestion ? " ✓" : ""}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {p.onSave && (
          <Button
            variant="primary"
            disabled={p.saved}
            onClick={() => void p.onSave!()}
          >
            {p.saved
              ? t("Saved ✓")
              : t("Save as done: {rating}", {
                  rating: t(RATING_LABEL[p.chosen]),
                })}
          </Button>
        )}
        <Button onClick={p.onAgain}>↺ {t("Try again")}</Button>
      </div>
      {(p.heardLog.length > 0 || p.onSaveRecording) && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">
            {t("What the app heard")}
          </summary>
          {p.heardLog.length > 0 ? (
            <p className="mt-1 leading-relaxed" lang="ar" dir="rtl">
              {p.heardLog.join(" · ")}
            </p>
          ) : (
            <p className="mt-1">{t("Nothing was heard.")}</p>
          )}
          {p.speed && <p className="mt-1">{p.speed}</p>}
          {p.onSaveRecording && (
            <div className="mt-2 space-y-1">
              <Button onClick={p.onSaveRecording}>{t("Save a recording of this recitation")}</Button>
              <p>{t("Something not right? The recording has what your phone heard and when (no sound). Send it along when you report a problem.")}</p>
            </div>
          )}
        </details>
      )}
    </div>
  );
}
