"use client";
import { useEffect, useState } from "react";
import { q } from "@/lib/app";
import { portionOrder } from "@/audio/recitation";
import { t } from "@/i18n";
import { useLang } from "@/i18n/react";

let textCache: Promise<string[]> | null = null;
/** The full Uthmani text is a separate chunk, loaded only when first needed. */
export function loadText(): Promise<string[]> {
  if (!textCache) textCache = import("../../data/quran-text.json").then((m) => m.default as unknown as string[]);
  return textCache;
}

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

/**
 * The Uthmani text of some ayahs, grouped by surah. With audio: `active` is
 * highlighted (and scrolled to), `hidden` replaces the text with dots for
 * reciting from memory, and tapping an ayah calls `onPick`.
 */
export function AyahText({
  indices,
  active = null,
  hidden = false,
  onPick,
}: {
  indices: number[];
  active?: number | null;
  hidden?: boolean;
  onPick?: (ayah: number) => void;
}) {
  const [text, setText] = useState<string[] | null>(null);
  const [error, setError] = useState(false);
  const lang = useLang();
  useEffect(() => {
    loadText().then(setText, () => setError(true));
  }, []);
  useEffect(() => {
    if (active === null) return;
    document.getElementById(`ayah-${active}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);
  if (error) return <p className="text-sm text-danger">{t("Could not load the text.")}</p>;
  if (!text) return <p className="text-sm text-muted">{t("Loading text…")}</p>;
  const sorted = portionOrder(indices, q.surahOf);
  // Group by surah so each surah gets its own heading.
  const groups: number[][] = [];
  for (const i of sorted) {
    const g = groups[groups.length - 1];
    if (g && q.surahOf[g[0]] === q.surahOf[i]) g.push(i);
    else groups.push([i]);
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const s = q.surah(q.surahOf[g[0]]);
        return (
          <div key={g[0]}>
            <p className="mb-1 flex items-baseline justify-between text-xs text-muted">
              <span>
                {q.surahName(s.n)} · {t("page {n}", { n: q.pageOf[g[0]] })}
              </span>
              {lang !== "ar" && <span className="quran text-base leading-normal">{s.name}</span>}
            </p>
            <p className="quran" lang="ar">
              {g.map((i) => (
                <span
                  key={i}
                  id={`ayah-${i}`}
                  onClick={onPick ? () => onPick(i) : undefined}
                  className={`rounded-md transition-colors ${onPick ? "cursor-pointer" : ""} ${i === active ? "bg-accent-soft" : ""}`}
                >
                  {hidden ? <span className="text-muted">• • • </span> : text[i]}
                  <span className="ayah-num">﴿{toArabicDigits(q.ayahOf[i])}﴾</span>{" "}
                </span>
              ))}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-surface shadow-xl sm:rounded-3xl"
      >
        {/* Stays put while the text scrolls. */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2" aria-label={t("Close")}>
            {t("Close")}
          </button>
        </div>
        {/* Extra room at the bottom on phones, so the last lines can scroll above the browser's toolbar. */}
        <div className="overflow-y-auto overscroll-contain px-5 pb-28 pt-4 sm:pb-6">{children}</div>
      </div>
    </div>
  );
}
