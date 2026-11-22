"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, formatDate } from "@/core/dates";
import { useDayLog, useDayLogs, useMeta, usePlan, useToday, useUnits } from "@/data/hooks";
import { ensureDayLog, extraOptions, forecastFor, q, recordExtra, updateItem } from "@/lib/app";
import { AI_ENABLED, AI_NEEDS_SIGN_IN } from "@/lib/ai-client";
import type { DayItem } from "@/data/types";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { DayItemRow } from "@/components/DayItemRow";
import { AyahText, Sheet } from "@/components/AyahText";
import { MissedDays } from "@/components/MissedDays";
import { SignInNudge, useSyncStatus } from "@/components/Account";
import { activeDatesOf, streaks } from "@/core/stats";
import { t, tp, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Rich } from "@/components/Language";
import { manzilRound, sabqiDay, type ManzilRound } from "@/core/schedule/revision-info";

/** Rough reading speed for weekly readings (looking at the mushaf). */
const READING_MINUTES_PER_PAGE = 2;

export default function TodayPage() {
  const today = useToday();
  const plan = usePlan();
  const sync = useSyncStatus();
  const log = useDayLog(today);
  const units = useUnits();
  const logs = useDayLogs();
  const lastCheckin = useMeta<string>("lastCheckin");
  const [open, setOpen] = useState<DayItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [roundOpen, setRoundOpen] = useState(false);
  useLang();

  useEffect(() => {
    if (plan) ensureDayLog(today);
  }, [plan, today]);

  const forecast = useMemo(() => (plan && units ? forecastFor(plan.config, units, today) : null), [plan, units, today]);
  const streak = useMemo(() => (logs ? streaks(plan?.config ?? null, activeDatesOf(logs), today) : null), [logs, plan, today]);

  const round = useMemo(() => (plan && units ? manzilRound(plan.config, units, q, today) : null), [plan, units, today]);
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
      detail += " · " + (d.day >= d.of ? t("last day in sabqi") : t("day {day} of {of}", { day: d.day, of: d.of }));
    }
    return { title: u ? q.rangeLabel(u.ayahs) : t("Page {n}", { n: i.page! }), detail };
  };
  const textOf = (i: DayItem) => {
    if (i.kind === "reading") {
      const [a, b] = q.surahRange(i.surah!);
      return Array.from({ length: b - a + 1 }, (_, k) => a + k);
    }
    return i.kind === "sabaq" ? (i.ayahs ?? []) : (unitByPage.get(i.page!)?.ayahs ?? []);
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
                    disabled={busy}
                    rateable={i.kind !== "reading"}
                    onToggle={(done) => act(() => updateItem(today, i.id, { done }))}
                    onRate={(rating) => act(() => updateItem(today, i.id, { done: true, rating }))}
                    onOpen={() => setOpen(i)}
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

  const checkinDue = AI_ENABLED && (!AI_NEEDS_SIGN_IN || sync.email !== null) && plan && today >= addDays(lastCheckin ?? plan.createdAt.slice(0, 10), 7);

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

      <MissedDays config={config} logs={logs ?? []} units={units ?? []} today={today} />

      {(logs?.length ?? 0) >= 2 && <SignInNudge />}

      {checkinDue && (
        <Notice>
          {t("Your weekly check-in is ready.")}{" "}
          <Link href="/checkin/" className="font-medium text-accent underline underline-offset-2">
            {t("Review the week")}
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

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? describe(open).title : ""}>
        {open && <AyahText indices={textOf(open)} />}
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
          ? t("{n} still to come, about {pace} a day.", {
              n: round.coming.length,
              pace: round.pagesPerDay === 0.5 ? t("half a page") : tp({ one: "{n} page", other: "{n} pages" }, round.pagesPerDay),
            })
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
        {t("Manzil brings every older page round about once every {days}, a few pages a day. Weak and overdue pages come first.", {
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
