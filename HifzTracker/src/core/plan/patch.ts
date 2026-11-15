/**
 * Applying a PlanPatch to a PlanConfig. Pure: returns a new config or a list
 * of errors; never a half-applied result. Patches only affect the future:
 * exceptions that end before `today` are rejected and ones that started in
 * the past are clipped to today.
 */
import type { IsoDate } from "../dates";
import {
  PlanConfigSchema,
  PlanPatchSchema,
  PACE_BY_EXPERIENCE,
  type PlanConfig,
  type PlanPatch,
  type DateException,
} from "./schema";

export type PatchResult = { ok: true; config: PlanConfig; changed: string[] } | { ok: false; errors: string[] };

export function applyPatch(
  config: PlanConfig,
  rawPatch: unknown,
  today: IsoDate,
  newId: () => string = defaultId,
): PatchResult {
  const parsed = PlanPatchSchema.safeParse(rawPatch);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map(formatIssue) };
  const patch: PlanPatch = parsed.data;
  const next: PlanConfig = structuredClone(config);
  const changed: string[] = [];
  const errors: string[] = [];

  const s = patch.set ?? {};
  if (s.target) {
    next.target = s.target;
    changed.push("target");
  }
  if (s.start) {
    next.start = s.start;
    changed.push("start");
  }
  if (s.direction) {
    next.direction = s.direction;
    changed.push("direction");
  }
  if (s.dailyNewLines !== undefined) {
    next.dailyNewLines = s.dailyNewLines;
    changed.push("dailyNewLines");
  }
  if (s.studyWeekdays) {
    next.studyWeekdays = [...new Set(s.studyWeekdays)];
    changed.push("studyWeekdays");
  }
  if (s.sabqiWindowDays !== undefined) {
    next.sabqiWindowDays = s.sabqiWindowDays;
    changed.push("sabqiWindowDays");
  }
  if (s.manzilCycleDays !== undefined) {
    next.manzilCycleDays = s.manzilCycleDays;
    changed.push("manzilCycleDays");
  }
  if (s.targetFinishDate !== undefined) {
    if (s.targetFinishDate === "none") next.targetFinishDate = null;
    else if (s.targetFinishDate <= today) errors.push("Target finish date must be in the future");
    else next.targetFinishDate = s.targetFinishDate;
    changed.push("targetFinishDate");
  }
  if (s.dailyMinutesBudget !== undefined) {
    next.dailyMinutesBudget = s.dailyMinutesBudget === 0 ? null : Math.max(5, s.dailyMinutesBudget);
    changed.push("dailyMinutesBudget");
  }
  if (s.experience) {
    next.experience = s.experience;
    next.pace = { ...PACE_BY_EXPERIENCE[s.experience] };
    changed.push("experience");
  }
  if (s.minutesPerNewLine !== undefined) {
    next.pace.minutesPerNewLine = s.minutesPerNewLine;
    changed.push("pace");
  }
  if (s.minutesPerRevisionPage !== undefined) {
    next.pace.minutesPerRevisionPage = s.minutesPerRevisionPage;
    changed.push("pace");
  }
  if (s.pauseNewUntilCaughtUp !== undefined) {
    next.pauseNewUntilCaughtUp = s.pauseNewUntilCaughtUp;
    changed.push("pauseNewUntilCaughtUp");
  }

  for (const o of patch.weekdayOverrides ?? []) {
    if (o.remove) delete next.weekdayOverrides[o.day];
    else
      next.weekdayOverrides[o.day] = {
        newMultiplier: o.newMultiplier ?? next.weekdayOverrides[o.day]?.newMultiplier ?? 1,
        ...(o.revisionOnly !== undefined ? { revisionOnly: o.revisionOnly } : {}),
      };
    changed.push("weekdayOverrides");
  }

  if (patch.removeExceptionIds?.length) {
    const remove = new Set(patch.removeExceptionIds);
    // Past exceptions are history: they stay so past days keep their meaning.
    next.exceptions = next.exceptions.filter((e) => !remove.has(e.id) || e.to < today);
    changed.push("exceptions");
  }
  for (const e of patch.addExceptions ?? []) {
    if (e.to < today) {
      errors.push(`Exception ${e.from}–${e.to} is entirely in the past`);
      continue;
    }
    const ex: DateException = { ...e, id: newId(), from: e.from < today ? today : e.from };
    next.exceptions.push(ex);
    changed.push("exceptions");
  }

  if (errors.length) return { ok: false, errors };
  const valid = PlanConfigSchema.safeParse(next);
  if (!valid.success) return { ok: false, errors: valid.error.issues.map(formatIssue) };
  return { ok: true, config: valid.data, changed: [...new Set(changed)] };
}

function formatIssue(i: { path: PropertyKey[]; message: string }): string {
  return i.path.length ? `${i.path.map(String).join(".")}: ${i.message}` : i.message;
}

let counter = 0;
function defaultId(): string {
  counter = (counter + 1) % 1000;
  return `ex-${Date.now().toString(36)}-${counter}`;
}

/** Convenience: a one-day catch-up exception for `date`. */
export function catchUpPatch(date: IsoDate): PlanPatch {
  return { addExceptions: [{ from: date, to: date, kind: "catchup", note: "Catch-up day" }] };
}
