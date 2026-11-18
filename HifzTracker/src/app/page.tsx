"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, formatDate } from "@/core/dates";
import { useDayLog, useDayLogs, useMeta, usePlan, useToday, useUnits } from "@/data/hooks";
import { ensureDayLog, extraOptions, forecastFor, q, recordExtra, updateItem } from "@/lib/app";
import { AI_ENABLED } from "@/lib/ai-client";
import type { DayItem } from "@/data/types";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { DayItemRow } from "@/components/DayItemRow";
import { AyahText, Sheet } from "@/components/AyahText";
import { MissedDays } from "@/components/MissedDays";
import { SignInNudge } from "@/components/Account";
import { activeDatesOf, streaks } from "@/core/stats";

/** Rough reading speed for weekly readings (looking at the mushaf). */
const READING_MINUTES_PER_PAGE = 2;

export default function TodayPage() {
  const today = useToday();
  const plan = usePlan();
  const log = useDayLog(today);
  const units = useUnits();
  const logs = useDayLogs();
  const lastCheckin = useMeta<string>("lastCheckin");
  const [open, setOpen] = useState<DayItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);

  useEffect(() => {
    if (plan) ensureDayLog(today);
  }, [plan, today]);

  const forecast = useMemo(() => (plan && units ? forecastFor(plan.config, units, today) : null), [plan, units, today]);
  const streak = useMemo(() => (logs ? streaks(plan?.config ?? null, activeDatesOf(logs), today) : null), [logs, plan, today]);

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
      return { title: s.nameEn, detail: `whole surah · about ${Math.max(1, Math.round(i.lines / 15))} pages` };
    }
    if (i.kind === "sabaq") return { title: q.rangeLabel(i.ayahs ?? []), detail: `${i.lines} lines · page ${q.pageOf[i.ayahs![0]]}` };
    const u = unitByPage.get(i.page!);
    return { title: u ? q.rangeLabel(u.ayahs) : `Page ${i.page}`, detail: `Page ${i.page} · ${i.lines} lines` };
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

  const section = (kind: DayItem["kind"], label: string, blurb: string, hint: string) => {
    const list = items.filter((i) => i.kind === kind);
    if (kind === "reading" && !list.length) return null;
    return (
      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">{label}</h2>
          <span className="text-xs text-muted">{blurb}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {hint}
          {kind !== "reading" && (
            <>
              {" "}
              <Link href={`/guide/#${kind === "sabaq" ? "memorize" : "revise"}`} className="text-accent underline-offset-2 hover:underline">
                How?
              </Link>
            </>
          )}
        </p>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {kind === "sabaq" ? (log?.note ?? "Nothing new today.") : kind === "sabqi" ? "Nothing recent to revise." : "No older pages due today."}
          </p>
        ) : (
          <>
            {kind === "sabaq" && log?.note && <p className="mt-2 text-sm text-warn">{log.note}</p>}
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
                I memorized further
              </button>
            )}
          </>
        )}
      </Card>
    );
  };

  const checkinDue = AI_ENABLED && plan && today >= addDays(lastCheckin ?? plan.createdAt.slice(0, 10), 7);

  return (
    <div className="space-y-4">
      <PageTitle
        title="Today"
        subtitle={
          <>
            {formatDate(today, { weekday: "long", day: "numeric", month: "long" })}
            {items.length > 0 && ` · about ${minutes} min · ${doneCount}/${items.length} done`}
          </>
        }
        action={
          <Link href="/adjust/">
            <Button variant="secondary">Adjust plan</Button>
          </Link>
        }
      />

      <MissedDays config={config} logs={logs ?? []} units={units ?? []} today={today} />

      {(logs?.length ?? 0) >= 2 && <SignInNudge />}

      {checkinDue && (
        <Notice>
          Your weekly check-in is ready.{" "}
          <Link href="/checkin/" className="font-medium text-accent underline underline-offset-2">
            Review the week
          </Link>
        </Notice>
      )}

      {log && items.length === 0 && (
        <Card>
          <p className="text-sm text-muted">{log.note ?? "Nothing is scheduled today. Rest well."}</p>
        </Card>
      )}

      {items.length > 0 && (
        <>
          {section("sabaq", "Sabaq", "New", "Memorize this, then recite it from memory before you tick it.")}
          {section("sabqi", "Sabqi", `Last ${config.sabqiWindowDays} days`, "Recite these recent pages from memory, then rate them.")}
          {section("manzil", "Manzil", `${config.manzilCycleDays}-day cycle`, "Recite these older pages from memory, check the text, then rate them.")}
          {section("reading", "Reading", "Weekly", "Read from the mushaf; it doesn't count as revision. Tick it when you're done.")}
        </>
      )}

      {forecast && (
        <p className="px-1 text-xs leading-relaxed text-muted">
          {forecast.done
            ? "Everything in your target is memorized. Revision continues every day."
            : forecast.completionDate
              ? `At this pace you'll finish your target around ${formatDate(forecast.completionDate)}.`
              : "With the current settings no new material is scheduled."}
          {streak && streak.current > 0 && ` Streak: ${streak.current} day${streak.current === 1 ? "" : "s"}.`}
        </p>
      )}

      <Sheet open={extraOpen} onClose={() => setExtraOpen(false)} title="How far did you get?">
        <p className="mb-3 text-sm text-muted">
          Pick the last ayah you memorized today. Today&apos;s portion is ticked, the extra goes into revision like any new portion, and
          tomorrow continues after it. Your daily amount stays the same.
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
                className="flex w-full items-baseline justify-between px-3 py-2.5 text-left text-sm hover:bg-surface-2 disabled:opacity-50"
              >
                <span>
                  {q.surah(q.surahOf[step.index]).nameEn} {q.ayahOf[step.index]}
                </span>
                <span className="text-xs text-muted">
                  +{step.lines} line{step.lines === 1 ? "" : "s"} · page {q.pageOf[step.index]}
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
  return (
    <div className="space-y-4 pt-6">
      <PageTitle title="Assalamu alaikum" subtitle="Let's set up a memorization plan that fits your life." />
      <Card className="space-y-3">
        <p className="text-sm leading-relaxed text-muted">
          Each study day has three parts: <b className="text-text">sabaq</b> (new material), <b className="text-text">sabqi</b> (what
          you learned in the last week) and <b className="text-text">manzil</b> (a rotating slice of everything older). The plan adapts as
          you go.{" "}
          <Link href="/guide/" className="text-accent underline-offset-2 hover:underline">
            Read the guide
          </Link>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {AI_ENABLED && (
            <Link href="/onboarding/" className="flex-1">
              <Button variant="primary" className="w-full">
                Describe your goal
              </Button>
            </Link>
          )}
          <Link href="/plan/?new=1" className="flex-1">
            <Button variant={AI_ENABLED ? "secondary" : "primary"} className="w-full">
              Set it up by hand
            </Button>
          </Link>
        </div>
        <SignInNudge newUser />
        {!AI_ENABLED && (
          <p className="text-xs text-muted">
            AI planning is available when you run the app on your computer. Everything else works here. You can also import a backup in
            Settings.
          </p>
        )}
      </Card>
    </div>
  );
}
