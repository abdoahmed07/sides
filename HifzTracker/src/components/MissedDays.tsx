"use client";
import { useMemo, useState } from "react";
import { addDays, formatDate, type IsoDate } from "@/core/dates";
import { detectMissed, missedChoicePatch, recommendMissed, type MissedChoice } from "@/core/missed";
import type { PlanConfig } from "@/core/plan/schema";
import { activeDatesOf } from "@/core/stats";
import type { MemUnit } from "@/core/srs";
import type { DayLog } from "@/data/types";
import { useMeta } from "@/data/hooks";
import { repo } from "@/data/dexie";
import { acceptPreview, previewChange } from "@/lib/app";
import { t, tp, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Button, Card } from "./ui";

const LABELS: Record<MissedChoice, { title: string; body: string }> = {
  shift: { title: tx("Shift the plan forward"), body: tx("Carry on as normal. Missed new material isn't piled on; the finish date moves.") },
  catchup: { title: tx("Catch-up day first"), body: tx("Today: all due revision, no new material. Then back to normal.") },
  pause: { title: tx("Pause new memorization"), body: tx("Only revision until nothing is overdue, then new material resumes automatically.") },
};

export function MissedDays({ config, logs, units, today }: { config: PlanConfig; logs: DayLog[]; units: MemUnit[]; today: IsoDate }) {
  const handled = useMeta<string>("missedHandledThrough");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLang();

  const missed = useMemo(
    () => (handled === undefined ? null : detectMissed(config, activeDatesOf(logs), today, handled)),
    [config, logs, today, handled],
  );
  const options = useMemo(() => {
    if (!missed || missed.missedDays.length === 0) return null;
    return (["shift", "catchup", "pause"] as MissedChoice[]).map((choice) => {
      const preview = previewChange({ base: config, hasPlan: true, patch: missedChoicePatch(choice, today), units, today });
      return { choice, preview };
    });
  }, [missed, config, units, today]);

  if (!missed || !options) return null;
  const n = missed.missedDays.length;
  const rec = recommendMissed(n);

  const choose = async (choice: MissedChoice) => {
    setBusy(true);
    setError(null);
    try {
      const opt = options.find((o) => o.choice === choice)!;
      if (choice !== "shift") {
        if (!opt.preview.ok) throw new Error(opt.preview.errors.join("; "));
        await acceptPreview(opt.preview, "catchup", LABELS[choice].title, today);
      }
      await repo.setMeta("missedHandledThrough", addDays(today, -1));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-warn/40">
      <h2 className="font-semibold">{tp({ one: "You missed {n} study day", other: "You missed {n} study days" }, n)}</h2>
      <p className="mt-1 text-sm text-muted">{t("That's alright. Nothing has piled up. How would you like to continue?")}</p>
      <ul className="mt-3 space-y-2">
        {options.map(({ choice, preview }) => (
          <li key={choice}>
            <button
              disabled={busy}
              onClick={() => choose(choice)}
              className="w-full rounded-xl border border-border p-3 text-start transition hover:border-accent hover:bg-surface-2 disabled:opacity-50"
            >
              <span className="flex items-center justify-between gap-2 text-sm font-medium">
                {t(LABELS[choice].title)}
                {choice === rec && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">{t("Suggested")}</span>}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{t(LABELS[choice].body)}</span>
              {preview.ok && preview.after.completionDate && (
                <span className="mt-1 block text-xs">{t("Estimated finish: {date}", { date: formatDate(preview.after.completionDate) })}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-2 text-end">
        <Button variant="ghost" disabled={busy} onClick={() => repo.setMeta("missedHandledThrough", addDays(today, -1))}>
          {t("Dismiss")}
        </Button>
      </div>
    </Card>
  );
}
