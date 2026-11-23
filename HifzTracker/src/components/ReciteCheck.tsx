"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { q } from "@/lib/app";
import { t, tp } from "@/i18n";
import { useLang } from "@/i18n/react";
import { audioUrl, reciterById } from "@/audio/recitation";
import { align, ayahWords, hintText, SURE, suggestRating, type Alignment, type Rating, type WordStatus } from "@/recite/match";
import { Mic } from "@/recite/mic";
import { loadModel, modelIsDownloaded, transcribe } from "@/recite/recognizer";
import { loadText } from "./AyahText";
import { Button, Spinner } from "./ui";

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

type Word = { ayah: number; text: string; last: boolean };
type Phase = "check" | "intro" | "loading" | "ready" | "listening" | "paused" | "finishing" | "done" | "error";

const RATING_LABEL: Record<Rating, string> = { strong: "Strong", okay: "Okay", weak: "Weak" };

/** A little silence in front shifts the model's window, so a second listen can hear a word the first one missed. */
function shifted(audio: Float32Array): Float32Array {
  const out = new Float32Array(audio.length + 4000);
  out.set(audio, 4000);
  return out;
}

/**
 * Recite from memory with the text hidden; the app listens (on this device)
 * and reveals each word you get right, live. Each word gets several chances:
 * if any check heard it right, it's right. Only consistent mistakes are
 * flagged. At the end: a score, the mistakes per ayah (with the correct
 * recitation to listen to) and a suggested rating to confirm.
 */
