"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { q } from "@/lib/app";
import { t, tp } from "@/i18n";
import { useLang } from "@/i18n/react";
import { align, ayahWords, hintText, suggestRating, type Rating, type WordStatus } from "@/recite/match";
import { Mic } from "@/recite/mic";
import { loadModel, modelIsDownloaded, transcribe } from "@/recite/recognizer";
import { loadText } from "./AyahText";
import { Button, Spinner } from "./ui";

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

type Word = { ayah: number; text: string; last: boolean };
type Phase = "check" | "intro" | "loading" | "ready" | "listening" | "finishing" | "done" | "error";

const RATING_LABEL: Record<Rating, string> = { strong: "Strong", okay: "Okay", weak: "Weak" };

/**
 * Recite from memory with the text hidden; the app listens (on this device)
 * and reveals each word you get right. Mistakes show in red, skipped words in
 * orange. At the end it suggests a rating, which you confirm or change.
 */
export function ReciteCheck({ ayahs, onRate }: { ayahs: number[]; onRate?: (r: Rating) => Promise<void> | void }) {
  useLang();
  const [text, setText] = useState<string[] | null>(null);
  const [phase, setPhase] = useState<Phase>("check");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusRaw, setStatus] = useState<WordStatus[]>([]);
  const [ptr, setPtr] = useState(0);
  const [tentative, setTentative] = useState<Set<number>>(new Set());
  const [hintsRaw, setHints] = useState<number[]>([]);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");
  const [checking, setChecking] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [saved, setSaved] = useState(false);

  const pointer = useRef(0);
  const mic = useRef<Mic | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(0);
  /** How long the last check took: on slow phones the in-between previews are skipped so it doesn't fall behind. */
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
    setPtr(0);
    setStatus(words.map(() => "pending"));
    setTentative(new Set());
    setHints(words.map(() => 0));
    setRating(null);
    setSaved(false);
  };

  // Load the model once the person has agreed (or it's already on the device).
  useEffect(() => {
    if (phase !== "loading") return;
    loadModel((loaded, total) => setProgress(total ? loaded / total : 0)).then(
      () => setPhase("ready"),
      (e: Error) => {
        setErrorMsg(e.message);
        setPhase("error");
      },
    );
  }, [phase]);

  const commit = (heard: string) => {
    const r = align(expected, heard.split(/\s+/).filter(Boolean), pointer.current);
    if (!r.statuses.length) return;
    setStatus((prev) => {
      const next = prev.length === expected.length ? [...prev] : expected.map((): WordStatus => "pending");
      for (const s of r.statuses) next[s.index] = s.status;
      return next;
    });
    pointer.current = r.next;
    setPtr(r.next);
    setTentative(new Set());
  };

  const check = async (audio: Float32Array) => {
    const t0 = performance.now();
    setChecking(true);
    try {
      const text = await transcribe(audio);
      if (text.trim()) setHeard(text.trim());
      return text;
    } finally {
      lastCheckMs.current = performance.now() - t0;
      if (busy.current <= 1) setChecking(false);
    }
  };

  const onPart = (audio: Float32Array) => {
    busy.current++;
    chain.current = chain.current.then(async () => {
      try {
        commit(await check(audio));
      } catch {
        /* a part that couldn't be read is simply skipped */
      } finally {
        busy.current--;
      }
    });
  };

  const onPartial = (audio: Float32Array) => {
    // Don't fall behind: skip previews while a part is being checked, or when this phone checks slowly.
    if (busy.current > 0 || lastCheckMs.current > 2500) return;
    busy.current++;
    chain.current = chain.current.then(async () => {
      try {
        const heard = await check(audio);
        const r = align(expected, heard.split(/\s+/).filter(Boolean), pointer.current);
        setTentative(new Set(r.statuses.filter((s) => s.status === "correct").map((s) => s.index)));
      } catch {
        /* ignore */
      } finally {
        busy.current--;
      }
    });
  };

  const start = async () => {
    reset();
    setErrorMsg(null);
    setHeard("");
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

  const finish = async () => {
    setPhase("finishing");
    mic.current?.stop();
    mic.current = null;
    setLevel(0);
    await chain.current;
    setTentative(new Set());
    setPhase("done");
  };

  // The next word still hidden: where the hint helps.
  const nextHidden = (() => {
    let i = ptr;
    while (i < words.length && (status[i] !== "pending" || tentative.has(i))) i++;
    return i;
  })();

  const hint = () => {
    if (nextHidden >= words.length) return;
    setHints(hints.map((v, k) => (k === nextHidden ? v + 1 : v)));
  };

  // Results.
  const wrong = status.filter((s) => s === "wrong").length;
  const skipped = status.filter((s) => s === "skipped").length;
  const notReached = phase === "done" ? status.filter((s) => s === "pending").length : 0;
  const hinted = hints.filter((h) => h > 0).length;
  const suggestion = suggestRating(words.length, wrong + skipped + notReached, hinted);
  const chosen = rating ?? suggestion;

  if (!text || phase === "check") return <p className="text-sm text-muted">{t("Loading text…")}</p>;

  if (phase === "intro")
    return (
      <div className="space-y-3 rounded-xl bg-surface-2 p-4 text-sm">
        <p className="font-medium">{t("Recite from memory and the app checks every word.")}</p>
        <p className="text-muted">
          {t("It needs a one-time download of about 45 MB (best on Wi-Fi). It listens on this device: your voice is never sent anywhere.")}
        </p>
        <p className="text-muted">{t("It checks words (skipped or wrong), not tajweed. It can mishear sometimes, especially with background noise.")}</p>
        <Button variant="primary" onClick={() => setPhase("loading")}>
          {t("Download and start")}
        </Button>
      </div>
    );

  if (phase === "loading")
    return (
      <div className="space-y-2 rounded-xl bg-surface-2 p-4 text-sm">
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
      <div className="space-y-2 rounded-xl bg-danger-soft p-4 text-sm">
        <p>{t("Recite and check couldn't start. Check your internet connection and try again.")}</p>
        {errorMsg && <p className="text-xs text-muted">{errorMsg}</p>}
        <Button onClick={() => setPhase("loading")}>{t("Try again")}</Button>
      </div>
    );

  const done = phase === "done";
  const listening = phase === "listening";

  return (
    <div className="space-y-4">
      {/* Sticks just under the mode row of the sheet. */}
      <div className="sticky top-[3.1rem] z-10 -mx-5 -mt-4 space-y-2 border-b border-border bg-surface px-5 pb-3 pt-1">
        {!done ? (
          <div className="flex items-center gap-2">
            {listening || phase === "finishing" ? (
              <Button variant="primary" onClick={() => void finish()} disabled={phase === "finishing"} className="flex-1">
                {phase === "finishing" ? <Spinner /> : t("I'm done")}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void start()} className="flex-1">
                🎤 {t("Start reciting")}
              </Button>
            )}
            <Button onClick={hint} disabled={nextHidden >= words.length || phase === "finishing"}>
              💡 {t("Hint")}
            </Button>
          </div>
        ) : (
          <Summary
            words={words.length}
            wrong={wrong}
            skipped={skipped}
            notReached={notReached}
            hinted={hinted}
            suggestion={suggestion}
            chosen={chosen}
            onChoose={setRating}
            saved={saved}
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
        )}
        {(listening || phase === "finishing") && (
          <div className="space-y-1 text-xs text-muted" aria-live="polite">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-border" aria-hidden>
                <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(level * 100)}%` }} />
              </span>
              {checking ? (
                <span className="flex items-center gap-1.5">
                  <Spinner /> {t("Checking…")}
                </span>
              ) : (
                t("Listening… recite at your normal pace. Words appear as you get them right.")
              )}
            </div>
            {quiet && listening && <p className="text-warn">{t("I can't hear anything. Is the microphone allowed and not muted? Try speaking a little louder.")}</p>}
            {heard && (
              <p dir="rtl" lang="ar" className="truncate">
                {t("Heard:")} {heard}
              </p>
            )}
          </div>
        )}
        {phase === "ready" && <p className="text-xs text-muted">{t("The text is hidden. Press start and recite from memory; use Hint if you get stuck.")}</p>}
        {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}
      </div>

      <p className="quran" lang="ar" dir="rtl">
        {words.map((w, i) => {
          const st = status[i];
          const shown = st === "correct" || tentative.has(i) || done;
          const cls =
            st === "wrong"
              ? "text-danger underline decoration-2"
              : st === "skipped"
                ? "text-warn"
                : st === "pending" && done
                  ? "text-muted"
                  : i === nextHidden && !done
                    ? "rounded bg-accent-soft"
                    : "";
          const fixable = done && (st === "wrong" || st === "skipped");
          return (
            <span key={i}>
              <span
                className={`${cls} ${fixable ? "cursor-pointer" : ""}`}
                title={fixable ? t("Tap if you said it right") : undefined}
                onClick={fixable ? () => setStatus(status.map((v, k) => (k === i ? "correct" : v))) : undefined}
              >{shown || st === "wrong" || st === "skipped" ? w.text : hints[i] ? hintText(w.text, hints[i]) : <span className="text-muted">• • •</span>}</span>
              {w.last && <span className="ayah-num">﴿{toArabicDigits(q.ayahOf[w.ayah])}﴾</span>}{" "}
            </span>
          );
        })}
      </p>
    </div>
  );
}

function Summary(p: {
  words: number;
  wrong: number;
  skipped: number;
  notReached: number;
  hinted: number;
  suggestion: Rating;
  chosen: Rating;
  onChoose: (r: Rating) => void;
  onSave?: () => Promise<void>;
  saved: boolean;
  onAgain: () => void;
}) {
  const perfect = p.wrong + p.skipped + p.notReached + p.hinted === 0;
  const parts = [
    p.wrong && tp({ one: "{n} wrong word", other: "{n} wrong words" }, p.wrong),
    p.skipped && tp({ one: "{n} skipped word", other: "{n} skipped words" }, p.skipped),
    p.notReached && tp({ one: "{n} word not reached", other: "{n} words not reached" }, p.notReached),
    p.hinted && tp({ one: "{n} hint", other: "{n} hints" }, p.hinted),
  ].filter(Boolean);
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-medium">{perfect ? t("No mistakes. Masha'Allah!") : parts.join(" · ")}</p>
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
    </div>
  );
}
