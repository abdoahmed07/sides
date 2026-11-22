"use client";
import { formatDate } from "@/core/dates";
import type { KeyNumbers } from "@/core/plan/summary";
import { pagesLabel } from "@/core/stats";

type Row = { label: string; get: (k: KeyNumbers) => string };

const fmtDate = (d: string | null) => (d ? formatDate(d) : "—");
const pages = (n: number) => `~${n} page${n === 1 ? "" : "s"}`;
const ROWS: Row[] = [
  {
    label: "Already memorized",
    get: (k) =>
      k.memorizedPages === undefined ? "—" : k.memorizedPages === 0 && !k.memorizedPartPages ? "Nothing yet" : pagesLabel(k.memorizedPages, k.memorizedPartPages),
  },
  { label: "Left to memorize", get: (k) => (k.done ? "Nothing" : pages(k.remainingPages)) },
  { label: "New per study day", get: (k) => `${k.dailyNewLines} lines (${k.dailyNewPages} p)` },
  { label: "Study days", get: (k) => `${k.studyDaysPerWeek}/week` },
  { label: "Estimated finish", get: (k) => (k.done ? "Done" : k.completionDate ? fmtDate(k.completionDate) : "Never at this pace") },
  { label: "Time per day (now)", get: (k) => `~${k.typicalMinutes} min` },
  { label: "Time per day (at the end)", get: (k) => `~${k.peakMinutes} min` },
  { label: "Revision", get: (k) => `sabqi ${k.sabqiWindowDays}d · manzil ${k.manzilCycleDays}d` },
  { label: "Target date", get: (k) => (k.targetFinishDate ? fmtDate(k.targetFinishDate) : "—") },
  {
    label: "Lines/day to finish by target",
    get: (k) => (!k.targetFinishDate || k.done ? "—" : k.linesToFinishByTarget ? `${k.linesToFinishByTarget}` : "not possible"),
  },
];

/**
 * Before/after numbers. With a "before", only the rows that change are shown;
 * if none change, a one-line summary says the schedule stays the same.
 */
export function PreviewTable({ before, after }: { before: KeyNumbers | null; after: KeyNumbers }) {
  // With a "before", only what changes; for a new plan, everything that has a value.
  const rows = before ? ROWS.filter((r) => r.get(before) !== r.get(after)) : ROWS.filter((r) => r.get(after) !== "—");
  if (before && rows.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
        Your schedule stays the same
        {after.done ? "." : after.completionDate ? `: finishing around ${fmtDate(after.completionDate)}, about ${after.typicalMinutes} min a day.` : "."}
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-xs text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium"> </th>
            {before && <th className="px-3 py-2 text-left font-medium">Now</th>}
            <th className="px-3 py-2 text-left font-medium">{before ? "After" : "Plan"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const a = after ? r.get(after) : "";
            const b = before ? r.get(before) : null;
            const changed = b !== null;
            return (
              <tr key={r.label} className="border-t border-border">
                <td className="px-3 py-2 text-muted">{r.label}</td>
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
  const missed =
    k.meetsTarget === false && k.targetFinishDate
      ? k.completionDate
        ? `this pace finishes on ${fmtDate(k.completionDate)}, after your target of ${fmtDate(k.targetFinishDate)}`
        : `this pace never reaches your target of ${fmtDate(k.targetFinishDate)}`
      : null;
  const overTime =
    k.withinBudget === false && k.dailyMinutesBudget
      ? `This takes about ${k.typicalMinutes} minutes a day (about ${k.peakMinutes} near the end), more than the ${k.dailyMinutesBudget} you set.`
      : null;
  if (!missed && !overTime) return null;
  return (
    <div className="space-y-2">
      {missed && (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm">
          <b>Not realistic as it stands:</b> {missed}.
        </p>
      )}
      {overTime && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{overTime}</p>}
    </div>
  );
}
