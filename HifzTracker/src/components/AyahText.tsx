"use client";
import { useEffect, useState } from "react";
import { q } from "@/lib/app";

let textCache: Promise<string[]> | null = null;
/** The full Uthmani text is a separate chunk, loaded only when first needed. */
function loadText(): Promise<string[]> {
  if (!textCache) textCache = import("../../data/quran-text.json").then((m) => m.default as unknown as string[]);
  return textCache;
}

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

export function AyahText({ indices }: { indices: number[] }) {
  const [text, setText] = useState<string[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadText().then(setText, () => setError(true));
  }, []);
  if (error) return <p className="text-sm text-danger">Could not load the text.</p>;
  if (!text) return <p className="text-sm text-muted">Loading text…</p>;
  const sorted = [...indices].sort((a, b) => a - b);
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
                {s.nameEn} · page {q.pageOf[g[0]]}
              </span>
              <span className="quran text-base leading-normal">{s.name}</span>
            </p>
            <p className="quran" lang="ar">
              {g.map((i) => (
                <span key={i}>
                  {text[i]}
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
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2" aria-label="Close">
            Close
          </button>
        </div>
        {/* Extra room at the bottom on phones, so the last lines can scroll above the browser's toolbar. */}
        <div className="overflow-y-auto overscroll-contain px-5 pb-28 pt-4 sm:pb-6">{children}</div>
      </div>
    </div>
  );
}
