"use client";
import { useMemo, useState } from "react";
import { WEEKDAY_LABEL, WEEKDAYS, formatDate, type IsoDate, type Weekday } from "@/core/dates";
import {
  EXCEPTION_DEFAULTS,
  EXCEPTION_KINDS,
  PACE_BY_EXPERIENCE,
  PlanConfigSchema,
  type PlanConfig,
  type Target,
} from "@/core/plan/schema";
import { buildSequence } from "@/core/plan/sequence";
import { keyNumbers } from "@/core/plan/summary";
import type { MemUnit } from "@/core/srs";
import { forecastFor, q } from "@/lib/app";
import { Button, Card, Field, inputCls } from "./ui";
import { FeasibilityNote, PreviewTable } from "./Preview";

export function parseNumberList(text: string, min: number, max: number): number[] {
  const out = new Set<number>();
  for (const part of text.split(/[,\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) if (n >= min && n <= max) out.add(n);
  }
  return [...out].sort((x, y) => x - y);
}

export function formatNumberList(ns: number[]): string {
  const out: string[] = [];
  for (let k = 0; k < ns.length; k++) {
    let j = k;
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
    out.push(j > k ? `${ns[k]}-${ns[j]}` : `${ns[k]}`);
    k = j;
  }
  return out.join(", ");
}

const OVERRIDE_OPTIONS = [
  { value: "1", label: "Normal" },
  { value: "0.5", label: "Lighter (½ new)" },
  { value: "rev", label: "Revision only" },
];

export function PlanForm({
  initial,
  current,
  units,
  today,
  saveLabel,
  onSave,
}: {
  initial: PlanConfig;
  current: PlanConfig | null;
  units: MemUnit[];
  today: IsoDate;
  saveLabel: string;
  onSave: (c: PlanConfig) => Promise<void>;
}) {
  const [c, setC] = useState<PlanConfig>(initial);
  const [listText, setListText] = useState(() => targetText(initial.target));
  const [saving, setSaving] = useState(false);
  const [newEx, setNewEx] = useState({ from: today, to: today, kind: "travel" as (typeof EXCEPTION_KINDS)[number], note: "" });
  const set = <K extends keyof PlanConfig>(k: K, v: PlanConfig[K]) => setC((p) => ({ ...p, [k]: v }));

  const validation = PlanConfigSchema.safeParse(c);
  const numbers = useMemo(() => {
    if (!validation.success) return null;
    return {
      before: current ? keyNumbers(current, forecastFor(current, units, today)) : null,
      after: keyNumbers(c, forecastFor(c, units, today)),
    };
  }, [c, current, units, today, validation.success]);

  const setTargetType = (type: Target["type"]) => {
    const t: Target =
      type === "quran" ? { type } : type === "juz" ? { type, juz: [30] } : type === "surah" ? { type, surahs: [67] } : { type, from: 1, to: 20 };
    setC((p) => ({ ...p, target: t, start: firstOf(t, p.direction) }));
    setListText(targetText(t));
  };
  const onListChange = (text: string) => {
    setListText(text);
    if (c.target.type === "juz") {
      const juz = parseNumberList(text, 1, 30);
      if (juz.length) setC((p) => ({ ...p, target: { type: "juz", juz }, start: firstOf({ type: "juz", juz }, p.direction) }));
    } else if (c.target.type === "surah") {
      const surahs = parseNumberList(text, 1, 114);
      if (surahs.length) setC((p) => ({ ...p, target: { type: "surah", surahs }, start: firstOf({ type: "surah", surahs }, p.direction) }));
    }
  };
  const firstOf = (t: Target, direction: PlanConfig["direction"]) => {
    const seq = buildSequence({ target: t, direction, start: { surah: direction === "backward" ? 114 : 1, ayah: 1 } }, q);
    const i = seq[0] ?? 0;
    return { surah: q.surahOf[i], ayah: q.ayahOf[i] };
  };

  const toggleDay = (d: Weekday) =>
    set("studyWeekdays", c.studyWeekdays.includes(d) ? c.studyWeekdays.filter((x) => x !== d) : [...c.studyWeekdays, d]);

  const setOverride = (d: Weekday, v: string) => {
    const next = { ...c.weekdayOverrides };
    if (v === "1") delete next[d];
    else if (v === "rev") next[d] = { newMultiplier: 0, revisionOnly: true };
    else next[d] = { newMultiplier: Number(v) };
    set("weekdayOverrides", next);
  };

  const addException = () => {
    if (newEx.to < newEx.from || newEx.to < today) return;
    set("exceptions", [
      ...c.exceptions,
      { id: `ex-${Date.now().toString(36)}`, from: newEx.from < today ? today : newEx.from, to: newEx.to, kind: newEx.kind, ...(newEx.note ? { note: newEx.note } : {}) },
    ]);
  };

  const surahAyahs = q.surah(c.start.surah)?.ayahs ?? 1;

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <h2 className="font-semibold">What to memorize</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Target">
            <select className={inputCls} value={c.target.type} onChange={(e) => setTargetType(e.target.value as Target["type"])}>
              <option value="quran">Whole Quran</option>
              <option value="juz">Juz</option>
              <option value="surah">Surahs</option>
              <option value="pages">Page range</option>
            </select>
          </Field>
          {c.target.type === "juz" || c.target.type === "surah" ? (
            <Field label={c.target.type === "juz" ? "Juz numbers" : "Surah numbers"} hint="e.g. 30 or 26-30 or 67, 78-114">
              <input className={inputCls} value={listText} onChange={(e) => onListChange(e.target.value)} inputMode="numeric" />
            </Field>
          ) : c.target.type === "pages" ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="From page">
                <input
                  type="number"
                  min={1}
                  max={604}
                  className={inputCls}
                  value={c.target.from}
                  onChange={(e) => set("target", { type: "pages", from: clamp(+e.target.value, 1, 604), to: (c.target as { to: number }).to })}
                />
              </Field>
              <Field label="To page">
                <input
                  type="number"
                  min={1}
                  max={604}
                  className={inputCls}
                  value={c.target.to}
                  onChange={(e) => set("target", { type: "pages", from: (c.target as { from: number }).from, to: clamp(+e.target.value, 1, 604) })}
                />
              </Field>
            </div>
          ) : (
            <div />
          )}
          <Field label="Direction" hint={c.direction === "backward" ? "Surahs from last to first, e.g. An-Nas, Al-Falaq, …" : "Mushaf order, e.g. Al-Baqarah onwards"}>
            <select
              className={inputCls}
              value={c.direction}
              onChange={(e) => {
                const direction = e.target.value as PlanConfig["direction"];
                setC((p) => ({ ...p, direction, start: firstOf(p.target, direction) }));
              }}
            >
              <option value="backward">Backward (by surah)</option>
              <option value="forward">Forward</option>
            </select>
          </Field>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <Field label="Start at surah">
              <select className={inputCls} value={c.start.surah} onChange={(e) => set("start", { surah: +e.target.value, ayah: 1 })}>
                {q.surahs.map((s) => (
                  <option key={s.n} value={s.n}>
                    {s.n}. {s.nameEn}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ayah">
              <input
                type="number"
                min={1}
                max={surahAyahs}
                className={inputCls}
                value={c.start.ayah}
                onChange={(e) => set("start", { ...c.start, ayah: clamp(+e.target.value, 1, surahAyahs) })}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Pace</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="New lines per study day" hint={`${Math.round((c.dailyNewLines / 15) * 100) / 100} of a page (15 lines = 1 page)`}>
            <input type="number" min={1} max={45} className={inputCls} value={c.dailyNewLines} onChange={(e) => set("dailyNewLines", clamp(+e.target.value, 1, 45))} />
          </Field>
          <Field label="Experience" hint="Sets the time estimates below">
            <select
              className={inputCls}
              value={c.experience}
              onChange={(e) => {
                const experience = e.target.value as PlanConfig["experience"];
                setC((p) => ({ ...p, experience, pace: { ...PACE_BY_EXPERIENCE[experience] } }));
              }}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </Field>
          <Field label="Minutes to memorize one line">
            <input type="number" step={0.5} min={0.5} max={20} className={inputCls} value={c.pace.minutesPerNewLine} onChange={(e) => set("pace", { ...c.pace, minutesPerNewLine: clamp(+e.target.value, 0.5, 20) })} />
          </Field>
          <Field label="Minutes to revise one page">
            <input type="number" step={0.5} min={0.5} max={15} className={inputCls} value={c.pace.minutesPerRevisionPage} onChange={(e) => set("pace", { ...c.pace, minutesPerRevisionPage: clamp(+e.target.value, 0.5, 15) })} />
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium">Study days</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={c.studyWeekdays.includes(d)}
                onClick={() => toggleDay(d)}
                className={`min-w-12 rounded-full border px-3 py-1.5 text-sm ${c.studyWeekdays.includes(d) ? "border-accent bg-accent text-accent-text" : "border-border text-muted"}`}
              >
                {WEEKDAY_LABEL[d]}
              </button>
            ))}
          </div>
        </div>
        {c.studyWeekdays.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Lighter weekdays</summary>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {WEEKDAYS.filter((d) => c.studyWeekdays.includes(d)).map((d) => {
                const o = c.weekdayOverrides[d];
                const v = !o ? "1" : o.revisionOnly ? "rev" : String(o.newMultiplier);
                return (
                  <Field key={d} label={WEEKDAY_LABEL[d]}>
                    <select className={inputCls} value={OVERRIDE_OPTIONS.some((x) => x.value === v) ? v : "1"} onChange={(e) => setOverride(d, e.target.value)}>
                      {OVERRIDE_OPTIONS.map((x) => (
                        <option key={x.value} value={x.value}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                );
              })}
            </div>
          </details>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Revision and goals</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sabqi window (days)" hint="Recent material revised daily">
            <input type="number" min={1} max={30} className={inputCls} value={c.sabqiWindowDays} onChange={(e) => set("sabqiWindowDays", clamp(+e.target.value, 1, 30))} />
          </Field>
          <Field label="Manzil cycle (days)" hint="All older material revised once per cycle">
            <input type="number" min={7} max={120} className={inputCls} value={c.manzilCycleDays} onChange={(e) => set("manzilCycleDays", clamp(+e.target.value, 7, 120))} />
          </Field>
          <Field label="Target finish date (optional)">
            <input type="date" className={inputCls} value={c.targetFinishDate ?? ""} min={today} onChange={(e) => set("targetFinishDate", e.target.value || null)} />
          </Field>
          <Field label="Minutes available per study day (optional)">
            <input
              type="number"
              min={5}
              max={600}
              className={inputCls}
              value={c.dailyMinutesBudget ?? ""}
              onChange={(e) => set("dailyMinutesBudget", e.target.value ? clamp(+e.target.value, 5, 600) : null)}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.pauseNewUntilCaughtUp} onChange={(e) => set("pauseNewUntilCaughtUp", e.target.checked)} />
          Pause new memorization until overdue revision is caught up
        </label>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Exceptions</h2>
        <p className="text-xs text-muted">Travel, exams, Ramadan, rest days… Past exceptions stay as history.</p>
        {c.exceptions.length > 0 && (
          <ul className="divide-y divide-border text-sm">
            {c.exceptions.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <b>{EXCEPTION_DEFAULTS[e.kind].label}</b> · {formatDate(e.from)}
                  {e.to !== e.from && ` – ${formatDate(e.to)}`}
                  {e.note && <span className="text-muted"> · {e.note}</span>}
                </span>
                {e.to >= today && (
                  <Button variant="ghost" className="min-h-8 px-2" onClick={() => set("exceptions", c.exceptions.filter((x) => x.id !== e.id))}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="From">
            <input type="date" className={inputCls} value={newEx.from} min={today} onChange={(e) => setNewEx({ ...newEx, from: e.target.value })} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={newEx.to} min={newEx.from} onChange={(e) => setNewEx({ ...newEx, to: e.target.value })} />
          </Field>
          <Field label="Kind">
            <select className={inputCls} value={newEx.kind} onChange={(e) => setNewEx({ ...newEx, kind: e.target.value as typeof newEx.kind })}>
              {EXCEPTION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {EXCEPTION_DEFAULTS[k].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Note">
            <input className={inputCls} value={newEx.note} maxLength={120} onChange={(e) => setNewEx({ ...newEx, note: e.target.value })} />
          </Field>
        </div>
        <Button onClick={addException} disabled={!newEx.from || !newEx.to || newEx.to < newEx.from}>
          Add exception
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">{current ? "Before and after" : "What this plan looks like"}</h2>
        {!validation.success && (
          <p className="text-sm text-danger">{validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}</p>
        )}
        {numbers && (
          <>
            <PreviewTable before={numbers.before} after={numbers.after} />
            <FeasibilityNote k={numbers.after} />
          </>
        )}
        <Button
          variant="primary"
          className="w-full"
          disabled={!validation.success || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(c);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : saveLabel}
        </Button>
        <p className="text-xs text-muted">Changes apply from today onwards. Past days are never rewritten.</p>
      </Card>
    </div>
  );
}

function targetText(t: Target) {
  return t.type === "juz" ? formatNumberList(t.juz) : t.type === "surah" ? formatNumberList(t.surahs) : "";
}

function clamp(n: number, a: number, b: number) {
  return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : a;
}
