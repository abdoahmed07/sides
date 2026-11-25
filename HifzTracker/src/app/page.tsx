"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addDays, diffDays, formatDate } from "@/core/dates";
import { useDayLog, useDayLogs, useMeta, usePlan, useToday, useUnits } from "@/data/hooks";
import { ensureDayLog, extraOptions, forecastFor, q, recordExtra, updateItem } from "@/lib/app";
import { AI_ENABLED } from "@/lib/ai-client";
import type { DayItem } from "@/data/types";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { DayItemRow } from "@/components/DayItemRow";
import { Sheet } from "@/components/AyahText";
import { readHref } from "@/lib/read";
import { MissedDays } from "@/components/MissedDays";
import { SignInNudge } from "@/components/Account";
import { activeDatesOf, gains, streaks, totals, type Gains } from "@/core/stats";
import { t, tp, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Rich } from "@/components/Language";
import { manzilRound, sabqiDay, type ManzilRound } from "@/core/schedule/revision-info";
import { ayahOfDay } from "@/lib/encourage";
import { loadText } from "@/components/AyahText";

/** Rough reading speed for weekly readings (looking at the mushaf). */
const READING_MINUTES_PER_PAGE = 2;

export default function TodayPage() {
  const today = useToday();
  const plan = usePlan();
  const log = useDayLog(today);
  const units = useUnits();
  const logs = useDayLogs();
  const weekSeen = useMeta<string>("weekSeen");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [roundOpen, setRoundOpen] = useState(false);
  useLang();

  useEffect(() => {
    if (plan) ensureDayLog(today);
  }, [plan, today]);

  const forecast = useMemo(() => (plan && units ? forecastFor(plan.config, units, today) : null), [plan, units, today]);
  const streak = useMemo(() => (logs ? streaks(plan?.config ?? null, activeDatesOf(logs), today) : null), [logs, plan, today]);

  const round = useMemo(() => (plan && units ? manzilRound(plan.config, units, today) : null), [plan, units, today]);
  // What today added, for the card when the day is done.
  const todayGains = useMemo(() => (units && logs ? gains(units, logs, q, today, today) : null), [units, logs, today]);
  const total = useMemo(() => (units ? totals(units, q) : null), [units]);
  const extra = useMemo(() => (plan && units && log ? extraOptions(plan.config, units, log) : []), [plan, units, log]);

  if (plan === undefined) return null;
  if (plan === null) return <Welcome />;

  const config = plan.config;
  const items = log?.items ?? [];
  const minutes = Math.round(
    items.reduce(
      (s, i) =>
        s +
        (i.kind === "sabaq"
          ? i.lines * config.pace.minutesPerNewLine
          : i.kind === "reading"
            ? (i.lines / 15) * READING_MINUTES_PER_PAGE
            : (i.lines / 15) * config.pace.minutesPerRevisionPage),
      0,
    ),
  );
  const doneCount = items.filter((i) => i.done).length;
  const unitByPage = new Map((units ?? []).map((u) => [u.page, u]));

  const describe = (i: DayItem) => {
    if (i.kind === "reading") {
      const s = q.surah(i.surah!);
      return {
        title: q.surahName(s.n),
        detail: t("whole surah · about {pages}", { pages: tp({ one: "{n} page", other: "{n} pages" }, Math.max(1, Math.round(i.lines / 15))) }),
      };
    }
    const lines = tp({ one: "{n} line", other: "{n} lines" }, i.lines);
    if (i.kind === "sabaq") return { title: q.rangeLabel(i.ayahs ?? []), detail: `${lines} · ${t("page {n}", { n: q.pageOf[i.ayahs![0]] })}` };
    const u = unitByPage.get(i.page!);
    let detail = `${t("Page {n}", { n: i.page! })} · ${lines}`;
    if (i.kind === "sabqi" && u) {
      const d = sabqiDay(u, config.sabqiWindowDays, today);
      detail +=
        " · " +
        (d.kept ? t("kept a few days longer") : d.day >= d.of ? t("last day in sabqi") : t("day {day} of {of}", { day: d.day, of: d.of }));
    }
    return { title: u ? q.rangeLabel(u.ayahs) : t("Page {n}", { n: i.page! }), detail };
  };
  /** What a rating does, said under it: when the page comes back, or what changes tomorrow. */
  const ratingNote = (i: DayItem): string | null => {
    if (!i.done || !i.rating) return null;
    if (i.kind === "sabaq") return i.rating === "weak" ? t("Your next new portion will be lighter, so you can make this one solid.") : null;
    const u = unitByPage.get(i.page!);
    if (!u) return null;
    if (i.kind === "sabqi") {
      const left = u.holdUntil ? diffDays(today, u.holdUntil) : 0;
      return i.rating === "weak" && left > 0 ? tp({ one: "It stays in sabqi {n} more day.", other: "It stays in sabqi {n} more days." }, left) : null;
    }
    const days = diffDays(today, u.nextDue);
    if (days <= 1) return t("It comes back tomorrow.");
    return i.rating === "strong"
      ? tp({ one: "Next time in {n} day.", other: "Next time in about {n} days." }, days)
      : tp({ one: "It comes back in {n} day.", other: "It comes back in {n} days." }, days);
  };
  /** Opens the portion in the Quran reader (Read, Listen, Recite); Recite can save it as done here. */
  const openItem = (i: DayItem) => {
    const from = { item: i.id, date: today };
    if (i.kind === "reading") return router.push(readHref({ kind: "surah", surah: i.surah! }, from));
    const ayahs = i.kind === "sabaq" ? (i.ayahs ?? []) : (unitByPage.get(i.page!)?.ayahs ?? []);
    if (ayahs.length) router.push(readHref({ kind: "ayahs", ayahs }, from));
  };

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const section = (kind: DayItem["kind"], label: string, blurb: string, hint: string, info?: React.ReactNode) => {
    const list = items.filter((i) => i.kind === kind);
    if (kind === "reading" && !list.length) return null;
    return (
      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">{t(label)}</h2>
          <span className="text-xs text-muted">{blurb}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {hint}
          {kind !== "reading" && (
            <>
              {" "}
              <Link href={`/guide/#${kind === "sabaq" ? "memorize" : "revise"}`} className="text-accent underline-offset-2 hover:underline">
                {t("How?")}
              </Link>
            </>
          )}
        </p>
        {info}
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {kind === "sabaq" ? t(log?.note ?? "Nothing new today.") : kind === "sabqi" ? t("Nothing recent to revise.") : t("No older pages due today.")}
          </p>
        ) : (
          <>
            {kind === "sabaq" && log?.note && <p className="mt-2 text-sm text-warn">{t(log.note)}</p>}
            <ul className="divide-y divide-border">
              {list.map((i) => {
                const d = describe(i);
                return (
                  <DayItemRow
                    key={i.id}
                    item={i}
                    title={d.title}
                    detail={d.detail}
                    note={ratingNote(i)}
                    disabled={busy}
                    rateable={i.kind !== "reading"}
                    onToggle={(done) => act(() => updateItem(today, i.id, { done }))}
                    onRate={(rating) => act(() => updateItem(today, i.id, { done: true, rating }))}
                    onOpen={() => openItem(i)}
                  />
                );
              })}
            </ul>
            {kind === "sabaq" && extra.length > 0 && (
              <button
                onClick={() => setExtraOpen(true)}
                disabled={busy}
                className="mt-1 text-sm text-accent underline-offset-2 hover:underline disabled:opacity-50"
              >
                {t("I memorized further")}
              </button>
            )}
          </>
        )}
      </Card>
    );
  };

  const checkinDue = weekSeen !== undefined && today >= addDays(weekSeen ?? plan.createdAt.slice(0, 10), 7);
  const allDone = items.length > 0 && doneCount === items.length;

  return (
    <div className="space-y-4">
      <PageTitle
        title={t("Today")}
        subtitle={
          <>
            {formatDate(today, { weekday: "long", day: "numeric", month: "long" })}
            {items.length > 0 && ` · ${t("about {n} min", { n: minutes })} · ${t("{done}/{total} done", { done: doneCount, total: items.length })}`}
          </>
        }
        action={
          <Link href="/adjust/">
            <Button variant="secondary">{t("Adjust plan")}</Button>
          </Link>
        }
      />

      {items.length > 0 && (
        <div className="-mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={t("Done today")} aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={doneCount}>
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }} />
        </div>
      )}

      <MissedDays config={config} logs={logs ?? []} units={units ?? []} today={today} />

      {(logs?.length ?? 0) >= 2 && <SignInNudge />}


      {allDone && todayGains && total && (
        <DayDone gains={todayGains} streak={streak?.current ?? 0} today={today} ayahs={total.ayahs} pages={total.fullPages} />
      )}

      {checkinDue && (
        <Notice>
          {t("Your week in review is ready: what you learned and revised.")}{" "}
          <Link href="/checkin/" className="font-medium text-accent underline underline-offset-2">
            {t("See your week")}
          </Link>
        </Notice>
      )}

      {log && items.length === 0 && (
        <Card>
          <p className="text-sm text-muted">{t(log.note ?? "Nothing is scheduled today. Rest well.")}</p>
        </Card>
      )}

      {items.length > 0 && (
        <>
          {section(
            "sabaq",
            tx("Sabaq"),
            t("New"),
            t("Memorize this, then recite it from memory before you tick it."),
          )}
          {section(
            "sabqi",
            tx("Sabqi"),
            tp({ one: "Last {n} day", other: "Last {n} days" }, config.sabqiWindowDays),
            t("Recite these recent pages from memory, then rate them. Each new page is revised here for {n} days, then moves to Manzil.", {
              n: Math.max(1, config.sabqiWindowDays - 1),
            }),
          )}
          {section(
            "manzil",
            tx("Manzil"),
            tp({ one: "{n}-day cycle", other: "{n}-day cycle" }, config.manzilCycleDays),
            t("Recite these older pages from memory, check the text, then rate them."),
            round && round.total > 0 && <ManzilProgress round={round} onOpen={() => setRoundOpen(true)} />,
          )}
          {section("reading", tx("Reading"), t("Weekly"), t("Read from the mushaf; it doesn't count as revision. Tick it when you're done."))}
        </>
      )}

      {forecast && (
        <p className="px-1 text-xs leading-relaxed text-muted">
          {forecast.done
            ? t("Everything in your target is memorized. Revision continues every day.")
            : forecast.completionDate
              ? t("At this pace you'll finish your target around {date}.", { date: formatDate(forecast.completionDate) })
              : t("With the current settings no new material is scheduled.")}
          {streak && streak.current > 0 && " " + tp({ one: "Streak: {n} day.", other: "Streak: {n} days." }, streak.current)}
        </p>
      )}

      {round && (
        <Sheet open={roundOpen} onClose={() => setRoundOpen(false)} title={tp({ one: "Manzil: the last {n} day", other: "Manzil: the last {n} days" }, round.cycleDays)}>
          <ManzilDetails round={round} today={today} todayPages={new Set(items.filter((i) => i.kind === "manzil" && !i.done).map((i) => i.page!))} labelOf={(p) => {
            const u = unitByPage.get(p);
            return u ? q.rangeLabel(u.ayahs) : "";
          }} />
        </Sheet>
      )}

      <Sheet open={extraOpen} onClose={() => setExtraOpen(false)} title={t("How far did you get?")}>
        <p className="mb-3 text-sm text-muted">
          {t(
            "Pick the last ayah you memorized today. Today's portion is ticked, the extra goes into revision like any new portion, and tomorrow continues after it. Your daily amount stays the same.",
          )}
        </p>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {extra.map((step) => (
            <li key={step.index}>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await recordExtra(today, step.index);
                    setExtraOpen(false);
                  })
                }
                className="flex w-full items-baseline justify-between px-3 py-2.5 text-start text-sm hover:bg-surface-2 disabled:opacity-50"
              >
                <span>
                  {q.surahName(q.surahOf[step.index])} {q.ayahOf[step.index]}
                </span>
                <span className="text-xs text-muted">
                  +{tp({ one: "{n} line", other: "{n} lines" }, step.lines)} · {t("page {n}", { n: q.pageOf[step.index] })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

    </div>
  );
}

