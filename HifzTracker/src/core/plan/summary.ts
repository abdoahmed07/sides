/**
 * Key numbers shown in plan previews (before/after) and the only numbers the
 * AI may use when it explains a plan.
 */
import { WEEKDAY_LABEL, WEEKDAYS } from "../dates";
import type { Alternative, Forecast } from "./engine";
import type { PlanConfig } from "./schema";

export type KeyNumbers = {
  dailyNewLines: number;
  dailyNewPages: number;
  studyDays: string;
  studyDaysPerWeek: number;
  completionDate: string | null;
  daysToComplete: number | null;
  typicalMinutes: number;
  peakMinutes: number;
  remainingLines: number;
  remainingPages: number;
  sabqiWindowDays: number;
  manzilCycleDays: number;
  targetFinishDate: string | null;
  meetsTarget: boolean | null;
  dailyMinutesBudget: number | null;
  withinBudget: boolean | null;
  feasible: boolean;
  done: boolean;
  /** With a target date: the smallest daily amount (lines) that still finishes by it; null if none works. */
  linesToFinishByTarget?: number | null;
  /** Pages already memorized (anywhere, not only in the target). */
  memorizedPages?: number;
  /** Pages started but not finished (shown next to memorizedPages). */
  memorizedPartPages?: number;
};

export function keyNumbers(config: PlanConfig, f: Forecast): KeyNumbers {
  return {
    dailyNewLines: config.dailyNewLines,
    dailyNewPages: Math.round((config.dailyNewLines / 15) * 100) / 100,
    studyDays: WEEKDAYS.filter((d) => config.studyWeekdays.includes(d)).map((d) => WEEKDAY_LABEL[d]).join(", "),
    studyDaysPerWeek: f.studyDaysPerWeek,
    completionDate: f.completionDate,
    daysToComplete: f.daysToComplete,
    typicalMinutes: f.typicalMinutes,
    peakMinutes: f.peakMinutes,
    remainingLines: f.remainingLines,
    remainingPages: Math.round((f.remainingLines / 15) * 10) / 10,
    sabqiWindowDays: config.sabqiWindowDays,
    manzilCycleDays: config.manzilCycleDays,
    targetFinishDate: config.targetFinishDate,
    meetsTarget: f.meetsTarget,
    dailyMinutesBudget: config.dailyMinutesBudget,
    withinBudget: f.withinBudget,
    feasible: f.feasible,
    done: f.done,
  };
}

export type PlanFacts = {
  before: KeyNumbers | null;
  after: KeyNumbers;
  alternatives: { id: string; label: string; numbers: KeyNumbers }[];
};

export function alternativeFacts(config: PlanConfig, alts: Alternative[]) {
  return alts.map((a) => ({
    id: a.id,
    label: a.label,
    numbers: keyNumbers({ ...config, ...flattenSet(config, a) }, a.forecast),
  }));
}

function flattenSet(config: PlanConfig, a: Alternative): Partial<PlanConfig> {
  const s = a.patch.set ?? {};
  return {
    ...(s.dailyNewLines ? { dailyNewLines: s.dailyNewLines } : {}),
    ...(s.studyWeekdays ? { studyWeekdays: s.studyWeekdays } : {}),
    ...(s.targetFinishDate && s.targetFinishDate !== "none" ? { targetFinishDate: s.targetFinishDate } : {}),
  };
}

/** Every number (and date part) that appears in the facts: the AI may only use these. */
export function allowedNumbers(facts: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "number") {
      out.add(String(v));
      out.add(String(Math.round(v)));
    } else if (typeof v === "string") {
      for (const m of v.match(/\d+(\.\d+)?/g) ?? []) {
        out.add(m);
        out.add(String(Number(m)));
      }
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(facts);
  return out;
}
