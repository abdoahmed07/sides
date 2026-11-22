/**
 * App services: glue between storage (Repo), the pure core and the UI.
 * Every multi-step write goes through repo.commit so it is atomic.
 */
import { nextRamadanStart, weekdayOf, type IsoDate } from "@/core/dates";
import { memorizeNew, markPrior, unmark } from "@/core/memorize";
import type { Forecast } from "@/core/plan/engine";
import {
  evaluateChange,
  forecastFor as coreForecastFor,
  memorizedArray as coreMemorizedArray,
  type Preview,
} from "@/core/plan/preview";
import { PlanConfigSchema, readingsOf, type MemorizedSelection, type PlanConfig, type PlanPatch } from "@/core/plan/schema";
import { buildSequence, continuation, selectionIndices, type ContinuationStep } from "@/core/plan/sequence";
import { getQuran } from "@/core/quran";
import { buildDay, memorizedFromUnits, unitLines } from "@/core/schedule/day";
import { applyRating, type MemUnit, type Strength } from "@/core/srs";
import { pagesLabel, totals } from "@/core/stats";
import { repo } from "@/data/dexie";
import type { DayItem, DayLog, PlanVersion } from "@/data/types";
import { t, tx } from "@/i18n";

/** A saved plan-version note in the active language (notes are stored in English). */
export function planNoteLabel(note: string): string {
  const reverted = note.match(/^Reverted to version (\d+)$/);
  if (reverted) return t("Reverted to version {n}", { n: reverted[1] });
  const edited = note.match(/^Edited suggestion: (.*)$/);
  if (edited) return t("Edited suggestion: {note}", { note: t(edited[1]) });
  return t(note);
}

export const q = getQuran();

/* ---------------- forecasting ---------------- */

export function memorizedArray(units: MemUnit[]): Uint8Array {
  return coreMemorizedArray(units, q);
}

export function forecastFor(config: PlanConfig, units: MemUnit[], today: IsoDate): Forecast {
  return coreForecastFor(config, units, q, today);
}

export type { Preview };

/**
 * Applies a patch (and optional memorized selections) in memory and computes
 * before/after numbers. Nothing is written; call acceptPreview to save.
 */
export function previewChange(opts: {
  base: PlanConfig;
  hasPlan: boolean;
  patch: PlanPatch | null;
  markMemorized?: MemorizedSelection[] | null;
  units: MemUnit[];
  today: IsoDate;
}): Preview | { ok: false; errors: string[] } {
  return evaluateChange({ ...opts, q });
}

export async function acceptPreview(p: Preview, source: PlanVersion["source"], note: string, today: IsoDate) {
  const unitsChanged = p.changed.includes("memorized");
  await repo.commit({
    plan: { config: p.config, createdAt: new Date().toISOString(), source, note },
    ...(unitsChanged ? { units: p.units } : {}),
  });
  await refreshTodayIfUntouched(today);
}

export async function savePlan(config: PlanConfig, source: PlanVersion["source"], note: string, today: IsoDate) {
  const valid = PlanConfigSchema.parse(config);
  await repo.commit({ plan: { config: valid, createdAt: new Date().toISOString(), source, note } });
  await refreshTodayIfUntouched(today);
}

export async function revertTo(version: PlanVersion, today: IsoDate) {
  await savePlan(version.config, "revert", `Reverted to version ${version.id}`, today);
}

/* ---------------- memorized material ---------------- */

export async function markMemorized(selections: MemorizedSelection[], today: IsoDate, cycleDays: number) {
  const units = await repo.getUnits();
  const idx = selections.flatMap((s) => selectionIndices(s, q));
  await repo.commit({ units: markPrior(units, idx, q, today, cycleDays) });
  await refreshTodayIfUntouched(today);
}

export async function unmarkMemorized(selections: MemorizedSelection[], today: IsoDate) {
  const units = await repo.getUnits();
  const idx = selections.flatMap((s) => selectionIndices(s, q));
  await repo.commit({ units: unmark(units, idx) });
  await refreshTodayIfUntouched(today);
}

