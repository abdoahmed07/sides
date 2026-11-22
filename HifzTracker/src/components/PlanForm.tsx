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
  type WeeklyReading,
} from "@/core/plan/schema";
import { surahListLabel } from "@/core/plan/preview";
import { buildSequence } from "@/core/plan/sequence";
import { keyNumbers, type KeyNumbers } from "@/core/plan/summary";
import { totals } from "@/core/stats";
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

const DAILY_PRESETS = [
  { lines: 3, label: "3 lines" },
  { lines: 5, label: "5 lines" },
  { lines: 8, label: "Half a page" },
  { lines: 15, label: "1 page" },
  { lines: 30, label: "2 pages" },
];

function Question({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-2.5 flex items-center gap-2.5 font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-xs text-accent">{n}</span>
        {title}
      </legend>
      {hint && <p className="-mt-1 text-xs text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

function Option({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Chips({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; hint?: string }[];
  onChange: (v: string) => void;
}) {
  const hint = options.find((o) => o.value === value)?.hint;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
              o.value === value ? "border-accent bg-accent text-accent-text" : "border-border text-muted hover:border-accent hover:text-text"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
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
  memorized,
}: {
  initial: PlanConfig;
  current: PlanConfig | null;
  units: MemUnit[];
  today: IsoDate;
  saveLabel: string;
  onSave: (c: PlanConfig) => Promise<void>;
  /** The "already memorized" editor, shown as the last question. */
  memorized?: React.ReactNode;
}) {
  const [c, setC] = useState<PlanConfig>(initial);
  const [listText, setListText] = useState(() => targetText(initial.target));
  const [saving, setSaving] = useState(false);
  const [customAmount, setCustomAmount] = useState(() => !DAILY_PRESETS.some((p) => p.lines === initial.dailyNewLines));
  const [newEx, setNewEx] = useState({ from: today, to: today, kind: "travel" as (typeof EXCEPTION_KINDS)[number], note: "" });
  const set = <K extends keyof PlanConfig>(k: K, v: PlanConfig[K]) => setC((p) => ({ ...p, [k]: v }));

  const validation = PlanConfigSchema.safeParse(c);
  const numbers = useMemo(() => {
    if (!validation.success) return null;
    const t = totals(units, q);
    const withPages = (k: KeyNumbers): KeyNumbers => ({ ...k, memorizedPages: t.fullPages, memorizedPartPages: t.partialPages });
    return {
      before: current ? withPages(keyNumbers(current, forecastFor(current, units, today))) : null,
      after: withPages(keyNumbers(c, forecastFor(c, units, today))),
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
  const first = firstOf(c.target, c.direction);
  const startChanged = first.surah !== c.start.surah || first.ayah !== c.start.ayah;

  const targetSummary =
    c.target.type === "quran"
      ? "The whole Quran"
      : c.target.type === "juz"
        ? `Juz ${formatNumberList(c.target.juz)}`
        : c.target.type === "surah"
          ? surahListLabel(c.target.surahs, q)
          : `Pages ${c.target.from}–${c.target.to}`;
  const isPreset = !customAmount && DAILY_PRESETS.some((p) => p.lines === c.dailyNewLines);
  const extrasSet = [
    c.targetFinishDate && "target date",
    c.dailyMinutesBudget && "time limit",
    (c.weeklyReadings ?? []).length > 0 && "weekly reading",
    c.exceptions.some((e) => e.to >= today) && "exceptions",
    Object.keys(c.weekdayOverrides).length > 0 && "lighter days",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <Card className="space-y-6">
        <Question n={1} title="What do you want to memorize?">
          <Chips
            value={c.target.type}
            options={[
              { value: "juz", label: "Juz" },
              { value: "surah", label: "Surahs" },
              { value: "quran", label: "Whole Quran" },
              { value: "pages", label: "Pages" },
            ]}
            onChange={(v) => setTargetType(v as Target["type"])}
          />
          {c.target.type === "juz" || c.target.type === "surah" ? (
            <Field
              label={c.target.type === "juz" ? "Which juz?" : "Which surahs? (numbers)"}
              hint={c.target.type === "juz" ? "e.g. 30, or 29-30" : "e.g. 67, or 2, 78-114 (Al-Baqarah and Juz 30)"}
            >
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
          ) : null}
          <p className="text-sm text-muted">
            → <span className="text-text">{targetSummary}</span>
          </p>
        </Question>

        <Question n={2} title="Where do you start?">
          <Chips
            value={c.direction}
            options={[
              { value: "backward", label: "From the end", hint: "An-Nas, Al-Falaq, … each surah top to bottom" },
              { value: "forward", label: "From the beginning", hint: "Mushaf order" },
            ]}
            onChange={(v) => {
              const direction = v as PlanConfig["direction"];
              setC((p) => ({ ...p, direction, start: firstOf(p.target, direction) }));
            }}
          />
          <details className="text-sm" open={startChanged}>
            <summary className="cursor-pointer text-muted">
              Starts at <span className="text-text">{q.surah(c.start.surah).nameEn} {c.start.ayah}</span> · change
            </summary>
            <div className="mt-2 grid grid-cols-[1fr_6rem] gap-2">
              <Field label="Surah">
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
            <p className="mt-1 text-xs text-muted">Use this if you&apos;re partway through, e.g. Al-Baqarah 219.</p>
          </details>
        </Question>

        <Question n={3} title="How much new each day?">
          <Chips
            value={isPreset ? String(c.dailyNewLines) : "other"}
            options={[...DAILY_PRESETS.map((p) => ({ value: String(p.lines), label: p.label })), { value: "other", label: "Other" }]}
            onChange={(v) => {
              setCustomAmount(v === "other");
              if (v !== "other") set("dailyNewLines", +v);
            }}
          />
          {!isPreset && (
            <Field label="Lines per day" hint="15 lines = 1 page">
              <input type="number" min={1} max={45} className={inputCls} value={c.dailyNewLines} onChange={(e) => set("dailyNewLines", clamp(+e.target.value, 1, 45))} />
            </Field>
          )}
        </Question>

        <Question n={4} title="Which days?">
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
        </Question>

        <Question n={5} title="Have you memorized before?" hint="Only used to estimate how long each day takes.">
          <Chips
            value={c.experience}
            options={[
              { value: "beginner", label: "First time" },
              { value: "intermediate", label: "Yes, some" },
              { value: "advanced", label: "Yes, a lot" },
            ]}
            onChange={(v) => {
              const experience = v as PlanConfig["experience"];
              setC((p) => ({ ...p, experience, pace: { ...PACE_BY_EXPERIENCE[experience] } }));
            }}
          />
        </Question>

        {memorized && (
          <Question n={6} title="Already know some of it?">
            {memorized}
          </Question>
        )}
      </Card>

      <details className="group rounded-2xl border border-border bg-surface" open={extrasSet.length > 0 && !!current}>
        <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
          <span>
            <span className="font-semibold">More options</span>
            <span className="block text-xs text-muted">
              {extrasSet.length ? `Set: ${extrasSet.join(", ")}` : "Target date, time limit, Friday Al-Kahf, travel and exams, revision settings"}
            </span>
          </span>
          <span className="text-muted transition group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="space-y-6 border-t border-border p-4">
          <Option title="Goal and time">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Finish by (optional)">
                <input type="date" className={inputCls} value={c.targetFinishDate ?? ""} min={today} onChange={(e) => set("targetFinishDate", e.target.value || null)} />
              </Field>
              <Field label="Minutes you have a day (optional)">
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
          </Option>

          <Option title="Weekly reading" hint="A surah you read every week, like Al-Kahf on Fridays. It shows on Today that day; it isn't memorized or rated.">
            <WeeklyReadingsField value={c.weeklyReadings ?? []} onChange={(v) => set("weeklyReadings", v)} />
          </Option>

          <Option title="Travel, exams, Ramadan…" hint="Days that should be lighter or off. Past ones stay as history.">
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
          </Option>

          <Option title="Revision">
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
          </Option>

          <Option title="Fine-tuning">
        {c.studyWeekdays.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Lighter weekdays</summary>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Minutes to memorize one line">
                <input type="number" step={0.5} min={0.5} max={20} className={inputCls} value={c.pace.minutesPerNewLine} onChange={(e) => set("pace", { ...c.pace, minutesPerNewLine: clamp(+e.target.value, 0.5, 20) })} />
              </Field>
              <Field label="Minutes to revise one page">
                <input type="number" step={0.5} min={0.5} max={15} className={inputCls} value={c.pace.minutesPerRevisionPage} onChange={(e) => set("pace", { ...c.pace, minutesPerRevisionPage: clamp(+e.target.value, 0.5, 15) })} />
              </Field>
            </div>
          </Option>
        </div>
      </details>

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

function WeeklyReadingsField({ value, onChange }: { value: WeeklyReading[]; onChange: (v: WeeklyReading[]) => void }) {
  const [surah, setSurah] = useState(18);
  const [day, setDay] = useState<Weekday>("fri");
  const exists = value.some((r) => r.surah === surah && r.day === day);
  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {value.map((r) => (
            <li key={`${r.day}-${r.surah}`} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {q.surah(r.surah).nameEn} · every {WEEKDAY_LABEL[r.day]}
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== r))}
                className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Surah">
          <select className={inputCls} value={surah} onChange={(e) => setSurah(+e.target.value)}>
            {q.surahs.map((s) => (
              <option key={s.n} value={s.n}>
                {s.n}. {s.nameEn}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Day">
          <select className={inputCls} value={day} onChange={(e) => setDay(e.target.value as Weekday)}>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LABEL[d]}
              </option>
            ))}
          </select>
        </Field>
        <Button type="button" disabled={exists || value.length >= 14} onClick={() => onChange([...value, { surah, day }])}>
          Add
        </Button>
      </div>
    </div>
  );
}
