"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, formatDate } from "@/core/dates";
import { useDayLog, useDayLogs, useMeta, usePlan, useToday, useUnits } from "@/data/hooks";
import { ensureDayLog, forecastFor, q, updateItem } from "@/lib/app";
import { AI_ENABLED } from "@/lib/ai-client";
import type { DayItem } from "@/data/types";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { DayItemRow } from "@/components/DayItemRow";
import { AyahText, Sheet } from "@/components/AyahText";
import { MissedDays } from "@/components/MissedDays";
import { activeDatesOf, streaks } from "@/core/stats";

export default function TodayPage() {
  const today = useToday();
  const plan = usePlan();
  const log = useDayLog(today);
  const units = useUnits();
  const logs = useDayLogs();
  const lastCheckin = useMeta<string>("lastCheckin");
  const [open, setOpen] = useState<DayItem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (plan) ensureDayLog(today);
  }, [plan, today]);

  const forecast = useMemo(() => (plan && units ? forecastFor(plan.config, units, today) : null), [plan, units, today]);
  const streak = useMemo(() => (logs ? streaks(plan?.config ?? null, activeDatesOf(logs), today) : null), [logs, plan, today]);

  if (plan === undefined) return null;
  if (plan === null) return <Welcome />;

  const config = plan.config;
  const items = log?.items ?? [];
  const minutes = Math.round(
    items.reduce(
      (s, i) => s + (i.kind === "sabaq" ? i.lines * config.pace.minutesPerNewLine : (i.lines / 15) * config.pace.minutesPerRevisionPage),
      0,
    ),
  );
  const doneCount = items.filter((i) => i.done).length;
  const unitByPage = new Map((units ?? []).map((u) => [u.page, u]));

  const describe = (i: DayItem) => {
    if (i.kind === "sabaq") return { title: q.rangeLabel(i.ayahs ?? []), detail: `${i.lines} lines · page ${q.pageOf[i.ayahs![0]]}` };
    const u = unitByPage.get(i.page!);
    return { title: u ? q.rangeLabel(u.ayahs) : `Page ${i.page}`, detail: `Page ${i.page} · ${i.lines} lines` };
  };
  const textOf = (i: DayItem) => (i.kind === "sabaq" ? (i.ayahs ?? []) : (unitByPage.get(i.page!)?.ayahs ?? []));

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const section = (kind: DayItem["kind"], label: string, blurb: string) => {
    const list = items.filter((i) => i.kind === kind);
    return (
      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">{label}</h2>
          <span className="text-xs text-muted">{blurb}</span>
        </div>
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
                    onToggle={(done) => act(() => updateItem(today, i.id, { done }))}
                    onRate={(rating) => act(() => updateItem(today, i.id, { done: true, rating }))}
                    onOpen={() => setOpen(i)}
                  />
                );
              })}
            </ul>
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
          {section("sabaq", "Sabaq", "New")}
          {section("sabqi", "Sabqi", `Last ${config.sabqiWindowDays} days`)}
          {section("manzil", "Manzil", `${config.manzilCycleDays}-day cycle`)}
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
          you go.
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