/* ---------------- today's plan ---------------- */

function itemsFromDay(config: PlanConfig, units: MemUnit[], date: IsoDate): { items: DayItem[]; note: string | null } {
  const day = buildDay(config, q, units, date);
  const byPage = new Map(units.map((u) => [u.page, u]));
  const items: DayItem[] = [];
  if (day.sabaq)
    items.push({ id: "sabaq", kind: "sabaq", ayahs: day.sabaq.indices, lines: day.sabaq.lines, done: false, rating: null, doneAt: null });
  for (const p of day.sabqi)
    items.push({ id: `sabqi-${p}`, kind: "sabqi", page: p, lines: unitLines(byPage.get(p)!, q), done: false, rating: null, doneAt: null });
  for (const p of day.manzil)
    items.push({ id: `manzil-${p}`, kind: "manzil", page: p, lines: unitLines(byPage.get(p)!, q), done: false, rating: null, doneAt: null });
  items.push(...readingItems(config, date));
  return { items, note: day.sabaqNote };
}

/** Weekly readings for this weekday (on any day, study day or not). */
function readingItems(config: PlanConfig, date: IsoDate): DayItem[] {
  const wd = weekdayOf(date);
  return readingsOf(config)
    .filter((r) => r.day === wd)
    .map((r) => {
      const [a, b] = q.surahRange(r.surah);
      const lines = q.linesOf(Array.from({ length: b - a + 1 }, (_, k) => a + k));
      return { id: `reading-${r.surah}`, kind: "reading", surah: r.surah, lines, done: false, rating: null, doneAt: null };
    });
}

/** Keeps a started day's log in step with the plan's weekly readings (ticked ones stay). */
function syncReadings(log: DayLog, config: PlanConfig): DayLog | null {
  const wanted = readingItems(config, log.date);
  const ids = new Set(wanted.map((i) => i.id));
  const kept = log.items.filter((i) => i.kind !== "reading" || i.done || ids.has(i.id));
  const have = new Set(kept.map((i) => i.id));
  const added = wanted.filter((i) => !have.has(i.id));
  if (!added.length && kept.length === log.items.length) return null;
  return { ...log, items: [...kept, ...added] };
}

/**
 * Today's log. Created on first view and then frozen, so past days are never
 * rewritten. If the plan changes before anything is ticked, it is rebuilt.
 */
let ensureLock: Promise<unknown> = Promise.resolve();
export function ensureDayLog(date: IsoDate): Promise<DayLog | null> {
  // Serialized so concurrent renders never build the same day twice.
  const p = ensureLock.then(() => ensureDayLogInner(date));
  ensureLock = p.catch(() => undefined);
  return p;
}

async function ensureDayLogInner(date: IsoDate): Promise<DayLog | null> {
  const plan = await repo.getActivePlan();
  if (!plan) return null;
  const existing = await repo.getDayLog(date);
  if (existing && existing.planVersionId === plan.id) return existing;
  if (existing && existing.items.some((i) => i.done)) {
    // A started day stays frozen, except that weekly readings follow the plan.
    const synced = syncReadings(existing, plan.config);
    if (!synced) return existing;
    const log = { ...synced, planVersionId: plan.id };
    await repo.putDayLog(log);
    return log;
  }
  const units = await repo.getUnits();
  let config = plan.config;
  let planVersionId = plan.id;
  // "Pause until caught up" switches itself off once nothing is overdue.
  if (config.pauseNewUntilCaughtUp && buildDay(config, q, units, date).overdueLines === 0) {
    config = { ...config, pauseNewUntilCaughtUp: false };
    const r = await repo.commit({
      plan: { config, createdAt: new Date().toISOString(), source: "catchup", note: tx("Revision caught up: new memorization resumes") },
    });
    planVersionId = r.planVersionId ?? plan.id;
  }
  const { items, note } = itemsFromDay(config, units, date);
  const log: DayLog = { date, planVersionId, items, note };
  await repo.putDayLog(log);
  return log;
}

async function refreshTodayIfUntouched(today: IsoDate) {
  if (await repo.getDayLog(today)) await ensureDayLog(today);
}

