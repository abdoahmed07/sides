"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  audioUrl,
  portionOrder,
  RECITERS,
  reciterById,
  segment,
  SPEEDS,
  waitsAfter,
  type Mode,
} from "@/audio/recitation";
import { q } from "@/lib/app";
import { t, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { AyahText } from "./AyahText";
import { ReciteCheck } from "./ReciteCheck";
import type { Rating } from "@/recite/match";

type UiMode = Mode | "recite";

const MODES: { value: UiMode; label: string; hint: string }[] = [
  {
    value: "listen",
    label: tx("Listen"),
    hint: tx("Plays the whole portion, ayah by ayah."),
  },
  {
    value: "repeat",
    label: tx("Repeat after"),
    hint: tx(
      "Plays one ayah, then waits while you repeat it. Go on when you're ready.",
    ),
  },
  {
    value: "link",
    label: tx("Link"),
    hint: tx(
      "Plays ayah 1, then 1–2, then 1–3… so the ayahs join up. Recite along each time.",
    ),
  },
  {
    value: "recite",
    label: tx("Recite"),
    hint: tx("Recite from memory; the app checks every word."),
  },
];

/** Remembered per device: reciter, speed, mode and hide-text. */
function usePref<T extends string>(
  key: string,
  fallback: T,
): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T) || fallback;
    } catch {
      return fallback;
    }
  });
  return [
    v,
    (nv: T) => {
      setV(nv);
      try {
        localStorage.setItem(key, nv);
      } catch {
        /* ignore */
      }
    },
  ];
}

type Phase = "idle" | "playing" | "paused" | "waiting" | "finished";

