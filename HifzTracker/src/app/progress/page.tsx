"use client";
import { useMemo, useState } from "react";
import { addDays, diffDays, formatDate, weekdayOf, WEEKDAYS } from "@/core/dates";
import { activeDatesOf, heatmap, juzProgress, pageStatuses, streaks, surahProgress, totals, type PageStatus } from "@/core/stats";
import { useDayLogs, usePlan, useToday, useUnits } from "@/data/hooks";
import { forecastFor, q } from "@/lib/app";
import { memorizeDaysFor } from "@/core/plan/preview";
import { inWords, pageDoneDays, pagesBy } from "@/core/plan/lookahead";
import { t, tp, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Rich } from "@/components/Language";
import { Card, PageTitle } from "@/components/ui";
import { Sheet } from "@/components/AyahText";
import { ReadAndListen } from "@/components/Listen";

type MapStatus = PageStatus | "ahead";

const STATUS: Record<MapStatus, { label: string; color: string }> = {
  none: { label: tx("Not started"), color: "var(--map-none)" },
  partial: { label: tx("Partly memorized"), color: "var(--map-partial)" },
  memorized: { label: tx("Memorized"), color: "var(--map-memorized)" },
  strong: { label: tx("Strong"), color: "var(--map-strong)" },
  due: { label: tx("To revise today"), color: "var(--map-due)" },
  weak: { label: tx("Weak"), color: "var(--map-weak)" },
  ahead: { label: tx("Memorized by then"), color: "var(--map-ahead)" },
};
const NORMAL_KEYS: MapStatus[] = ["none", "partial", "memorized", "strong", "due", "weak"];
const AHEAD_KEYS: MapStatus[] = ["none", "memorized", "ahead"];