/** Pages an item touches. */
function itemPages(item: DayItem): number[] {
  return item.kind === "sabaq" ? [...new Set((item.ayahs ?? []).map((i) => q.pageOf[i]))] : [item.page!];
}

/** Snapshot of the touched pages before the item was first ticked, so it can be undone. */
function snapshot(units: MemUnit[], pages: number[]): DayItem["undo"] {
  const byPage = new Map(units.map((u) => [u.page, u]));
  return pages.map((page) => ({ page, unit: byPage.get(page) ?? null }));
}

function restore(units: MemUnit[], undo: NonNullable<DayItem["undo"]>): MemUnit[] {
  const byPage = new Map(units.map((u) => [u.page, u]));
  for (const { page, unit } of undo) {
    if (unit) byPage.set(page, unit);
    else byPage.delete(page);
  }
  return [...byPage.values()].sort((a, b) => a.page - b.page);
}

/**
 * Applies an item's effect to units from its pre-tick snapshot: the sabaq's
 * ayahs become memorized; a rating updates spaced repetition.
 */
function applyItem(units: MemUnit[], item: DayItem, date: IsoDate, rating: Strength | null, cycle: number): MemUnit[] {
  let next = units;
  if (item.kind === "sabaq" && item.ayahs) next = memorizeNew(next, item.ayahs, q, date);
  if (rating) {
    const pages = itemPages(item);
    next = next.map((u) => (pages.includes(u.page) ? applyRating(u, rating, date, cycle) : u));
  } else if (item.kind !== "sabaq") {
    next = next.map((u) => (u.page === item.page ? { ...u, lastRevised: date } : u));
  }
  return next;
}

/** Tick, untick or rate an item. All effects are reversible via the stored snapshot. */
export async function updateItem(date: IsoDate, itemId: string, change: { done: boolean; rating?: Strength | null }) {
  const log = await repo.getDayLog(date);
  const plan = await repo.getActivePlan();
  if (!log || !plan) return;
  const item = log.items.find((i) => i.id === itemId);
  if (!item) return;
  if (item.kind === "sabaq" && !change.done) return untickSabaq(log, itemId);
  if (item.kind === "reading") {
    // Reading only: no memorization, no rating, no effect on revision.
    const items = log.items.map((i) =>
      i.id === itemId ? { ...i, done: change.done, rating: null, doneAt: change.done ? (i.doneAt ?? new Date().toISOString()) : null } : i,
    );
    await repo.commit({ dayLog: { ...log, items } });
    return;
  }
  const current = await repo.getUnits();
  const undo = item.undo ?? snapshot(current, itemPages(item));
  const base = item.undo ? restore(current, item.undo) : current;
  const rating = change.done ? (change.rating === undefined ? item.rating : change.rating) : null;
  const units = change.done ? applyItem(base, item, date, rating, plan.config.manzilCycleDays) : base;
  const items = log.items.map((i) =>
    i.id === itemId
      ? { ...i, done: change.done, rating, doneAt: change.done ? (i.doneAt ?? new Date().toISOString()) : null, undo: change.done ? undo : null }
      : i,
  );
  await repo.commit({ units, dayLog: { ...log, items } });
}

/* ---------------- extra memorization ---------------- */

const isExtra = (i: DayItem) => i.id.startsWith("sabaq-extra-");

/**
 * Unticking a sabaq portion also removes any extra portions recorded after it
 * (they build on it), restoring the pages newest first.
 */
async function untickSabaq(log: DayLog, itemId: string) {
  const sabaq = log.items.filter((i) => i.kind === "sabaq");
  const from = sabaq.findIndex((i) => i.id === itemId);
  const affected = sabaq.slice(from).filter((i, k) => k === 0 || isExtra(i));
  let units = await repo.getUnits();
  for (const i of [...affected].reverse()) if (i.done && i.undo) units = restore(units, i.undo);
  const drop = new Set(affected.filter(isExtra).map((i) => i.id));
  const items = log.items
    .filter((i) => !drop.has(i.id))
    .map((i) => (i.id === itemId ? { ...i, done: false, rating: null, doneAt: null, undo: null } : i));
  await repo.commit({ units, dayLog: { ...log, items } });
}