/** The text of a portion with a player on top: Listen, Repeat after (waits for you) and Link. */
export function ReadAndListen({
  indices,
  onRate,
}: {
  indices: number[];
  onRate?: (r: Rating) => Promise<void> | void;
}) {
  useLang();
  const ayahs = useMemo(() => portionOrder(indices, q.surahOf), [indices]);
  const n = ayahs.length;
  const [reciterId, setReciterId] = usePref<string>(
    "hifz:reciter",
    RECITERS[0].id,
  );
  const [speedStr, setSpeedStr] = usePref<string>("hifz:speed", "1");
  const [uiMode, setModeRaw] = usePref<UiMode>("hifz:listenMode", "repeat");
  const mode: Mode = uiMode === "recite" ? "repeat" : uiMode;
  const [hiddenStr, setHiddenStr] = usePref<string>("hifz:hideText", "0");
  const hidden = hiddenStr === "1";
  const speed = Number(speedStr) || 1;
  const reciter = reciterById(reciterId);

  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [current, setCurrent] = useState<number | null>(null);
  const [rounds, setRounds] = useState(0);
  const [error, setError] = useState(false);

  const audio = useRef<HTMLAudioElement | null>(null);
  const queue = useRef<number[]>([]);
  const qi = useRef(0);
  // The "ended" listener is created once; these keep it pointing at the current settings.
  const modeRef = useRef(mode);
  const playAtRef = useRef<() => void>(() => {});

  const stop = () => {
    audio.current?.pause();
    setPhase("idle");
    setCurrent(null);
  };
  useEffect(() => () => audio.current?.pause(), []);

  const playAt = () => {
    const a = audio.current!;
    const ayah = ayahs[queue.current[qi.current]];
    a.src = audioUrl(reciter, ayah);
    a.playbackRate = speed;
    setCurrent(ayah);
    setPhase("playing");
    setError(false);
    a.play().catch(() => {
      setError(true);
      setPhase("idle");
    });
    // Warm up the next file so there's no gap.
    const next = queue.current[qi.current + 1];
    if (next !== undefined)
      new Audio(audioUrl(reciter, ayahs[next])).preload = "auto";
  };

  useEffect(() => {
    modeRef.current = mode;
    playAtRef.current = playAt;
  });

  const startStep = (p: number) => {
    if (!audio.current) {
      // One element for the whole session: phones only allow sound that starts from a tap.
      const a = new Audio();
      a.addEventListener("ended", () => {
        qi.current += 1;
        if (qi.current < queue.current.length) return playAtRef.current();
        if (waitsAfter(modeRef.current)) {
          setPhase("waiting");
          setRounds((r) => r + 1);
        } else {
          setPhase("finished");
          setCurrent(null);
        }
      });
      a.addEventListener("error", () => {
        setError(true);
        setPhase("idle");
      });
      audio.current = a;
    }
    queue.current = segment(modeRef.current, n, p);
    qi.current = 0;
    if (queue.current.length) playAt();
  };

  const go = (p: number) => {
    const np = Math.min(Math.max(p, 0), n - 1);
    setPos(np);
    setRounds(0);
    startStep(np);
  };

  const main = () => {
    if (phase === "playing") {
      audio.current?.pause();
      setPhase("paused");
    } else if (phase === "paused") {
      audio.current?.play().catch(() => setError(true));
      setPhase("playing");
    } else if (phase === "finished") go(0);
    else startStep(pos);
  };

  const setMode = (m: UiMode) => {
    stop();
    setRounds(0);
    setModeRaw(m);
  };

  const label = (i: number) => q.rangeLabel([ayahs[i]]);
  const atEnd = pos >= n - 1;
  const status =
    phase === "finished"
      ? t("Finished. Play again from the start?")
      : phase === "waiting" && mode === "repeat"
        ? t("Repeat {ayah} from memory. Heard {n}×.", {
            ayah: label(pos),
            n: rounds,
          })
        : phase === "waiting" && mode === "link"
          ? pos === 0
            ? t("Recite {ayah} along. Heard {n}×.", {
                ayah: label(0),
                n: rounds,
              })
            : t("Recite {from} to {to} together. Heard {n}×.", {
                from: label(0),
                to: label(pos),
                n: rounds,
              })
          : current !== null
            ? q.rangeLabel([current])
            : t(MODES.find((m) => m.value === mode)!.hint);

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-5 -mt-4 space-y-2.5 border-b border-border bg-surface px-5 pb-3 pt-3">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="radiogroup"
          aria-label={t("Mode")}
        >
          {MODES.map((m) => (
            <button
              key={m.value}
              role="radio"
              aria-checked={uiMode === m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${uiMode === m.value ? "border-accent bg-accent text-accent-text" : "border-border text-muted hover:text-text"}`}
            >
              {t(m.label)}
            </button>
          ))}
          {uiMode !== "recite" && (
            <button
              aria-pressed={hidden}
              onClick={() => setHiddenStr(hidden ? "0" : "1")}
              className={`ms-auto rounded-full border px-3 py-1 text-xs ${hidden ? "border-accent text-accent" : "border-border text-muted hover:text-text"}`}
            >
              {hidden ? t("Show text") : t("Hide text")}
            </button>
          )}
        </div>

        {uiMode !== "recite" && (
          <>
            <div className="flex items-center gap-2">
              {phase === "waiting" ? (
                <>
                  <button
                    onClick={() => startStep(pos)}
                    className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-surface-2"
                  >
                    ↺ {t("Again")}
                  </button>
                  <button
                    onClick={() => (atEnd ? stop() : go(pos + 1))}
                    className="flex-1 rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-accent-text hover:opacity-90"
                  >
                    {atEnd
                      ? t("Done")
                      : mode === "link"
                        ? t("Add the next ayah")
                        : t("Next ayah")}
                  </button>
                </>
              ) : (
                <>
                  <IconButton
                    label={t("Previous ayah")}
                    disabled={pos === 0}
                    onClick={() => go(pos - 1)}
                    path="M15 6l-6 6 6 6"
                  />
                  <button
                    onClick={main}
                    aria-label={phase === "playing" ? t("Pause") : t("Play")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-text hover:opacity-90"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="currentColor"
                      aria-hidden
                    >
                      {phase === "playing" ? (
                        <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                      ) : (
                        <path d="M8 5v14l11-7z" />
                      )}
                    </svg>
                  </button>
                  <IconButton
                    label={t("Next ayah")}
                    disabled={atEnd}
                    onClick={() => go(pos + 1)}
                    path="M9 6l6 6-6 6"
                  />
                  <p
                    className="min-w-0 flex-1 truncate text-xs text-muted"
                    aria-live="polite"
                  >
                    {status}
                  </p>
                </>
              )}
            </div>
            {phase === "waiting" && (
              <p className="text-xs text-muted" aria-live="polite">
                {status}
              </p>
            )}
            {error && (
              <p className="text-xs text-danger">
                {t("Couldn't play the audio. Check your internet connection.")}
              </p>
            )}

            <details className="text-xs text-muted">
              <summary className="cursor-pointer">
                {reciter.name} · {speed}×
              </summary>
              <div className="mt-2 space-y-2">
                <div
                  className="space-y-1"
                  role="radiogroup"
                  aria-label={t("Reciter")}
                >
                  {RECITERS.map((r) => (
                    <button
                      key={r.id}
                      role="radio"
                      aria-checked={r.id === reciter.id}
                      onClick={() => {
                        stop();
                        setReciterId(r.id);
                      }}
                      className={`block w-full rounded-lg border px-3 py-1.5 text-start ${r.id === reciter.id ? "border-accent text-text" : "border-border hover:text-text"}`}
                    >
                      <span className="font-medium">{r.name}</span> ·{" "}
                      {t(r.style)}
                    </button>
                  ))}
                </div>
                <div
                  className="flex items-center gap-1.5"
                  role="radiogroup"
                  aria-label={t("Speed")}
                >
                  <span>{t("Speed")}</span>
                  {SPEEDS.map((sp) => (
                    <button
                      key={sp}
                      role="radio"
                      aria-checked={sp === speed}
                      onClick={() => {
                        setSpeedStr(String(sp));
                        if (audio.current) audio.current.playbackRate = sp;
                      }}
                      className={`rounded-full border px-2.5 py-0.5 ${sp === speed ? "border-accent text-accent" : "border-border hover:text-text"}`}
                    >
                      {sp}×
                    </button>
                  ))}
                </div>
              </div>
            </details>
          </>
        )}
      </div>

      {uiMode === "recite" ? (
        <ReciteCheck ayahs={ayahs} onRate={onRate} />
      ) : (
        <AyahText
          indices={ayahs}
          active={current ?? (phase === "waiting" ? ayahs[pos] : null)}
          hidden={hidden}
          onPick={(a) => go(ayahs.indexOf(a))}
        />
      )}
    </div>
  );
}

function IconButton({
  label,
  path,
  onClick,
  disabled,
}: {
  label: string;
  path: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30 rtl:-scale-x-100"
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
        <path d={path} />
      </svg>
    </button>
  );
}
