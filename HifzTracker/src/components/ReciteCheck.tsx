"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { q } from "@/lib/app";
import { t, tp, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { audioUrl, newAudio, reciterById } from "@/audio/recitation";
import {
  align,
  ayahWords,
  fold,
  hintText,
  SURE,
  suggestRating,
  type Alignment,
  type Rating,
  type WordStatus,
} from "@/recite/match";
import { concat, Mic, RATE } from "@/recite/mic";
import { loadModel, modelIsDownloaded, transcribe, type Engine } from "@/recite/recognizer";
import { LAST_WORD_SURE, reveal, settleable, type Live } from "@/recite/reveal";
import { heardWords, WebSpeech, webSpeechAvailable, type SpeechProblem } from "@/recite/webspeech";
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

/** Phone recognition: text that hasn't changed for this long counts as settled (iPhone never says "final"). */
const SETTLE_MS = 1000;

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
  /** The ring around the microphone button: moved straight from the mic, without redrawing the page. */
  const ring = useRef<HTMLSpanElement>(null);

  // Phone recognition.
  const speech = useRef<WebSpeech | null>(null);
  /** Words of the current recognition session already settled (what comes after them is new). */
  const settledWords = useRef<string[]>([]);
  /** The latest live result, until it's settled. */
  const pending = useRef<{ r: Alignment; words: string[]; base: number; fresh: string[] } | null>(null);
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
  /** The previous part and where in the text it started: context for a second listen. */
  const prev = useRef<{ audio: Float32Array; from: number } | null>(null);

  useEffect(() => {
    loadText().then(setText, () => setPhase("error"));
    return () => {
      mic.current?.stop();
      void speech.current?.stop();
      clearTimeout(settleTimer.current);
    };
  }, []);

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
  /** What shows while reciting: settled words, then live ones, strictly in order. */
  const view = useMemo(() => reveal(status, live, confirmed), [status, live, confirmed]);

  const reset = () => {
    pointer.current = 0;
    carry.current = null;
    prev.current = null;
    seen.current = new Set();
    settledWords.current = [];
    pending.current = null;
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

  const pulse = () => {
    const el = ring.current;
    if (!el) return;
    el.style.transform = "scale(1.35)";
    setTimeout(() => {
      el.style.transform = "scale(1)";
    }, 160);
  };

  /** Settles the latest live result: all of it when final, else all but a wrong last word. */
  const settle = (final: boolean) => {
    clearTimeout(settleTimer.current);
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    const s = settleable(p.r, p.fresh.length, final);
    debug(final ? "phone: final" : "phone: settled", p.fresh, s);
    commit(s);
    settledWords.current = p.words.slice(0, p.base + s.used);
    if (s.used) setHeardLog((l) => [...l.slice(-30), p.fresh.slice(0, s.used).join(" ")]);
    setLive(null);
  };

  const onText = (transcript: string, final: boolean) => {
    const heard = heardWords(transcript);
    // The words at the start that were already settled are skipped. If the recognizer started
    // over or changed its mind, fewer words match, and the rest simply counts as new.
    const done = settledWords.current;
    let base = 0;
    while (base < done.length && base < heard.length && fold(heard[base]) === fold(done[base])) base++;
    const fresh = heard.slice(base);
    const r = align(expected, fresh, pointer.current);
    pending.current = { r, words: heard, base, fresh };
    setLive({ statuses: r.statuses, heard: fresh.length });
    pulse();
    clearTimeout(settleTimer.current);
    if (final) settle(true);
    else settleTimer.current = setTimeout(() => settle(false), SETTLE_MS);
  };

  const onProblem = (p: SpeechProblem) => {
    speech.current = null;
    if (p === "interrupted") return setPhase("paused");
    setErrorMsg(t(PROBLEM[p]));
    setPhase(pointer.current > 0 ? "paused" : "ready");
  };

  // The phone's recognition has no sound level: warn when nothing has been heard for a while.
  useEffect(() => {
    if (phase !== "listening" || mode !== "phone") return;
    const id = setInterval(() => setQuiet(Date.now() - lastSound.current > 8000), 1000);
    return () => clearInterval(id);
  }, [phase, mode]);

  // ---- On-device model (private mode) ----

  const check = async (audio: Float32Array) => {
    const t0 = performance.now();
    setChecking(true);
    try {
      // A copy goes to the model: the original is still needed for a second listen.
      const heard = (await transcribe(audio.slice())).trim();
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

  const onPart = (part: Float32Array) => {
    busy.current++;
    chain.current = chain.current.then(async () => {
      const audio = carry.current ? concat([carry.current, part]) : part;
      carry.current = null;
      const from = pointer.current;
      try {
        const heard = await check(audio);
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

  const onPartial = (audio: Float32Array) => {
    // Live preview: whenever the model is free (and not hopelessly slow), so it never falls behind.
    if (busy.current > 0 || lastCheckMs.current > 4000) return;
    busy.current++;
    chain.current = chain.current.then(async () => {
      try {
        const heard = await check(carry.current ? concat([carry.current, audio]) : audio);
        const r = align(expected, heard, pointer.current);
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
    if (mode === "phone") {
      settledWords.current = [];
      pending.current = null;
      const s = new WebSpeech({
        onText,
        onActivity: () => {
          lastSound.current = Date.now();
        },
        onSessionEnd: () => {
          settle(false);
          settledWords.current = [];
        },
        onError: onProblem,
      });
      speech.current = s;
      // Straight from the tap: browsers only start recognition from one.
      s.start();
      setPhase("listening");
      return;
    }
    const m = new Mic({
      onPart,
      onPartial,
      onLevel: (l) => {
        if (ring.current) ring.current.style.transform = `scale(${1 + Math.min(0.6, l * 1.2)})`;
        if (l > 0.02) lastSound.current = Date.now();
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
    if (mode === "phone") {
      const s = speech.current;
      speech.current = null;
      void s?.stop();
    } else {
      mic.current?.stop();
      mic.current = null;
    }
    setPhase("paused");
  };

  const finish = async () => {
    setPhase("finishing");
    if (mode === "phone") {
      const s = speech.current;
      speech.current = null;
      await s?.stop();
      settle(false);
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
    setPhase("done");
  };

  const done = phase === "done";
  // The next word still hidden: where you are, and where the hint helps.
  const nextHidden = view.next;

  const hint = () => {
    if (nextHidden >= words.length) return;
    setHints(hints.map((v, k) => (k === nextHidden ? v + 1 : v)));
  };

  const fix = useCallback(
    (i: number) => setStatus((prev) => prev.map((v, k) => (k === i ? "correct" : v))),
    [],
  );

  // Results (while reciting: what's shown so far).
  const counted = done ? status : view.status;
  const wrong = counted.filter((s) => s === "wrong").length;
  const skipped = counted.filter((s) => s === "skipped").length;
  const notReached = done ? status.filter((s) => s === "pending").length : 0;
  const hinted = hints.filter((h) => h > 0).length;
  const mistakes = wrong + skipped;
  const suggestion = suggestRating(words.length, mistakes + notReached, hinted);
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
          hinted={hinted}
          suggestion={suggestion}
          chosen={chosen}
          onChoose={setRating}
          saved={saved}
          heardLog={heardLog}
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
                  <span
                    ref={ring}
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-accent/30 transition-transform duration-150"
                  />
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

      <RecitedText
        words={words}
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

/**
 * The portion's words: hidden bars, revealed words, hints and mistakes. Kept apart and memoized:
 * long portions have hundreds of words, and redrawing them all on every result keeps a phone busy.
 */
const RecitedText = memo(function RecitedText({
  words,
  status,
  hints,
  done,
  next,
  started,
  onFix,
}: {
  words: Word[];
  status: WordStatus[];
  hints: number[];
  done: boolean;
  next: number;
  started: boolean;
  onFix: (i: number) => void;
}) {
  useLang();
  return (
    <p className="quran text-justify" lang="ar" dir="rtl">
      {words.map((w, i) => {
        const st = status[i];
        const isShown = done || st !== "pending";
        const fixable = done && (st === "wrong" || st === "skipped");
        const hintShown = !isShown && hints[i] > 0;
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
              data-hidden={!isShown && !hintShown ? "" : undefined}
              title={fixable ? t("Tap if you said it right") : undefined}
              onClick={fixable ? () => onFix(i) : undefined}
            >
              {hintShown ? hintText(w.text, hints[i]) : w.text}
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
  notReached: number;
  hinted: number;
  suggestion: Rating;
  chosen: Rating;
  onChoose: (r: Rating) => void;
  onSave?: () => Promise<void>;
  saved: boolean;
  heardLog: string[];
  speed?: string;
  onAgain: () => void;
}) {
  const total = p.words.length;
  const right = p.status.filter((s) => s === "correct").length;
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
      {p.heardLog.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">
            {t("What the app heard")}
          </summary>
          <p className="mt-1 leading-relaxed" lang="ar" dir="rtl">
            {p.heardLog.join(" · ")}
          </p>
          {p.speed && <p className="mt-1">{p.speed}</p>}
        </details>
      )}
    </div>
  );
}