function Welcome() {
  useLang();
  return (
    <div className="space-y-4 pt-6">
      <PageTitle title={t("Assalamu alaikum")} subtitle={t("Let's set up a memorization plan that fits your life.")} />
      <Card className="space-y-3">
        <p className="text-sm leading-relaxed text-muted">
          <Rich
            text={t(
              "Each study day has three parts: **sabaq** (new material), **sabqi** (what you learned in the last week) and **manzil** (a rotating slice of everything older). The plan adapts as you go. [Read the guide](/guide/)",
            )}
          />
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {AI_ENABLED && (
            <Link href="/onboarding/" className="flex-1">
              <Button variant="primary" className="w-full">
                {t("Describe your goal")}
              </Button>
            </Link>
          )}
          <Link href="/plan/?new=1" className="flex-1">
            <Button variant={AI_ENABLED ? "secondary" : "primary"} className="w-full">
              {t("Set it up by hand")}
            </Button>
          </Link>
        </div>
        <SignInNudge newUser />
        {!AI_ENABLED && (
          <p className="text-xs text-muted">
            {t("AI planning is available when you run the app on your computer. Everything else works here. You can also import a backup in Settings.")}
          </p>
        )}
      </Card>
    </div>
  );
}

/** How far the manzil round has come (on the Manzil card). */
function ManzilProgress({ round, onOpen }: { round: ManzilRound; onOpen: () => void }) {
  const done = round.revised.length;
  const pct = Math.round((done / round.total) * 100);
  return (
    <button onClick={onOpen} className="mt-3 block w-full rounded-xl bg-surface-2 p-3 text-start hover:ring-1 hover:ring-border">
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span>
          <Rich
            text={tp({ one: "Last {days} days: **{done} of {n}** page revised", other: "Last {days} days: **{done} of {n}** pages revised" }, round.total, {
              days: round.cycleDays,
              done,
            })}
          />
        </span>
        <span className="shrink-0 text-xs font-medium text-accent">{t("Details")}</span>
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
        <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className="mt-1.5 block text-xs text-muted">
        {round.coming.length
          ? tp({ one: "{n} page still to come in this round.", other: "{n} pages still to come in this round." }, round.coming.length)
          : t("Every manzil page has been revised in this time.")}
      </span>
    </button>
  );
}