/** What comes after today's sabaq, for "I memorized further". Empty if nothing to record. */
export function extraOptions(config: PlanConfig, units: MemUnit[], log: DayLog | null | undefined): ContinuationStep[] {
  const sabaq = (log?.items ?? []).filter((i) => i.kind === "sabaq" && i.ayahs?.length);
  const last = sabaq.at(-1)?.ayahs?.at(-1);
  if (last === undefined) return [];
  const memorized = memorizedFromUnits(units, q.count);
  for (const i of sabaq) for (const a of i.ayahs!) memorized[a] = 1;
  return continuation(buildSequence(config, q), memorized, last, q);
}

/**
 * Records that the person memorized further than today's portion, up to
 * `endIndex`. Today's sabaq is ticked too, the extra ayahs become memorized
 * today (so they get sabqi revision), and tomorrow continues after them.
 * The finish date follows from the engine.
 */
export async function recordExtra(date: IsoDate, endIndex: number) {
  const plan = await repo.getActivePlan();
  let log = await repo.getDayLog(date);
  if (!plan || !log) return;
  const steps = extraOptions(plan.config, await repo.getUnits(), log);
  const upto = steps.findIndex((s) => s.index === endIndex);
  if (upto < 0) return;
  for (const i of log.items) if (i.kind === "sabaq" && !i.done) await updateItem(date, i.id, { done: true });
  log = (await repo.getDayLog(date))!;
  const ayahs = steps.slice(0, upto + 1).map((s) => s.index);
  const current = await repo.getUnits();
  const item: DayItem = {
    id: `sabaq-extra-${log.items.filter(isExtra).length + 1}`,
    kind: "sabaq",
    ayahs,
    lines: q.linesOf(ayahs),
    done: true,
    rating: null,
    doneAt: new Date().toISOString(),
    undo: snapshot(current, itemPages({ kind: "sabaq", ayahs } as DayItem)),
  };
  const units = memorizeNew(current, ayahs, q, date);
  const sabaqEnd = log.items.findLastIndex((i) => i.kind === "sabaq");
  const items = [...log.items.slice(0, sabaqEnd + 1), item, ...log.items.slice(sabaqEnd + 1)];
  await repo.commit({ units, dayLog: { ...log, items } });
}

/* ---------------- AI context (aggregates only) ---------------- */

export function memorizedSummary(units: MemUnit[]): string {
  if (!units.length) return "Nothing marked as memorized yet.";
  const t = totals(units, q);
  const memorized = memorizedArray(units);
  const fullSurahs: string[] = [];
  for (const s of q.surahs) {
    const [a, b] = q.surahRange(s.n);
    let all = true;
    for (let i = a; i <= b && all; i++) all = memorized[i] === 1;
    if (all) fullSurahs.push(`${s.n}`);
  }
  const fullJuz: number[] = [];
  for (let j = 1; j <= 30; j++) {
    const [a, b] = q.juzRange(j);
    let all = true;
    for (let i = a; i <= b && all; i++) all = memorized[i] === 1;
    if (all) fullJuz.push(j);
  }
  return (
    `${pagesLabel(t.fullPages, t.partialPages)} memorized (${t.ayahs} ayahs). ` +
    (fullJuz.length ? `Complete juz: ${fullJuz.join(", ")}. ` : "") +
    (fullSurahs.length ? `Complete surahs (numbers): ${compressRanges(fullSurahs.map(Number))}.` : "")
  ).slice(0, 600);
}

function compressRanges(ns: number[]): string {
  const out: string[] = [];
  for (let k = 0; k < ns.length; k++) {
    let j = k;
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
    out.push(j > k ? `${ns[k]}-${ns[j]}` : `${ns[k]}`);
    k = j;
  }
  return out.join(", ");
}

export function ramadanHint(today: IsoDate) {
  return nextRamadanStart(today);
}