export function ReciteCheck({ ayahs, onRate }: { ayahs: number[]; onRate?: (r: Rating) => Promise<void> | void }) {
  useLang();
  const [text, setText] = useState<string[] | null>(null);
  const [phase, setPhase] = useState<Phase>("check");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusRaw, setStatus] = useState<WordStatus[]>([]);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [ptr, setPtr] = useState(0);
  const [hintsRaw, setHints] = useState<number[]>([]);
  const [level, setLevel] = useState(0);
  const [checking, setChecking] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [heardLog, setHeardLog] = useState<string[]>([]);
  const [rating, setRating] = useState<Rating | null>(null);
  const [saved, setSaved] = useState(false);

  const pointer = useRef(0);
  const seen = useRef<Set<number>>(new Set());
  const mic = useRef<Mic | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(0);
  /** How long the last check took: slow phones skip live previews and second listens so they don't fall behind. */
  const lastCheckMs = useRef(0);
  const lastSound = useRef(0);

  useEffect(() => {
    loadText().then(setText, () => setPhase("error"));
    void modelIsDownloaded().then((yes) => setPhase((p) => (p === "check" ? (yes ? "loading" : "intro") : p)));
    return () => mic.current?.stop();
  }, []);

  const words: Word[] = useMemo(() => {
    if (!text) return [];
    return ayahs.flatMap((a) => {
      const ws = ayahWords(text[a]);
      return ws.map((w, k) => ({ ayah: a, text: w, last: k === ws.length - 1 }));
    });
  }, [text, ayahs]);
  const expected = useMemo(() => words.map((w) => w.text), [words]);

  // Per-word state, sized to the words (fresh when the text arrives or after a reset).
  const status: WordStatus[] = statusRaw.length === words.length ? statusRaw : words.map(() => "pending");
  const hints: number[] = hintsRaw.length === words.length ? hintsRaw : words.map(() => 0);

  const reset = () => {
    pointer.current = 0;
    seen.current = new Set();
    setPtr(0);
    setStatus(words.map(() => "pending"));
    setConfirmed(new Set());
    setHints(words.map(() => 0));
    setHeardLog([]);
    setRating(null);
    setSaved(false);
  };

  // Load the model once the person has agreed (or it's already on the device).
  useEffect(() => {
    if (phase !== "loading") return;
    loadModel((loaded, total) => setProgress(total ? loaded / total : 0)).then(
      (backend) => {
        if (process.env.NODE_ENV !== "production") (window as unknown as { __reciteBackend?: string }).__reciteBackend = backend;
        setPhase("ready");
      },
      (e: Error) => {
        setErrorMsg(e.message);
        setPhase("error");
      },
    );
  }, [phase]);

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
      if (busy.current <= 1) setChecking(false);
    }
  };

  /**
   * Words a check heard clearly stay right, even if another check missed them.
   * Only confident matches count, and in a live preview not the last word
   * (it's often cut off mid-word and can look like another word).
   */
  const remember = (r: Alignment, heardCount: number, preview: boolean) => {
    let added = false;
    for (const s of r.statuses)
      if (s.status === "correct" && s.score >= SURE && !(preview && s.heard === heardCount - 1) && !seen.current.has(s.index)) {
        seen.current.add(s.index);
        added = true;
      }
    if (added) setConfirmed(new Set(seen.current));
  };

  /** Development only: what each check heard and decided (window.__recite in the browser console). */
  const debug = (kind: string, heard: string[], r: Alignment) => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __recite?: unknown[] };
    (w.__recite ??= []).push({ kind, from: pointer.current, heard: heard.join(" "), next: r.next, statuses: r.statuses.map((s) => `${s.index}:${s.status}`).join(" ") });
  };

  const commit = (r: Alignment) => {
    if (!r.statuses.length) return;
    setStatus((prev) => {
      const next = prev.length === expected.length ? [...prev] : expected.map((): WordStatus => "pending");
      for (const s of r.statuses) next[s.index] = seen.current.has(s.index) ? "correct" : s.status;
      return next;
    });
    pointer.current = r.next;
    setPtr(r.next);
  };

  const onPart = (audio: Float32Array) => {
    busy.current++;
    chain.current = chain.current.then(async () => {
      try {
        const heard = await check(audio);
        let r = align(expected, heard, pointer.current);
        debug("part", heard, r);
        remember(r, heard.length, false);
        const doubtful = r.statuses.some((s) => s.status !== "correct" && !seen.current.has(s.index));
        // Listen once more before calling anything a mistake (when the phone is quick enough).
        if (doubtful && lastCheckMs.current < 1800) {
          try {
            const heard2 = await check(shifted(audio));
            const again = align(expected, heard2, pointer.current);
            debug("second listen", heard2, again);
            remember(again, heard2.length, false);
            if (again.next > r.next) r = again;
          } catch {
            /* keep the first result */
          }
        }
        commit(r);
      } catch {
        /* a part that couldn't be read is simply skipped */
      } finally {
        busy.current--;
      }
    });
  };

  const onPartial = (audio: Float32Array) => {
    // Live preview: only when the model is free and quick enough, so it never falls behind.
    if (busy.current > 0 || lastCheckMs.current > 2500) return;
    busy.current++;
    chain.current = chain.current.then(async () => {
      try {
        const heard = await check(audio);
        const r = align(expected, heard, pointer.current);
        debug("preview", heard, r);
        remember(r, heard.length, true);
      } catch {
        /* ignore */
      } finally {
        busy.current--;
      }
    });
  };

  const listen = async () => {
    setErrorMsg(null);
    setQuiet(false);
    lastSound.current = Date.now();
    const m = new Mic({
      onPart,
      onPartial,
      onLevel: (l) => {
        setLevel(l);
        if (l > 0.02) lastSound.current = Date.now();
        setQuiet(Date.now() - lastSound.current > 4000);
      },
    });
    try {
      await m.start();
      mic.current = m;
      setPhase("listening");
    } catch {
      setErrorMsg(t("The microphone is blocked. Allow it for this site in your browser settings, then try again."));
    }
  };

  const pause = () => {
    mic.current?.stop();
    mic.current = null;
    setLevel(0);
    setPhase("paused");
  };

  const finish = async () => {
    mic.current?.stop();
    mic.current = null;
    setLevel(0);
    setPhase("finishing");
    await chain.current;
    setPhase("done");
  };

  const done = phase === "done";
  const shown = (i: number) => done || status[i] === "correct" || confirmed.has(i) || status[i] === "wrong" || status[i] === "skipped";
  // The next word still hidden: where you are, and where the hint helps.
  const nextHidden = (() => {
    let i = ptr;
    while (i < words.length && shown(i)) i++;
    return i;
  })();

  const hint = () => {
    if (nextHidden >= words.length) return;
    setHints(hints.map((v, k) => (k === nextHidden ? v + 1 : v)));
  };

  // Results.
  const wrong = status.filter((s) => s === "wrong").length;
  const skipped = status.filter((s) => s === "skipped").length;
  const notReached = done ? status.filter((s, i) => s === "pending" && !confirmed.has(i)).length : 0;
  const hinted = hints.filter((h) => h > 0).length;
  const mistakes = wrong + skipped;
  const suggestion = suggestRating(words.length, mistakes + notReached, hinted);
  const chosen = rating ?? suggestion;
  const currentAyah = words[Math.min(nextHidden, words.length - 1)]?.ayah;
  const ayahNo = currentAyah === undefined ? 0 : ayahs.indexOf(currentAyah) + 1;

  if (!text || phase === "check") return <p className="text-sm text-muted">{t("Loading text…")}</p>;

  if (phase === "intro")
    return (
      <div className="space-y-3 rounded-2xl bg-surface-2 p-4 text-sm">
        <p className="font-medium">{t("Recite from memory and the app checks every word.")}</p>
        <p className="text-muted">
          {t("It needs a one-time download of about 45–70 MB (best on Wi-Fi). It listens on this device: your voice is never sent anywhere.")}
        </p>
        <p className="text-muted">{t("It checks words (skipped or wrong), not tajweed. It can mishear sometimes, especially with background noise.")}</p>
        <Button variant="primary" onClick={() => setPhase("loading")}>
          {t("Download and start")}
        </Button>
      </div>
    );

  if (phase === "loading")
    return (
      <div className="space-y-2 rounded-2xl bg-surface-2 p-4 text-sm">
        <p className="flex items-center gap-2">
          <Spinner /> {progress > 0 && progress < 1 ? t("Downloading… {pct}%", { pct: Math.round(progress * 100) }) : t("Getting ready…")}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
    );

  if (phase === "error")
    return (
      <div className="space-y-2 rounded-2xl bg-danger-soft p-4 text-sm">
        <p>{t("Recite and check couldn't start. Check your internet connection and try again.")}</p>
        {errorMsg && <p className="text-xs text-muted">{errorMsg}</p>}
        <Button onClick={() => setPhase("loading")}>{t("Try again")}</Button>
      </div>
    );

  const listening = phase === "listening";
  const started = listening || phase === "paused" || phase === "finishing";

  return (
    <div className="space-y-5">
      {/* Sticks just under the mode row of the sheet. */}
      <div className={`-mx-5 -mt-4 border-b border-border bg-surface px-5 pb-3 ${done ? "pt-4" : "sticky top-[3.1rem] z-10 pt-2"}`}>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{started ? t("Ayah {n} of {total}", { n: ayahNo, total: ayahs.length }) : t("The text is hidden. Recite from memory.")}</span>
              <span className="flex items-center gap-2">
                {checking && <Spinner />}
                {started && (
                  <span className={mistakes ? "font-medium text-danger" : ""}>
                    {tp({ one: "{n} mistake", other: "{n} mistakes" }, mistakes)}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-center gap-6">
              <RoundButton label={t("Hint")} onClick={hint} disabled={nextHidden >= words.length || phase === "finishing"}>
                <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0012 3z" />
              </RoundButton>
              <button
                onClick={() => (listening ? pause() : void listen())}
                disabled={phase === "finishing"}
                aria-label={listening ? t("Pause") : started ? t("Continue reciting") : t("Start reciting")}
                className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-text shadow-lg transition active:scale-95 disabled:opacity-50"
              >
                {listening && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-accent/30 transition-transform duration-150"
                    style={{ transform: `scale(${1 + Math.min(0.6, level * 1.2)})` }}
                  />
                )}
                <svg viewBox="0 0 24 24" className="relative h-7 w-7" fill="currentColor" aria-hidden>
                  {listening ? (
                    <path d="M8 6h3v12H8zM13 6h3v12h-3z" />
                  ) : (
                    <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.9V21h2v-2.1A7 7 0 0019 12h-2z" />
                  )}
                </svg>
              </button>
              <RoundButton label={t("Finish")} onClick={() => void finish()} disabled={!started || phase === "finishing"}>
                <path d="M5 12l5 5L20 7" />
              </RoundButton>
            </div>
            <p className="text-center text-xs text-muted" aria-live="polite">
              {phase === "finishing"
                ? t("Checking the last part…")
                : quiet && listening
                  ? <span className="text-warn">{t("I can't hear anything. Is the microphone allowed and not muted? Try speaking a little louder.")}</span>
                  : listening
                    ? t("Listening… recite at your normal pace.")
                    : phase === "paused"
                      ? t("Paused. Tap the microphone to continue.")
                      : t("Tap the microphone and start reciting. Use the bulb if you get stuck.")}
            </p>
            {errorMsg && <p className="text-center text-xs text-danger">{errorMsg}</p>}
          </div>
        )}
      </div>

      <p className="quran text-justify" lang="ar" dir="rtl">
        {words.map((w, i) => {
          const st = status[i];
          const isShown = shown(i);
          const fixable = done && (st === "wrong" || st === "skipped");
          const hintShown = !isShown && hints[i] > 0;
          const cls = hintShown
            ? "text-muted"
            : st === "wrong"
              ? "rounded-md bg-danger-soft text-danger"
              : st === "skipped"
                ? "rounded-md text-warn underline decoration-dotted decoration-2 underline-offset-8"
                : isShown
                  ? done && st === "pending" && !confirmed.has(i)
                    ? "text-muted"
                    : ""
                  : // Hidden: a slim word-shaped bar, as wide as the word itself.
                    `inline-block h-[0.55em] overflow-hidden rounded-full align-middle leading-[0.55em] text-transparent ${
                      i === nextHidden && started ? "bg-accent/35 motion-safe:animate-pulse" : "bg-border"
                    }`;
          return (
            <span key={i}>
              <span
                className={`transition-colors duration-500 ${cls} ${fixable ? "cursor-pointer" : ""}`}
                data-hidden={!isShown && !hintShown ? "" : undefined}
                title={fixable ? t("Tap if you said it right") : undefined}
                onClick={fixable ? () => setStatus(status.map((v, k) => (k === i ? "correct" : v))) : undefined}
              >
                {hintShown ? hintText(w.text, hints[i]) : w.text}
              </span>
              {w.last && <span className="ayah-num">﴿{toArabicDigits(q.ayahOf[w.ayah])}﴾</span>}{" "}
            </span>
          );
        })}
      </p>
    </div>
  );
}

function RoundButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-muted transition hover:text-text active:scale-95 disabled:opacity-30"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
  player = new Audio(audioUrl(reciterById(id), ayah));
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
    skipped && tp({ one: "{n} skipped word", other: "{n} skipped words" }, skipped),
    p.notReached && tp({ one: "{n} word not reached", other: "{n} words not reached" }, p.notReached),
    p.hinted && tp({ one: "{n} hint", other: "{n} hints" }, p.hinted),
  ].filter(Boolean);
  // Mistakes per ayah, with the correct recitation to listen to.
  const byAyah = p.ayahs
    .map((a) => ({ ayah: a, words: p.words.map((w, i) => ({ w, i })).filter(({ w, i }) => w.ayah === a && (p.status[i] === "wrong" || p.status[i] === "skipped")) }))
    .filter((x) => x.words.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
          style={{ background: `conic-gradient(var(--accent) ${pct}%, var(--surface-2) 0)` }}
          aria-label={t("{pct}% correct", { pct })}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface tabular-nums">{pct}%</span>
        </div>
        <div className="min-w-0">
          <p className="font-medium">{perfect ? t("No mistakes. Masha'Allah!") : parts.join(" · ")}</p>
          <p className="text-xs text-muted">{t("{right} of {total} words right", { right, total })}</p>
        </div>
      </div>

      {byAyah.length > 0 && (
        <ul className="space-y-1.5">
          {byAyah.map(({ ayah, words }) => (
            <li key={ayah} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
              <button
                onClick={() => playAyah(ayah)}
                aria-label={t("Listen to {ayah}", { ayah: q.rangeLabel([ayah]) })}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-text"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <span className="shrink-0 text-xs text-muted">{q.rangeLabel([ayah])}</span>
              <span className="quran min-w-0 flex-1 truncate text-end text-lg leading-normal" lang="ar" dir="rtl">
                {words.map(({ w, i }) => (
                  <span key={i} className={p.status[i] === "wrong" ? "text-danger" : "text-warn"}>
                    {w.text}{" "}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!perfect && <p className="text-xs text-muted">{t("Marked wrong but you said it right? Tap the word to correct it.")}</p>}

      <div className="flex flex-wrap items-center gap-1.5 text-sm" role="radiogroup" aria-label={t("Rating")}>
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
          <Button variant="primary" disabled={p.saved} onClick={() => void p.onSave!()}>
            {p.saved ? t("Saved ✓") : t("Save as done: {rating}", { rating: t(RATING_LABEL[p.chosen]) })}
          </Button>
        )}
        <Button onClick={p.onAgain}>↺ {t("Try again")}</Button>
      </div>
      {p.heardLog.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">{t("What the app heard")}</summary>
          <p className="mt-1 leading-relaxed" lang="ar" dir="rtl">
            {p.heardLog.join(" · ")}
          </p>
        </details>
      )}
    </div>
  );
}
