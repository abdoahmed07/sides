"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { portionOrder } from "@/audio/recitation";
import { isRtl, t, tp } from "@/i18n";
import { useLang } from "@/i18n/react";
import { q, updateItem } from "@/lib/app";
import { parseTarget, readHref, type ReadTarget } from "@/lib/read";
import { useUnits } from "@/data/hooks";
import { ayahWords } from "@/recite/match";
import { AyahText, loadText } from "./AyahText";
import { ListenPlayer } from "./Listen";
import { ReciteCheck } from "./ReciteCheck";

type Tab = "read" | "listen" | "recite";

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k);

/** "page 604" or "pages 582–604" for the pages these ayahs are on. */
const pagesText = (a: number, b: number) =>
  q.pageOf[a] === q.pageOf[b] ? t("page {n}", { n: q.pageOf[a] }) : t("pages {from}–{to}", { from: q.pageOf[a], to: q.pageOf[b] });

/** What a link points at: the ayahs, a title, and where previous/next go. */
function describe(target: Exclude<ReadTarget, { kind: "index" }>) {
  switch (target.kind) {
    case "ayahs": {
      const ayahs = portionOrder(target.ayahs, q.surahOf);
      return { ayahs, title: q.rangeLabel(ayahs), subtitle: t("page {n}", { n: q.pageOf[ayahs[0]] }), prev: null, next: null };
    }
    case "page": {
      const [a, b] = q.pageRange(target.page);
      const surahs = [...new Set(range(a, b).map((i) => q.surahOf[i]))].map((s) => q.surahName(s)).join(" · ");
      return {
        ayahs: range(a, b),
        title: t("Page {n}", { n: target.page }),
        subtitle: `${surahs} · ${t("Juz {n}", { n: q.juzOf[a] })}`,
        prev: target.page > 1 ? readHref({ kind: "page", page: target.page - 1 }) : null,
        next: target.page < 604 ? readHref({ kind: "page", page: target.page + 1 }) : null,
      };
    }
    case "surah": {
      const [a, b] = q.surahRange(target.surah);
      return {
        ayahs: range(a, b),
        title: `${target.surah}. ${q.surahName(target.surah)}`,
        subtitle: `${tp({ one: "{n} ayah", other: "{n} ayahs" }, b - a + 1)} · ${pagesText(a, b)}`,
        prev: target.surah > 1 ? readHref({ kind: "surah", surah: target.surah - 1 }) : null,
        next: target.surah < 114 ? readHref({ kind: "surah", surah: target.surah + 1 }) : null,
      };
    }
    case "juz": {
      const [a, b] = q.juzRange(target.juz);
      return {
        ayahs: range(a, b),
        title: t("Juz {n}", { n: target.juz }),
        subtitle: pagesText(a, b),
        prev: target.juz > 1 ? readHref({ kind: "juz", juz: target.juz - 1 }) : null,
        next: target.juz < 30 ? readHref({ kind: "juz", juz: target.juz + 1 }) : null,
      };
    }
  }
}

const noop = () => () => {};

/** /read/: the Quran reader (Read, Listen, Recite), or the list of surahs when nothing is chosen. */
export function Reader() {
  useLang();
  const params = useSearchParams();
  // Draw only in the browser: what to show comes from the link, and the language is only known there
  // (drawing on the server first would show English, then switch: a "hydration mismatch").
  const inBrowser = useSyncExternalStore(noop, () => true, () => false);
  if (!inBrowser) return null;
  const target = parseTarget(new URLSearchParams(params?.toString() ?? ""));
  if (target.kind === "index") return <QuranIndex />;
  const item = params?.get("item");
  const date = params?.get("date");
  return <ReaderView key={params?.toString()} target={target} from={item && date ? { item, date } : null} />;
}