function ManzilDetails({
  round,
  today,
  todayPages,
  labelOf,
}: {
  round: ManzilRound;
  today: string;
  todayPages: Set<number>;
  labelOf: (page: number) => string;
}) {
  const when = (d: string) => (d === today ? t("today") : d === addDays(today, -1) ? t("yesterday") : formatDate(d, { day: "numeric", month: "short" }));
  const row = (page: number, right: string, key: string) => (
    <li key={key} className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="font-medium">{t("Page {n}", { n: page })}</span> <span className="text-muted">· {labelOf(page)}</span>
      </span>
      <span className="shrink-0 text-xs text-muted">{right}</span>
    </li>
  );
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {t("Manzil brings every older page round at least once every {days}. A page you rate weak comes back the next day, and one you rate okay after 3 days; overdue pages come first.", {
          days: tp({ one: "{n} day", other: "{n} days" }, round.cycleDays),
        })}
      </p>
      <section>
        <h3 className="text-sm font-semibold">{t("Coming up ({n})", { n: round.coming.length })}</h3>
        {round.coming.length ? (
          <ol className="divide-y divide-border">{round.coming.map((p, k) => row(p, todayPages.has(p) ? t("today") : k === 0 ? t("next") : "", `c${p}`))}</ol>
        ) : (
          <p className="mt-1 text-sm text-muted">{t("Nothing: every page has been revised in this time.")}</p>
        )}
      </section>
      <section>
        <h3 className="text-sm font-semibold">{t("Revised ({n})", { n: round.revised.length })}</h3>
        {round.revised.length ? (
          <ol className="divide-y divide-border">{round.revised.map((r) => row(r.page, when(r.date), `r${r.page}`))}</ol>
        ) : (
          <p className="mt-1 text-sm text-muted">{t("Nothing yet.")}</p>
        )}
      </section>
    </div>
  );
}

const arabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

/** When everything today is done: what the day added, and an ayah to end on. */
function DayDone({ gains: g, streak, today, ayahs, pages }: { gains: Gains; streak: number; today: string; ayahs: number; pages: number }) {
  const [text, setText] = useState<string[] | null>(null);
  useEffect(() => {
    loadText().then(setText, () => {});
  }, []);
  const a = ayahOfDay(today);
  const meaning = t(a.meaning);
  // A round number passed today: every 100 ayahs, every 10 whole pages.
  const passed = (now: number, added: number, step: number) => (Math.floor(now / step) > Math.floor((now - added) / step) ? Math.floor(now / step) * step : 0);
  const ayahMark = passed(ayahs, g.ayahs, 100);
  const pageMark = passed(pages, g.pages, 10);
  const parts = [
    g.ayahs > 0 && tp({ one: "+{n} ayah", other: "+{n} ayahs" }, g.ayahs),
    g.pages > 0 && tp({ one: "+{n} whole page", other: "+{n} whole pages" }, g.pages),
    g.revised > 0 && tp({ one: "{n} page revised", other: "{n} pages revised" }, g.revised),
  ].filter(Boolean);
  return (
    <section className="space-y-3 rounded-2xl bg-accent-soft p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-text" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{t("Today is done. Masha'Allah!")}</p>
          {(parts.length > 0 || streak > 1) && (
            <p className="text-sm text-muted">
              {[...parts, streak > 1 && tp({ one: "{n} day in a row", other: "{n} days in a row" }, streak)].filter(Boolean).join(" · ")}
            </p>
          )}
          {g.surahs.map((n) => (
            <p key={`s${n}`} className="mt-1 text-sm font-medium text-accent">
              {t("You finished Surah {name}!", { name: q.surahName(n) })}
            </p>
          ))}
          {g.juz.map((n) => (
            <p key={`j${n}`} className="mt-1 text-sm font-medium text-accent">
              {t("You finished Juz {n}!", { n })}
            </p>
          ))}
          {pageMark > 0 && (
            <p className="mt-1 text-sm font-medium text-accent">{tp({ one: "You've reached {n} whole page!", other: "You've reached {n} whole pages!" }, pageMark)}</p>
          )}
          {ayahMark > 0 && <p className="mt-1 text-sm font-medium text-accent">{tp({ one: "You've reached {n} ayah!", other: "You've reached {n} ayahs!" }, ayahMark)}</p>}
        </div>
      </div>
      {text && (
        <figure className="border-t border-accent/20 pt-3 text-center">
          <p className="quran leading-loose" style={{ fontSize: "1.3rem" }} lang="ar" dir="rtl">
            {text[q.indexOf(a.surah, a.ayah)]} <span className="ayah-num">﴿{arabicDigits(a.ayah)}﴾</span>
          </p>
          <figcaption className="mt-1 text-xs text-muted">
            {meaning && <>{meaning} </>}({q.surahName(a.surah)} {a.ayah})
          </figcaption>
        </figure>
      )}
    </section>
  );
}
