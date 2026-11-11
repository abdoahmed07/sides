/**
 * Guided "new habit" conversation. Pure and data-driven: the questions, their
 * order, the follow-ups per kind of habit and the suggestions are all data
 * below. The UI only talks to the `HabitInterviewer` interface, so a later AI
 * coach can replace the scripted one as long as it ends with the same
 * `HabitInput` the form produces.
 */
import { SUGGESTED_HABITS } from '../config';
import { addDays, isValidISODate, relativeDay, shortDate, type ISODate } from './dates';
import type { HabitInput } from './types';

/* ---------- Interface the UI depends on ---------- */

export interface Choice {
  label: string;
  value: string;
  suggested?: boolean;
}

export type QuestionInput =
  | { kind: 'text'; placeholder: string; maxLength: number; suggestions: string[]; skippable: boolean }
  | { kind: 'choice'; options: Choice[] }
  | { kind: 'time'; suggestions: Choice[] }
  | { kind: 'date'; quick: Choice[] };

export interface Turn {
  /** New messages from the interviewer, oldest first. */
  messages: string[];
  /** How the user can answer next. null when finished. */
  input: QuestionInput | null;
  /** Set once the conversation has everything needed. */
  result: HabitInput | null;
}

export interface HabitInterviewer {
  start(): Promise<Turn>;
  /** `value` is machine-readable; it is also what the user sees in their bubble unless a choice label applies. */
  answer(value: string): Promise<Turn>;
  /** Step back one answer. */
  undo(): Promise<Turn>;
}

/* ---------- Kinds of habit (drives follow-ups) ---------- */

export type HabitKind = 'exercise' | 'reading' | 'wake' | 'mindful' | 'avoid' | 'general';

interface KindSpec {
  id: HabitKind;
  match: RegExp;
  /** Suggested schedule; `null` = ask without a suggestion. */
  schedule: 'daily' | 'weekly' | null;
  weeklyTarget?: number;
  minimums: string[];
  /** Asked instead of the usual minimum-version question. */
  minimumPrompt?: string;
}