function ReaderView({ target, from }: { target: Exclude<ReadTarget, { kind: "index" }>; from: { item: string; date: string } | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("read");
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const view = useMemo(() => describe(target), [target]);
  useEffect(() => {
    if (target.kind !== "ayahs") saveLastRead(target);
  }, [target]);
  // Only memorization portions get a rating (a weekly reading like Al-Kahf doesn't).
  const onRate =
    from && !from.item.startsWith("reading-")
      ? async (rating: "strong" | "okay" | "weak") => {
          await updateItem(from.date, from.item, { done: true, rating });
        }
      : undefined;

  const back = () => (window.history.length > 1 ? router.back() : router.push(from ? "/" : "/read/"));
  const arrow = (dir: "prev" | "next") => (isRtl() ? (dir === "prev" ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6") : dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6");

  return (
    <div>
      <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-4 border-b border-border bg-bg/95 px-4 pb-2 pt-2 backdrop-blur sm:top-[57px]">
        <div className="flex items-center gap-1">
          <IconLink onClick={back} label={t("Back")} path={isRtl() ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
          <div className="min-w-0 flex-1 px-1">
            <h1 className="truncate font-semibold">{view.title}</h1>
            <p className="truncate text-xs text-muted">{view.subtitle}</p>
          </div>
          {view.prev && <IconLink href={view.prev} label={t("Previous")} path={arrow("prev")} />}
          {view.next && <IconLink href={view.next} label={t("Next")} path={arrow("next")} />}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
          {(
            [
              ["read", t("Read"), "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16"],
              ["listen", t("Listen"), "M3 14v-2a9 9 0 0118 0v2M3 14a2 2 0 012-2h1v7H5a2 2 0 01-2-2zM21 14a2 2 0 00-2-2h-1v7h1a2 2 0 002-2z"],
              ["recite", t("Recite"), "M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zM19 11a7 7 0 01-14 0M12 18v3"],
            ] as [Tab, string, string][]
          ).map(([k, label, icon]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                tab === k ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={icon} />
              </svg>
              {label}
            </button>
          ))}
        </div>
        {/* Listen and Recite put their controls here, so they stay in view while the text scrolls. */}
        <div ref={setSlot} />
      </div>

      <div className="pt-5">
        {tab === "read" && <AyahText indices={view.ayahs} />}
        {tab === "listen" && <ListenPlayer indices={view.ayahs} slot={slot} />}
        {tab === "recite" && <ReciteCheck ayahs={view.ayahs} slot={slot} onRate={onRate} />}
      </div>
    </div>
  );
}

function IconLink({ href, onClick, label, path }: { href?: string; onClick?: () => void; label: string; path: string }) {
  const cls = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text";
  const icon = (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
  return href ? (
    <Link href={href} aria-label={label} title={label} className={cls}>
      {icon}
    </Link>
  ) : (
    <button onClick={onClick} aria-label={label} title={label} className={cls}>
      {icon}
    </button>
  );
}

const LAST_READ = "hifz:lastRead";
const INDEX_VIEW = "hifz:quranView";
type Place = Exclude<ReadTarget, { kind: "index" } | { kind: "ayahs" }>;

function saveLastRead(target: Place) {
  try {
    localStorage.setItem(LAST_READ, JSON.stringify(target));
  } catch {
    /* not saved; fine */
  }
}

function lastRead(): Place | null {
  try {
    const p = JSON.parse(localStorage.getItem(LAST_READ) ?? "null") as Place | null;
    return p && ["page", "surah", "juz"].includes(p.kind) ? p : null;
  } catch {
    return null;
  }
}

/** A number in a ring that fills with how much of it you've memorized. */
function Ring({ value, children }: { value: number; children: ReactNode }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center text-xs tabular-nums">
      <svg viewBox="0 0 36 36" className="absolute inset-0 h-9 w-9 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="3" />
        {value > 0 && (
          <circle cx="18" cy="18" r={r} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${Math.max(2, c * value)} ${c}`} />
        )}
      </svg>
      <span className={value >= 1 ? "font-semibold text-accent" : "text-muted"}>{children}</span>
    </span>
  );
}

/** The list of surahs and the 30 juz (each with how much you've memorized), "go to page", and where you left off. */
function QuranIndex() {
  const router = useRouter();
  const units = useUnits();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState("");
  const [view, setViewState] = useState<"surahs" | "juz">(() => {
    try {
      return localStorage.getItem(INDEX_VIEW) === "juz" ? "juz" : "surahs";
    } catch {
      return "surahs";
    }
  });
  const [text, setText] = useState<string[] | null>(null);
  useEffect(() => {
    loadText().then(setText, () => {});
  }, []);
  const [last] = useState(lastRead);
  const setView = (v: "surahs" | "juz") => {
    setViewState(v);
    try {
      localStorage.setItem(INDEX_VIEW, v);
    } catch {
      /* fine */
    }
  };

  // Share of each range you've memorized.
  const memorized = useMemo(() => {
    const m = new Uint8Array(q.count);
    for (const u of units ?? []) for (const a of u.ayahs) m[a] = 1;
    return m;
  }, [units]);
  const share = ([a, b]: [number, number]) => {
    let n = 0;
    for (let i = a; i <= b; i++) n += memorized[i];
    return n / (b - a + 1);
  };

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ء-ي]/g, "");
  const shown = q.surahs.filter((s) => {
    if (!query.trim()) return true;
    const n = norm(query);
    return String(s.n) === query.trim() || norm(s.nameEn).includes(n) || norm(s.name).includes(n) || norm(q.surahName(s.n)).includes(n);
  });
  const goPage = () => {
    const n = Number(page);
    if (Number.isInteger(n) && n >= 1 && n <= 604) router.push(readHref({ kind: "page", page: n }));
  };
  const lastTitle = last && (last.kind === "page" ? t("Page {n}", { n: last.page }) : last.kind === "juz" ? t("Juz {n}", { n: last.juz }) : `${last.surah}. ${q.surahName(last.surah)}`);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Quran")}</h1>
        <p className="mt-1 text-sm text-muted">{t("Read, listen and recite any part of the Quran.")}</p>
      </header>

      {last && lastTitle && (
        <Link href={readHref(last)} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:bg-surface-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted">{t("Continue where you left off")}</span>
            <span className="block truncate text-sm font-medium">{lastTitle}</span>
          </span>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      )}

      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value) setView("surahs");
          }}
          placeholder={t("Search a surah")}
          aria-label={t("Search a surah")}
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
        />
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            goPage();
          }}
        >
          <input
            inputMode="numeric"
            value={page}
            onChange={(e) => setPage(e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder={t("Page")}
            aria-label={t("Go to page")}
            className="w-16 rounded-xl border border-border bg-surface px-2 py-2 text-center text-sm"
          />
          <button type="submit" className="rounded-xl border border-border px-3 text-sm hover:bg-surface-2">
            {t("Go")}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
        {(
          [
            ["surahs", t("Surahs")],
            ["juz", t("Juz")],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`rounded-lg py-1.5 text-sm font-medium transition ${view === v ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "surahs" ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {shown.map((s) => (
            <li key={s.n}>
              <Link href={readHref({ kind: "surah", surah: s.n })} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
                <Ring value={share(q.surahRange(s.n))}>{s.n}</Ring>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{q.surahName(s.n)}</span>
                  <span className="block text-xs text-muted">{tp({ one: "{n} ayah", other: "{n} ayahs" }, s.ayahs)}</span>
                </span>
                <span className="quran shrink-0 text-xl leading-none" lang="ar">
                  {s.name}
                </span>
              </Link>
            </li>
          ))}
          {!shown.length && <li className="px-3 py-4 text-sm text-muted">{t("No surah found.")}</li>}
        </ul>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {range(1, 30).map((j) => {
            const [a] = q.juzRange(j);
            const [p1, p2] = q.juzPages(j);
            return (
              <li key={j}>
                <Link href={readHref({ kind: "juz", juz: j })} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
                  <Ring value={share(q.juzRange(j))}>{j}</Ring>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t("Juz {n}", { n: j })}</span>
                    <span className="block truncate text-xs text-muted">
                      {q.surahName(q.surahOf[a])} {q.ayahOf[a]} · {t("pages {from}–{to}", { from: p1, to: p2 })}
                    </span>
                  </span>
                  {text && (
                    <span className="quran max-w-[42%] shrink-0 truncate leading-normal" style={{ fontSize: "1.2rem" }} lang="ar" dir="rtl">
                      {ayahWords(text[a]).slice(0, 2).join(" ")}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
