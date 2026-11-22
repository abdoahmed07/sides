"use client";
import { useMemo, useState } from "react";
import { WEEKDAY_LABEL, WEEKDAYS, addDays, formatDate, type IsoDate, type Weekday } from "@/core/dates";
import {
  EXCEPTION_DEFAULTS,
  EXCEPTION_KINDS,
  PACE_BY_EXPERIENCE,
  PlanConfigSchema,
  type PlanConfig,
  type Target,
  type WeeklyReading,
} from "@/core/plan/schema";
import { describeChanges, pagesLeft, readingsLabel, surahListLabel } from "@/core/plan/preview";
import { buildSequence } from "@/core/plan/sequence";
import { keyNumbers, type KeyNumbers } from "@/core/plan/summary";
import { totals } from "@/core/stats";
import type { MemUnit } from "@/core/srs";
import { forecastFor, q, ramadanHint } from "@/lib/app";
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
  { value: "0.5", label: "Half new" },
  { value: "rev", label: "Revision only" },
];

/** One row of "More options": its current value in words; tap to open the editor under it. */
function Setting({
  title,
  value,
  open,
  onToggle,
  children,
}: {
  title: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className={`block truncate text-sm ${open ? "text-text" : "text-muted"}`}>{value}</span>
        </span>
        <span className={`shrink-0 text-muted transition ${open ? "rotate-90" : ""}`} aria-hidden>
          ›
        </span>
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </li>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-wide text-muted">{children}</p>;
}

const MINUTES_PRESETS = [15, 30, 45, 60, 90];
const SABQI_PRESETS = [
  { value: "5", label: "Last 5 days" },
  { value: "7", label: "Last 7 days" },
  { value: "10", label: "Last 10 days" },
  { value: "14", label: "Last 14 days" },
];
const MANZIL_PRESETS = [
  { value: "14", label: "2 weeks" },
  { value: "21", label: "3 weeks" },
  { value: "30", label: "1 month" },
  { value: "45", label: "6 weeks" },
  { value: "60", label: "2 months" },
];

function exceptionEffect(kind: (typeof EXCEPTION_KINDS)[number]): string {
  const d = EXCEPTION_DEFAULTS[kind];
  const neu = d.newMultiplier === 0 ? "no new memorization" : d.newMultiplier < 1 ? "half the new amount" : "the usual new amount";
  const rev = { normal: "normal revision", light: "lighter revision", none: "no revision", extra: "extra revision to catch up" }[d.revision];
  return `${neu}, ${rev}`;
}

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
  const [addingEx, setAddingEx] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState(() => !!initial.dailyMinutesBudget && !MINUTES_PRESETS.includes(initial.dailyMinutesBudget));
  const [pickDate, setPickDate] = useState(false);
  const toggleRow = (id: string) => setOpenRow((r) => (r === id ? null : id));
  const set = <K extends keyof PlanConfig>(k: K, v: PlanConfig[K]) => setC((p) => ({ ...p, [k]: v }));

  const validation = PlanConfigSchema.safeParse(c);
  const numbers = useMemo(() => {
    if (!validation.success) return null;
    const t = totals(units, q);
    const withPages = (k: KeyNumbers, cfg: PlanConfig): KeyNumbers => ({
      ...k,
      memorizedPages: t.fullPages,
      memorizedPartPages: t.partialPages,
      pagesLeft: pagesLeft(cfg, units, q),
    });
    return {
      before: current ? withPages(keyNumbers(current, forecastFor(current, units, today)), current) : null,
      after: withPages(keyNumbers(c, forecastFor(c, units, today)), c),
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
    setAddingEx(false);
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
  const upcoming = c.exceptions.filter((e) => e.to >= today);
  const ramadan = ramadanHint(today);
  const finishChoices = [
    { value: "none", label: "No date", date: null as IsoDate | null },
    { value: "3m", label: "In 3 months", date: addDays(today, 91) },
    { value: "6m", label: "In 6 months", date: addDays(today, 182) },
    { value: "1y", label: "In 1 year", date: addDays(today, 365) },
    ...(ramadan ? [{ value: "ramadan", label: "Before Ramadan", date: addDays(ramadan, -1) }] : []),
  ];
  const finishValue = pickDate
    ? "pick"
    : (finishChoices.find((f) => f.date === c.targetFinishDate)?.value ?? (c.targetFinishDate ? "pick" : "none"));
  const overrideText = WEEKDAYS.filter((d) => c.studyWeekdays.includes(d) && c.weekdayOverrides[d])
    .map((d) => `${WEEKDAY_LABEL[d]} ${c.weekdayOverrides[d]!.revisionOnly ? "revision only" : "half new"}`)
    .join(", ");
  const changed = !current || JSON.stringify(current) !== JSON.stringify(c);

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

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="px-4 pb-1 pt-4">
          <h2 className="font-semibold">More options</h2>
          <p className="text-xs text-muted">All optional. Tap one to change it.</p>
        </div>
        <ul className="divide-y divide-border">
          <Setting
            title="Finish by"
            value={c.targetFinishDate ? formatDate(c.targetFinishDate) : "No date"}
            open={openRow === "finish"}
            onToggle={() => toggleRow("finish")}
          >
            <Chips
              value={finishValue}
              options={[...finishChoices.map((f) => ({ value: f.value, label: f.label })), { value: "pick", label: "Pick a date" }]}
              onChange={(v) => {
                setPickDate(v === "pick");
                if (v !== "pick") set("targetFinishDate", finishChoices.find((f) => f.value === v)?.date ?? null);
              }}
            />
            {finishValue === "pick" && (
              <input
                type="date"
                aria-label="Finish by"
                className={`${inputCls} max-w-56`}
                value={c.targetFinishDate ?? ""}
                min={addDays(today, 1)}
                onChange={(e) => set("targetFinishDate", e.target.value || null)}
              />
            )}
            <p className="text-xs text-muted">Your daily amount stays the same. The app shows whether you&apos;ll make it, and what would.</p>
          </Setting>

          <Setting
            title="Time per day"
            value={c.dailyMinutesBudget ? `About ${c.dailyMinutesBudget} min` : "No limit"}
            open={openRow === "time"}
            onToggle={() => toggleRow("time")}
          >
            <Chips
              value={customMinutes ? "other" : String(c.dailyMinutesBudget ?? "none")}
              options={[
                { value: "none", label: "No limit" },
                ...MINUTES_PRESETS.map((m) => ({ value: String(m), label: `${m} min` })),
                { value: "other", label: "Other" },
              ]}
              onChange={(v) => {
                setCustomMinutes(v === "other");
                if (v === "none") set("dailyMinutesBudget", null);
                else if (v !== "other") set("dailyMinutesBudget", Number(v));
              }}
            />
            {customMinutes && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  min={5}
                  max={600}
                  className={`${inputCls} w-24`}
                  value={c.dailyMinutesBudget ?? ""}
                  onChange={(e) => set("dailyMinutesBudget", e.target.value ? clamp(+e.target.value, 5, 600) : null)}
                />
                minutes a day
              </label>
            )}
            <p className="text-xs text-muted">Only used to tell you when a day will take longer. It never changes your daily amount.</p>
          </Setting>

          <Setting
            title="Weekly reading"
            value={readingsLabel(c.weeklyReadings ?? [], q) || "None"}
            open={openRow === "reading"}
            onToggle={() => toggleRow("reading")}
          >
            <WeeklyReadingsField value={c.weeklyReadings ?? []} onChange={(v) => set("weeklyReadings", v)} />
          </Setting>

          <Setting
            title="Travel, exams, Ramadan…"
            value={
              upcoming.length
                ? upcoming
                    .map((e) => `${EXCEPTION_DEFAULTS[e.kind].label} ${formatDate(e.from, { day: "numeric", month: "short" })}${e.to !== e.from ? `–${formatDate(e.to, { day: "numeric", month: "short" })}` : ""}`)
                    .join(", ")
                : "Nothing planned"
            }
            open={openRow === "exceptions"}
            onToggle={() => toggleRow("exceptions")}
          >
            <p className="text-xs text-muted">Days that should be lighter or off. The plan adjusts around them; past ones stay as history.</p>
            {c.exceptions.length > 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                {c.exceptions.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className={e.to < today ? "text-muted" : ""}>
                      <b>{EXCEPTION_DEFAULTS[e.kind].label}</b> · {formatDate(e.from)}
                      {e.to !== e.from && ` – ${formatDate(e.to)}`}
                      {e.note && <span className="text-muted"> · {e.note}</span>}
                    </span>
                    {e.to >= today && (
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text"
                        onClick={() => set("exceptions", c.exceptions.filter((x) => x.id !== e.id))}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {addingEx ? (
              <div className="space-y-3 rounded-xl border border-border p-3">
                <Chips
                  value={newEx.kind}
                  options={EXCEPTION_KINDS.map((k) => ({ value: k, label: EXCEPTION_DEFAULTS[k].label, hint: `On these days: ${exceptionEffect(k)}.` }))}
                  onChange={(v) => {
                    const kind = v as typeof newEx.kind;
                    // Ramadan: fill in the dates of the next Ramadan.
                    if (kind === "ramadan" && ramadan) setNewEx({ ...newEx, kind, from: ramadan < today ? today : ramadan, to: addDays(ramadan, 29) });
                    else setNewEx({ ...newEx, kind });
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="From">
                    <input type="date" className={inputCls} value={newEx.from} min={today} onChange={(e) => setNewEx({ ...newEx, from: e.target.value, to: e.target.value > newEx.to ? e.target.value : newEx.to })} />
                  </Field>
                  <Field label="To">
                    <input type="date" className={inputCls} value={newEx.to} min={newEx.from} onChange={(e) => setNewEx({ ...newEx, to: e.target.value })} />
                  </Field>
                </div>
                <Field label="Note (optional)">
                  <input className={inputCls} value={newEx.note} maxLength={120} placeholder="e.g. Umrah" onChange={(e) => setNewEx({ ...newEx, note: e.target.value })} />
                </Field>
                <div className="flex gap-2">
                  <Button variant="primary" onClick={addException} disabled={!newEx.from || !newEx.to || newEx.to < newEx.from}>
                    Add
                  </Button>
                  <Button variant="ghost" onClick={() => setAddingEx(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setAddingEx(true)}>+ Add days</Button>
            )}
          </Setting>

          <Setting
            title="Revision"
            value={`Sabqi ${c.sabqiWindowDays} days · Manzil every ${c.manzilCycleDays === 30 ? "month" : (MANZIL_PRESETS.find((m) => +m.value === c.manzilCycleDays)?.label ?? `${c.manzilCycleDays} days`)}`}
            open={openRow === "revision"}
            onToggle={() => toggleRow("revision")}
          >
            <SubLabel>Sabqi: how long new pages are revised daily</SubLabel>
            <Chips
              value={String(c.sabqiWindowDays)}
              options={SABQI_PRESETS.some((x) => +x.value === c.sabqiWindowDays) ? SABQI_PRESETS : [...SABQI_PRESETS, { value: String(c.sabqiWindowDays), label: `Last ${c.sabqiWindowDays} days` }]}
              onChange={(v) => set("sabqiWindowDays", Number(v))}
            />
            <SubLabel>Manzil: every older page comes round once every</SubLabel>
            <Chips
              value={String(c.manzilCycleDays)}
              options={MANZIL_PRESETS.some((x) => +x.value === c.manzilCycleDays) ? MANZIL_PRESETS : [...MANZIL_PRESETS, { value: String(c.manzilCycleDays), label: `${c.manzilCycleDays} days` }]}
              onChange={(v) => set("manzilCycleDays", Number(v))}
            />
            <p className="text-xs text-muted">Shorter means a little more revision each day and stronger memory.</p>
            <SubLabel>If revision falls behind</SubLabel>
            <Chips
              value={c.pauseNewUntilCaughtUp ? "pause" : "slow"}
              options={[
                { value: "slow", label: "Slow down new", hint: "New memorization is halved, or skipped, until revision catches up." },
                { value: "pause", label: "Pause new", hint: "No new memorization at all until overdue revision is done." },
              ]}
              onChange={(v) => set("pauseNewUntilCaughtUp", v === "pause")}
            />
          </Setting>

          {c.studyWeekdays.length > 0 && (
            <Setting title="Lighter days" value={overrideText || "None"} open={openRow === "lighter"} onToggle={() => toggleRow("lighter")}>
              <p className="text-xs text-muted">Make some study days easier every week, e.g. a busy Monday.</p>
              <ul className="space-y-2">
                {WEEKDAYS.filter((d) => c.studyWeekdays.includes(d)).map((d) => {
                  const o = c.weekdayOverrides[d];
                  const v = !o ? "1" : o.revisionOnly ? "rev" : String(o.newMultiplier);
                  return (
                    <li key={d} className="flex flex-wrap items-center gap-2">
                      <span className="w-10 text-sm font-medium">{WEEKDAY_LABEL[d]}</span>
                      <Chips value={OVERRIDE_OPTIONS.some((x) => x.value === v) ? v : "1"} options={OVERRIDE_OPTIONS} onChange={(nv) => setOverride(d, nv)} />
                    </li>
                  );
                })}
              </ul>
            </Setting>
          )}

          <Setting
            title="Time estimates"
            value={`${c.pace.minutesPerNewLine} min a new line · ${c.pace.minutesPerRevisionPage} min a revised page`}
            open={openRow === "pace"}
            onToggle={() => toggleRow("pace")}
          >
            <p className="text-xs text-muted">
              Only used to estimate how long each day takes. Your answer to question 5 sets them; change them if your days take longer or shorter.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minutes per new line">
                <input type="number" step={0.5} min={0.5} max={20} className={inputCls} value={c.pace.minutesPerNewLine} onChange={(e) => set("pace", { ...c.pace, minutesPerNewLine: clamp(+e.target.value, 0.5, 20) })} />
              </Field>
              <Field label="Minutes per revised page">
                <input type="number" step={0.5} min={0.5} max={15} className={inputCls} value={c.pace.minutesPerRevisionPage} onChange={(e) => set("pace", { ...c.pace, minutesPerRevisionPage: clamp(+e.target.value, 0.5, 15) })} />
              </Field>
            </div>
          </Setting>
        </ul>
      </section>

      <Card className="space-y-3">
        <h2 className="font-semibold">{current ? (changed ? "What changes" : "Your plan") : "Your plan at a glance"}</h2>
        {!validation.success && (
          <p className="text-sm text-danger">{validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}</p>
        )}
        {current && changed && validation.success && (
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {describeChanges(current, c, [], q).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {numbers && (
          <>
            {/* Nothing changed yet: an overview of the plan instead of "stays the same". */}
            <PreviewTable before={changed ? numbers.before : null} after={numbers.after} />
            <FeasibilityNote k={numbers.after} />
          </>
        )}
        <Button
          variant="primary"
          className="w-full"
          disabled={!validation.success || saving || !changed}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(c);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : changed ? saveLabel : "No changes yet"}
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
  const [days, setDays] = useState<Weekday[]>(["fri"]);
  const add = (s: number, ds: Weekday[]) => {
    const next = [...value];
    for (const day of ds) if (!next.some((r) => r.surah === s && r.day === day)) next.push({ surah: s, day });
    onChange(next.slice(0, 14));
  };
  const bySurah = [...new Set(value.map((r) => r.surah))];
  const hasKahf = value.some((r) => r.surah === 18 && r.day === "fri");
  const fits = value.length + days.filter((d) => !value.some((r) => r.surah === surah && r.day === d)).length <= 14;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">A surah you read (not memorize) on certain days, like Al-Kahf on Fridays. It shows on Today those days.</p>
      {bySurah.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {bySurah.map((s) => (
            <li key={s} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>{readingsLabel(value.filter((r) => r.surah === s), q)}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((r) => r.surah !== s))}
                className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {!hasKahf && (
        <Button type="button" onClick={() => add(18, ["fri"])}>
          + Al-Kahf on Fridays
        </Button>
      )}
      <div className="space-y-2 rounded-xl border border-border p-3">
        <Field label="Surah">
          <select className={inputCls} value={surah} onChange={(e) => setSurah(+e.target.value)}>
            {q.surahs.map((s) => (
              <option key={s.n} value={s.n}>
                {s.n}. {s.nameEn}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
          {WEEKDAYS.map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-accent bg-accent text-accent-text" : "border-border text-muted hover:border-accent hover:text-text"}`}
              >
                {WEEKDAY_LABEL[d]}
              </button>
            );
          })}
          <button type="button" onClick={() => setDays(days.length === 7 ? [] : [...WEEKDAYS])} className="px-2 text-sm text-accent underline-offset-2 hover:underline">
            {days.length === 7 ? "Clear" : "Every day"}
          </button>
        </div>
        <Button type="button" disabled={!days.length || !fits || days.every((d) => value.some((r) => r.surah === surah && r.day === d))} onClick={() => add(surah, days)}>
          Add {q.surah(surah).nameEn}
        </Button>
      </div>
    </div>
  );
}