/** First match wins, so order matters. */
export const HABIT_KINDS: KindSpec[] = [
  {
    id: 'avoid',
    match: /^(no |not |stop|quit|avoid|less |cut |skip |don'?t )/i,
    schedule: 'daily',
    minimums: ['Not today, one day at a time', 'Swap it for something else once'],
    minimumPrompt: 'What counts as a win for the day?',
  },
  {
    id: 'wake',
    match: /\b(wake|waking|get up|getting up)\b/i,
    schedule: 'daily',
    minimums: [],
  },
  {
    id: 'exercise',
    match: /\b(gym|work ?out|run|running|jog|lift|exercise|yoga|swim|walk|train|cardio|cycl|bike|pilates|stretch|sport)/i,
    schedule: 'weekly',
    weeklyTarget: 3,
    minimums: ['Put on my workout clothes', 'Move for 5 minutes', 'Walk around the block'],
  },
  {
    id: 'reading',
    match: /\b(read|book|page)/i,
    schedule: 'daily',
    minimums: ['Read one page', 'Read for 2 minutes'],
  },
  {
    id: 'mindful',
    match: /\b(meditat|breath|journal|gratitude|pray|reflect)/i,
    schedule: 'daily',
    minimums: ['One minute of breathing', 'Write one line'],
  },
  {
    id: 'general',
    match: /.*/,
    schedule: null,
    minimums: ['Just two minutes of it'],
  },
];

export function detectKind(name: string): HabitKind {
  return (HABIT_KINDS.find((k) => k.match.test(name.trim())) ?? HABIT_KINDS[HABIT_KINDS.length - 1]).id;
}

const kindSpec = (k: HabitKind) => HABIT_KINDS.find((s) => s.id === k)!;

/** A seed habit from the spec when the name matches one exactly (e.g. "Gym" → 4× a week). */
function seedFor(name: string | undefined) {
  const n = name?.trim().toLowerCase();
  return SUGGESTED_HABITS.find((s) => s.name.toLowerCase() === n);
}

/* ---------- Draft and questions ---------- */

export interface Draft {
  name?: string;
  kind?: HabitKind;
  wake_time?: string; // 'HH:MM'
  schedule_type?: 'daily' | 'weekly';
  weekly_target?: number;
  minimum_version?: string | null;
  rest_days_per_month?: number;
  start_date?: ISODate;
}

export interface FlowContext {
  today: ISODate;
}

export interface Question {
  id: string;
  /** Asked only when this returns true (default: always). */
  when?: (d: Draft) => boolean;
  /** Interviewer message(s) that ask the question. */
  prompt: (d: Draft, ctx: FlowContext) => string[];
  input: (d: Draft, ctx: FlowContext) => QuestionInput;
  /** Apply an answer to the draft. Return null if the answer is not valid. */
  apply: (d: Draft, value: string, ctx: FlowContext) => Draft | null;
}

const isWeekly = (d: Draft) => d.schedule_type === 'weekly';

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export const FLOW: Question[] = [
  {
    id: 'name',
    prompt: () => ['Hi! Let’s set up a new habit.', 'What do you want to build?'],
    input: () => ({
      kind: 'text',
      placeholder: 'e.g. Read a page',
      maxLength: 80,
      suggestions: SUGGESTED_HABITS.map((s) => s.name),
      skippable: false,
    }),
    apply: (d, v) => {
      const name = v.trim().slice(0, 80);
      return name ? { ...d, name, kind: detectKind(name) } : null;
    },
  },
  {
    id: 'wake_time',
    when: (d) => d.kind === 'wake',
    prompt: () => ['Nice. What time counts as early for you?'],
    input: () => ({
      kind: 'time',
      suggestions: ['06:00', '06:30', '07:00'].map((t) => ({ label: formatTime(t), value: t })),
    }),
    apply: (d, v) => (/^\d{2}:\d{2}$/.test(v) ? { ...d, wake_time: v } : null),
  },
  {
    id: 'schedule',
    when: (d) => d.kind !== 'avoid' && d.kind !== 'wake',
    prompt: (d) => [
      d.kind === 'exercise'
        ? 'How often? For training, a few times a week with rest in between often works well.'
        : 'How often do you want to do it?',
    ],
    input: (d) => {
      const suggested = seedFor(d.name)?.schedule_type ?? kindSpec(d.kind ?? 'general').schedule;
      return {
        kind: 'choice',
        options: [
          { label: 'Every day', value: 'daily', suggested: suggested === 'daily' },
          { label: 'A few times a week', value: 'weekly', suggested: suggested === 'weekly' },
        ],
      };
    },
    apply: (d, v) =>
      v === 'daily' || v === 'weekly'
        ? { ...d, schedule_type: v, weekly_target: v === 'weekly' ? d.weekly_target : undefined }
        : null,
  },
  {
    id: 'weekly_target',
    when: isWeekly,
    prompt: () => ['How many times a week feels doable, even on a busy week?'],
    input: (d) => {
      const suggested = seedFor(d.name)?.weekly_target ?? kindSpec(d.kind ?? 'general').weeklyTarget ?? 3;
      return {
        kind: 'choice',
        options: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ label: `${n}×`, value: String(n), suggested: n === suggested })),
      };
    },
    apply: (d, v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 7 ? { ...d, weekly_target: n } : null;
    },
  },
  {
    id: 'minimum_version',
    prompt: (d) => {
      const spec = kindSpec(d.kind ?? 'general');
      return [spec.minimumPrompt ?? 'What’s the tiniest version that still counts on a hard day?'];
    },
    input: (d) => {
      const spec = kindSpec(d.kind ?? 'general');
      const seed = seedFor(d.name)?.minimum_version;
      const fromWake = d.wake_time ? [`Out of bed by ${formatTime(d.wake_time)}`] : [];
      const suggestions = [...new Set([...fromWake, ...(seed && !fromWake.length ? [seed] : []), ...spec.minimums])].slice(0, 3);
      return { kind: 'text', placeholder: 'Something you can do in two minutes', maxLength: 140, suggestions, skippable: true };
    },
    apply: (d, v) => ({ ...d, minimum_version: v.trim().slice(0, 140) || null }),
  },
  {
    id: 'rest_days',
    when: (d) => !isWeekly(d),
    prompt: () => [
      'How many free rest days a month would you like? A rest day keeps your streak alive but doesn’t add to it.',
    ],
    input: (d) => {
      const suggested = seedFor(d.name)?.rest_days_per_month ?? 2;
      return {
        kind: 'choice',
        options: [0, 1, 2, 3, 4].map((n) => ({
          label: n === 0 ? 'None' : String(n),
          value: String(n),
          suggested: n === suggested,
        })),
      };
    },
    apply: (d, v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 && n <= 10 ? { ...d, rest_days_per_month: n } : null;
    },
  },
  {
    id: 'start_date',
    prompt: () => ['Last one: when do you want to start?'],
    input: (_d, ctx) => ({
      kind: 'date',
      quick: [
        { label: 'Today', value: ctx.today, suggested: true },
        { label: 'Tomorrow', value: addDays(ctx.today, 1) },
      ],
    }),
    apply: (d, v) => (isValidISODate(v) ? { ...d, start_date: v } : null),
  },
];

