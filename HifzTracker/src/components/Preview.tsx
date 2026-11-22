"use client";
import { formatDate } from "@/core/dates";
import type { KeyNumbers } from "@/core/plan/summary";
import { pagesLabel } from "@/core/stats";
import { t, tp, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Rich } from "./Language";

type Row = { label: string; get: (k: KeyNumbers) => string };

const fmtDate = (d: string | null) => (d ? formatDate(d) : "—");
const pagesApprox = (n: number) => tp({ one: "~{n} page", other: "~{n} pages" }, n);
const minutes = (n: number) => t("~{n} min", { n });

const ROWS: Row[] = [
  {
    label: tx("Already memorized"),
    get: (k) =>
      k.memorizedPages === undefined ? "—" : k.memorizedPages === 0 && !k.memorizedPartPages ? t("Nothing yet") : pagesLabel(k.memorizedPages, k.memorizedPartPages),
  },
  {
    label: tx("Left to memorize"),
    get: (k) => (k.done ? t("Nothing") : k.pagesLeft !== undefined ? tp({ one: "{n} page", other: "{n} pages" }, k.pagesLeft) : pagesApprox(k.remainingPages)),
  },
  { label: tx("New per study day"), get: (k) => t("{lines} lines ({pages} p)", { lines: k.dailyNewLines, pages: k.dailyNewPages }) },
  { label: tx("Study days"), get: (k) => t("{n}/week", { n: k.studyDaysPerWeek }) },
  { label: tx("Estimated finish"), get: (k) => (k.done ? t("Done") : k.completionDate ? fmtDate(k.completionDate) : t("Never at this pace")) },
  { label: tx("Time per day (now)"), get: (k) => minutes(k.typicalMinutes) },
  { label: tx("Time per day (at the end)"), get: (k) => minutes(k.peakMinutes) },
  { label: tx("Revision"), get: (k) => t("sabqi {s}d · manzil {m}d", { s: k.sabqiWindowDays, m: k.manzilCycleDays }) },
  { label: tx("Target date"), get: (k) => (k.targetFinishDate ? fmtDate(k.targetFinishDate) : "—") },
  {
    label: tx("Lines/day to finish by target"),
    get: (k) => (!k.targetFinishDate || k.done ? "—" : k.linesToFinishByTarget ? `${k.linesToFinishByTarget}` : t("not possible")),
  },
];

/**
 * Before/after numbers. With a "before", only the rows that change are shown;
 * if none change, a one-line summary says the schedule stays the same.
 */
export function PreviewTable({ before, after }: { before: KeyNumbers | null; after: KeyNumbers }) {
  useLang();
  // With a "before", only what changes; for a new plan, everything that has a value.
  const rows = before ? ROWS.filter((r) => r.get(before) !== r.get(after)) : ROWS.filter((r) => r.get(after) !== "—");
  if (before && rows.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
        {after.done || !after.completionDate
          ? t("Your schedule stays the same.")
          : t("Your schedule stays the same: finishing around {date}, about {n} min a day.", { date: fmtDate(after.completionDate), n: after.typicalMinutes })}
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-xs text-muted">
          <tr>
            <th className="px-3 py-2 text-start font-medium"> </th>
            {before && <th className="px-3 py-2 text-start font-medium">{t("Now")}</th>}
            <th className="px-3 py-2 text-start font-medium">{before ? t("After") : t("Plan")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const a = after ? r.get(after) : "";
            const b = before ? r.get(before) : null;
            const changed = b !== null;
            return (
              <tr key={r.label} className="border-t border-border">
                <td className="px-3 py-2 text-muted">{t(r.label)}</td>
                {before && <td className="px-3 py-2">{b}</td>}
                <td className={`px-3 py-2 ${changed ? "font-semibold text-accent" : ""}`}>{a}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A missed target date is a real problem. Taking longer than the time budget
 * is only a heads-up: the person's chosen daily amount stays as it is.
 */
export function FeasibilityNote({ k }: { k: KeyNumbers }) {
  useLang();
  const missed =
    k.meetsTarget === false && k.targetFinishDate
      ? k.completionDate
        ? t("**Not realistic as it stands:** this pace finishes on {date}, after your target of {target}.", {
            date: fmtDate(k.completionDate),
            target: fmtDate(k.targetFinishDate),
          })
        : t("**Not realistic as it stands:** this pace never reaches your target of {target}.", { target: fmtDate(k.targetFinishDate) })
      : null;
  const overTime =
    k.withinBudget === false && k.dailyMinutesBudget
      ? t("This takes about {now} minutes a day (about {end} near the end), more than the {budget} you set.", {
          now: k.typicalMinutes,
          end: k.peakMinutes,
          budget: k.dailyMinutesBudget,
        })
      : null;
  if (!missed && !overTime) return null;
  return (
    <div className="space-y-2">
      {missed && (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm">
          <Rich text={missed} />
        </p>
      )}
      {overTime && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{overTime}</p>}
    </div>
  );
}
