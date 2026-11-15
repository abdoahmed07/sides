"use client";
import { formatDate } from "@/core/dates";
import type { KeyNumbers } from "@/core/plan/summary";

type Row = { label: string; get: (k: KeyNumbers) => string };

const fmtDate = (d: string | null) => (d ? formatDate(d) : "—");
const ROWS: Row[] = [
  { label: "New per study day", get: (k) => `${k.dailyNewLines} lines (${k.dailyNewPages} p)` },
  { label: "Study days", get: (k) => `${k.studyDaysPerWeek}/week` },
  { label: "Estimated finish", get: (k) => (k.done ? "Done" : k.completionDate ? fmtDate(k.completionDate) : "Never at this pace") },
  { label: "Time per day (now)", get: (k) => `~${k.typicalMinutes} min` },
  { label: "Time per day (at the end)", get: (k) => `~${k.peakMinutes} min` },
  { label: "Revision", get: (k) => `sabqi ${k.sabqiWindowDays}d · manzil ${k.manzilCycleDays}d` },
  { label: "Target date", get: (k) => (k.targetFinishDate ? fmtDate(k.targetFinishDate) : "—") },
];

export function PreviewTable({ before, after }: { before: KeyNumbers | null; after: KeyNumbers }) {
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
          {ROWS.map((r) => {
            const a = after ? r.get(after) : "";
            const b = before ? r.get(before) : null;
            const changed = b !== null && a !== b;
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

export function FeasibilityNote({ k }: { k: KeyNumbers }) {
  const problems: string[] = [];
  if (k.meetsTarget === false && k.targetFinishDate)
    problems.push(
      k.completionDate
        ? `this pace finishes on ${fmtDate(k.completionDate)}, after your target of ${fmtDate(k.targetFinishDate)}`
        : `this pace never reaches your target of ${fmtDate(k.targetFinishDate)}`,
    );
  if (k.withinBudget === false && k.dailyMinutesBudget)
    problems.push(`it needs about ${k.typicalMinutes} minutes a day, more than your ${k.dailyMinutesBudget}`);
  if (!problems.length) return null;
  return (
    <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm">
      <b>Not realistic as it stands:</b> {problems.join(", and ")}.
    </p>
  );
}