/** The next unanswered question that applies to this draft, or null when done. */
export function nextQuestion(answered: ReadonlySet<string>, draft: Draft): Question | null {
  return FLOW.find((q) => !answered.has(q.id) && (q.when?.(draft) ?? true)) ?? null;
}

/** The finished habit, in exactly the shape the habit form produces. */
export function toHabitInput(d: Draft, ctx: FlowContext): HabitInput {
  const schedule_type = d.schedule_type ?? 'daily';
  return {
    name: (d.name ?? '').trim(),
    schedule_type,
    weekly_target: schedule_type === 'weekly' ? d.weekly_target ?? 3 : null,
    minimum_version: d.minimum_version?.trim() || null,
    rest_days_per_month: schedule_type === 'weekly' ? 0 : d.rest_days_per_month ?? 0,
    start_date: d.start_date ?? ctx.today,
  };
}

/** Text shown in the user's bubble for an answer. */
export function echo(input: QuestionInput, value: string): string {
  if (input.kind === 'choice') return input.options.find((o) => o.value === value)?.label ?? value;
  if (input.kind === 'time') return formatTime(value);
  if (input.kind === 'date') return input.quick.find((o) => o.value === value)?.label ?? shortDate(value);
  return value.trim() || 'Skip';
}

/* ---------- Scripted interviewer ---------- */

/** Fills defaults that skipped questions imply (e.g. "no sugar" → every day). */
function implied(d: Draft): Draft {
  if ((d.kind === 'avoid' || d.kind === 'wake') && !d.schedule_type) return { ...d, schedule_type: 'daily' };
  return d;
}

export function summarize(h: HabitInput, today: ISODate): string {
  const how = h.schedule_type === 'weekly' ? `${h.weekly_target}× a week` : 'every day';
  const rest =
    h.schedule_type === 'daily'
      ? `, ${h.rest_days_per_month === 0 ? 'no' : h.rest_days_per_month} rest day${h.rest_days_per_month === 1 ? '' : 's'} a month`
      : '';
  const start = `starting ${relativeDay(h.start_date, today)}`;
  return `${h.name}, ${how}${rest}, ${start}.`;
}

export function createScriptedInterviewer(ctx: FlowContext): HabitInterviewer {
  let history: { id: string; before: Draft }[] = [];
  let draft: Draft = {};

  const answeredIds = () => new Set(history.map((h) => h.id));

  const ask = (pre: string[] = []): Turn => {
    const q = nextQuestion(answeredIds(), draft);
    if (!q) {
      const result = toHabitInput(draft, ctx);
      return { messages: [...pre, `Here’s your habit: ${summarize(result, ctx.today)}`], input: null, result };
    }
    return { messages: [...pre, ...q.prompt(draft, ctx)], input: q.input(draft, ctx), result: null };
  };

  return {
    async start() {
      history = [];
      draft = {};
      return ask();
    },
    async answer(value: string) {
      const q = nextQuestion(answeredIds(), draft);
      if (!q) return ask();
      const next = q.apply(draft, value, ctx);
      if (!next) return { messages: ['Hmm, I didn’t catch that. Try again?'], input: q.input(draft, ctx), result: null };
      history.push({ id: q.id, before: draft });
      draft = implied(next);
      const pre: string[] = [];
      if (q.id === 'schedule' && draft.schedule_type === 'weekly') {
        pre.push('Weekly habits have rest built in, so no rest days needed.');
      }
      return ask(pre);
    },
    async undo() {
      const last = history.pop();
      if (last) draft = last.before;
      return ask();
    },
  };
}
