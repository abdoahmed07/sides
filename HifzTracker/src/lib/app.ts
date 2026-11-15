/**
 * App services: glue between storage (Repo), the pure core and the UI.
 * Every multi-step write goes through repo.commit so it is atomic.
 */
import { addDays, nextRamadanStart, type IsoDate } from "@/core/dates";
import { memorizeNew, markPrior, unmark } from "@/core/memorize";
import { alternatives, forecast, type Forecast } from "@/core/plan/engine";
import { applyPatch } from "@/core/plan/patch";
import { PlanConfigSchema, type MemorizedSelection, type PlanConfig, type PlanPatch } from "@/core/plan/schema";
import { selectionIndices } from "@/core/plan/sequence";
import { alternativeFacts, keyNumbers, type KeyNumbers } from "@/core/plan/summary";
import { getQuran } from "@/core/quran";
import { buildDay, recentAdds, unitLines } from "@/core/schedule/day";
import { estimatePauseDays } from "@/core/missed";
import { applyRating, type MemUnit, type Strength } from "@/core/srs";
import { totals } from "@/core/stats";
import { repo } from "@/data/dexie";
import type { DayItem, DayLog, PlanVersion } from "@/data/types";

export const q = getQuran();

/* ---------------- forecasting ---------------- */

export function memorizedArray(units: MemUnit[]): Uint8Array {
  const m = new Uint8Array(q.count);
  for (const u of units) for (const i of u.ayahs) m[i] = 1;
  return m;
}

export function forecastFor(config: PlanConfig, units: MemUnit[], today: IsoDate): Forecast {
  let pausedUntil: IsoDate | null = null;
  if (config.pauseNewUntilCaughtUp) {
    const day = buildDay(config, q, units, today);
    const days = estimatePauseDays(day.overdueLines, day.manzilQuotaLines);
    if (days > 0) pausedUntil = addDays(today, days);
  }
  return forecast({
    config,
    q,
    memorized: memorizedArray(units),
    today,
    recentAdds: recentAdds(units, q, today, config.sabqiWindowDays),
    pausedUntil,
  });
}

export type Preview = {
  ok: true;
  before: KeyNumbers | null;
  after: KeyNumbers;
  config: PlanConfig;
  units: MemUnit[];
  changed: string[];
  alternatives: { id: string; label: string; patch: PlanPatch; numbers: KeyNumbers }[];
};

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
  const { base, today } = opts;
  let config = base;
  let changed: string[] = [];
  if (opts.patch) {
    const r = applyPatch(base, opts.patch, today);
    if (!r.ok) return r;
    config = r.config;
    changed = r.changed;
  }
  let units = opts.units;
  if (opts.markMemorized?.length) {
    const idx = opts.markMemorized.flatMap((s) => selectionIndices(s, q));
    units = markPrior(units, idx, q, today, config.manzilCycleDays);
    changed.push("memorized");
  }
  const before = opts.hasPlan ? keyNumbers(base, forecastFor(base, opts.units, today)) : null;
  const f = forecastFor(config, units, today);
  const after = keyNumbers(config, f);
  const rawAlts = f.feasible ? [] : alternatives({ config, q, memorized: memorizedArray(units), today });
  const alts = alternativeFacts(config, rawAlts).map((a, k) => ({ ...a, patch: rawAlts[k].patch }));
  return { ok: true, before, after, config, units, changed, alternatives: alts };
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
  return { items, note: day.sabaqNote };
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
  if (existing && (existing.planVersionId === plan.id || existing.items.some((i) => i.done))) return existing;
  const units = await repo.getUnits();
  let config = plan.config;
  let planVersionId = plan.id;
  // "Pause until caught up" switches itself off once nothing is overdue.
  if (config.pauseNewUntilCaughtUp && buildDay(config, q, units, date).overdueLines === 0) {
    config = { ...config, pauseNewUntilCaughtUp: false };
    const r = await repo.commit({
      plan: { config, createdAt: new Date().toISOString(), source: "catchup", note: "Revision caught up: new memorization resumes" },
    });
    planVersionId = r.planVersionId ?? plan.id;
  }
  const { items, note } = itemsFromDay(config, units, date);
  const log: DayLog = { date, planVersionId, items, note };
  await repo.putDayLog(log);
  return log;
}

async function refreshTodayIfUntouched(today: IsoDate) {
  const log = await repo.getDayLog(today);
  if (log && !log.items.some((i) => i.done)) await ensureDayLog(today);
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
    `About ${t.pagesEquivalent} pages memorized (${t.ayahs} ayahs). ` +
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