export default function ProgressPage() {
  const today = useToday();
  const plan = usePlan();
  const units = useUnits();
  const logs = useDayLogs();
  const [page, setPage] = useState<number | null>(null);
  const [showAllSurahs, setShowAllSurahs] = useState(false);
  const [ahead, setAhead] = useState(0);
  useLang();

  const data = useMemo(() => {
    if (!units || !logs) return null;
    const todayLog = logs.find((l) => l.date === today);
    const pending = todayLog
      ? new Set(todayLog.items.filter((i) => (i.kind === "sabqi" || i.kind === "manzil") && !i.done && i.page).map((i) => i.page!))
      : undefined;
    return {
      statuses: pageStatuses(units, q, today, pending),
      totals: totals(units, q),
      juz: juzProgress(units, q),
      surahs: surahProgress(units, q),
      streak: streaks(plan?.config ?? null, activeDatesOf(logs), today),
      heat: heatmap(logs),
      forecast: plan ? forecastFor(plan.config, units, today) : null,
    };
  }, [units, logs, plan, today]);

  // Look ahead, one step per day: the day each page gets finished if the plan is kept.
  const look = useMemo(() => {
    const f = data?.forecast;
    if (!plan || !units || !f || f.done || !f.completionDate) return null;
    const span = diffDays(today, f.completionDate);
    if (span <= 0) return null;
    return { span, doneDays: pageDoneDays(memorizeDaysFor(plan.config, units, q, today), q) };
  }, [plan, units, today, data]);
  if (!data) return null;

  // 0 = now; d = by the end of the day d days from today.
  const day = look ? Math.min(ahead, look.span) : 0;
  const step =
    look && day > 0
      ? {
          date: addDays(today, day),
          label: day === look.span ? t("End of plan") : inWords(day),
          end: day === look.span,
          pages: pagesBy(look.doneDays, day),
        }
      : null;
  const statuses: MapStatus[] = step
    ? data.statuses.map((s, p) => (s === "none" || s === "partial" ? (p > 0 && look!.doneDays[p] <= day ? "ahead" : "none") : "memorized"))
    : data.statuses;

  const unitByPage = new Map((units ?? []).map((u) => [u.page, u]));
  const counts = statuses.slice(1).reduce<Record<string, number>>((m, s) => ((m[s] = (m[s] ?? 0) + 1), m), {});
  const surahs = showAllSurahs ? data.surahs : data.surahs.filter((s) => s.memorized > 0);

  return (
    <div className="space-y-4">
      <PageTitle title={t("Progress")} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label={t("Pages memorized")}
          value={`${data.totals.fullPages}`}
          sub={data.totals.partialPages ? t("of 604 · +part of {n}", { n: data.totals.partialPages }) : t("of 604")}
        />
        <Tile label={t("Ayahs")} value={`${data.totals.ayahs}`} sub={t("of 6236")} />
        <Tile label={t("Streak")} value={`${data.streak.current}`} sub={t("longest {n}", { n: data.streak.longest })} />
        <Tile
          label={t("Estimated finish")}
          value={data.forecast?.done ? t("Done") : data.forecast?.completionDate ? formatDate(data.forecast.completionDate, { day: "numeric", month: "short" }) : "—"}
          sub={data.forecast?.completionDate ? data.forecast.completionDate.slice(0, 4) : t("target")}
        />
      </div>

      <Card>
        <h2 className="mb-1 font-semibold">{t("Mushaf map")}</h2>
        <p className="mb-3 text-xs text-muted">
          {t("604 pages, right to left as in the mushaf (page 1 top right). Tap a memorized page to read it.")}
          {look && " " + t("Use Look ahead below to see it fill up.")}
        </p>
        <div
          dir="rtl"
          className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[2px] sm:grid-cols-[repeat(30,minmax(0,1fr))]"
          role="img"
          aria-label={t("Map of the 604 pages of the Mushaf coloured by status")}
        >
          {statuses.slice(1).map((s, k) => (
            <button
              key={k}
              title={`${t("Page {n}", { n: k + 1 })}: ${t(STATUS[s].label)}`}
              aria-label={`${t("Page {n}", { n: k + 1 })}: ${t(STATUS[s].label)}`}
              onClick={() => unitByPage.has(k + 1) && setPage(k + 1)}
              className="aspect-[3/4] rounded-[2px]"
              style={{ background: STATUS[s].color }}
            />
          ))}
        </div>
        {look && (
          <div className="sticky bottom-24 z-10 mt-3 rounded-xl border border-border bg-surface-2 p-3 shadow-lg sm:bottom-4">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <label htmlFor="look-ahead" className="font-medium">
                {t("Look ahead")}
              </label>
              <span className={step ? "font-medium text-text" : "text-muted"}>
                {step ? `${step.label} · ${formatDate(step.date, { day: "numeric", month: "short", year: "numeric" })}` : t("Now")}
              </span>
            </div>
            <input
              id="look-ahead"
              type="range"
              min={0}
              max={look.span}
              step={1}
              value={day}
              onChange={(e) => setAhead(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--accent)]"
              aria-valuetext={step ? `${step.label}: ${tp({ one: "{n} page", other: "{n} pages" }, step.pages)}` : t("Now")}
            />
            <div className="flex justify-between text-[11px] text-muted" aria-hidden>
              <span>{t("Now")}</span>
              <span>{t("End of plan")}</span>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {step ? (
                <Rich
                  text={
                    tp(
                      { one: "**{n} page** memorized (+{more}) if you keep to your plan.", other: "**{n} pages** memorized (+{more}) if you keep to your plan." },
                      step.pages,
                      { more: step.pages - data.totals.fullPages },
                    ) + (step.end ? " " + t("That's your whole target, inshallah.") : "")
                  }
                />
              ) : (
                t("Slide to see how your mushaf fills up if you keep to your plan.")
              )}
            </p>
          </div>
        )}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {(step ? AHEAD_KEYS : NORMAL_KEYS).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ background: STATUS[s].color }} />
              {step && s === "memorized" ? t("Memorized now") : t(STATUS[s].label)} {counts[s] ? `(${counts[s]})` : ""}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">{t("Activity")}</h2>
        <Heatmap heat={data.heat} today={today} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">{t("By juz")}</h2>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {data.juz.map((j) => (
            <Bar key={j.juz} label={t("Juz {n}", { n: j.juz })} value={j.memorized} total={j.total} />
          ))}
        </ul>
      </Card>

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">{t("By surah")}</h2>
          <button className="text-xs text-muted underline underline-offset-2" onClick={() => setShowAllSurahs((v) => !v)}>
            {showAllSurahs ? t("Only started") : t("Show all 114")}
          </button>
        </div>
        {surahs.length === 0 ? (
          <p className="text-sm text-muted">{t("Nothing memorized yet.")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {surahs.map((s) => (
              <Bar key={s.surah} label={`${s.surah}. ${q.surahName(s.surah)}`} value={s.memorized} total={s.total} />
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={page !== null} onClose={() => setPage(null)} title={page ? t("Page {n}", { n: page }) : ""}>
        {page && <ReadAndListen indices={unitByPage.get(page)?.ayahs ?? []} />}
      </Sheet>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </Card>
  );
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <li className="text-sm">
      <div className="flex justify-between gap-2">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-muted">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

/** Last ~26 weeks, one column per week, rows Sun..Sat. */
function Heatmap({ heat, today }: { heat: Map<string, number>; today: string }) {
  const weeks = 26;
  const end = today;
  const offset = WEEKDAYS.indexOf(weekdayOf(end));
  const start = addDays(end, -(weeks * 7 - 1) + (6 - offset));
  const max = Math.max(1, ...heat.values());
  const cols: string[][] = [];
  for (let w = 0; w < weeks; w++) cols.push(Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const shade = (n: number) => (n === 0 ? "var(--map-none)" : `color-mix(in srgb, var(--accent) ${25 + Math.round((n / max) * 75)}%, transparent)`);
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]" role="img" aria-label={t("Calendar heatmap of completed items over the last 26 weeks")}>
        {cols.map((col, k) => (
          <div key={k} className="flex flex-col gap-[3px]">
            {col.map((d) => {
              const n = heat.get(d) ?? 0;
              return <span key={d} title={`${formatDate(d)}: ${t("{n} done", { n })}`} className="h-3 w-3 rounded-[3px]" style={{ background: d > end ? "transparent" : shade(n) }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
