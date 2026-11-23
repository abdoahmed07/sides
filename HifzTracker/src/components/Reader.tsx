"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { portionOrder } from "@/audio/recitation";
import { isRtl, t, tp } from "@/i18n";
import { useLang } from "@/i18n/react";
import { q, updateItem } from "@/lib/app";
import { parseTarget, readHref, type ReadTarget } from "@/lib/read";
import { AyahText } from "./AyahText";
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
      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-bg/95 px-4 pb-2 pt-2 backdrop-blur sm:top-[53px]">
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

/** The list of surahs, the 30 juz and "go to page": the way in for anyone who wants to read. */
function QuranIndex() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState("");
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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Quran")}</h1>
        <p className="mt-1 text-sm text-muted">{t("Read, listen and recite any part of the Quran.")}</p>
      </header>

      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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

      {!query && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">{t("Juz")}</h2>
          <div className="grid grid-cols-10 gap-1">
            {range(1, 30).map((j) => (
              <Link
                key={j}
                href={readHref({ kind: "juz", juz: j })}
                className="flex aspect-square items-center justify-center rounded-lg border border-border text-xs tabular-nums hover:border-accent hover:text-accent"
              >
                {j}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t("Surahs")}</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {shown.map((s) => (
            <li key={s.n}>
              <Link href={readHref({ kind: "surah", surah: s.n })} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs tabular-nums text-muted">{s.n}</span>
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
      </section>
    </div>
  );
}
