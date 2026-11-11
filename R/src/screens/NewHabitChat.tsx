import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SUGGESTED_HABITS } from '../config';
import { useData } from '../data/store';
import {
  createScriptedInterviewer,
  echo,
  type HabitInterviewer,
  type QuestionInput,
  type Turn,
} from '../lib/habitFlow';
import { relativeDay, type ISODate } from '../lib/dates';
import { href, navigate } from '../lib/router';
import type { HabitInput } from '../lib/types';
import { useToday } from '../lib/useToday';

interface Segment {
  bot: string[];
  input: QuestionInput | null;
  result: HabitInput | null;
  /** The user's reply to this segment's question, once given. */
  user?: string;
}

const fromTurn = (t: Turn): Segment => ({ bot: t.messages, input: t.input, result: t.result });

/** New habit, one question at a time. Talks only to a `HabitInterviewer`. */
export function NewHabitChat({ suggestion }: { suggestion?: string | null }) {
  const { createHabit } = useData();
  const today = useToday();
  const [interviewer] = useState<HabitInterviewer>(() => createScriptedInterviewer({ today }));
  const [segments, setSegments] = useState<Segment[]>([]);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let segs = [fromTurn(await interviewer.start())];
      if (cancelled) return; // a newer run restarted the interviewer
      const seed = suggestion != null ? SUGGESTED_HABITS[Number(suggestion)] : undefined;
      if (seed && segs[0].input) {
        segs[0] = { ...segs[0], user: echo(segs[0].input, seed.name) };
        segs = [...segs, fromTurn(await interviewer.answer(seed.name))];
      }
      if (!cancelled) setSegments(segs);
    })();
    return () => {
      cancelled = true;
    };
  }, [interviewer, suggestion]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [segments]);

  const current = segments[segments.length - 1];

  async function reply(value: string) {
    if (!current?.input || busy) return;
    const shown = echo(current.input, value);
    setSegments((s) => [...s.slice(0, -1), { ...s[s.length - 1], user: shown }]);
    setBusy(true);
    const turn = await interviewer.answer(value);
    setSegments((s) => [...s, fromTurn(turn)]);
    setBusy(false);
  }

  async function undo() {
    if (segments.length < 2 || busy) return;
    setBusy(true);
    const turn = await interviewer.undo();
    setSegments((s) => {
      const kept = s.slice(0, -1);
      const last = kept[kept.length - 1];
      return [...kept.slice(0, -1), { ...last, user: undefined, input: turn.input, result: turn.result }];
    });
    setSaveError(null);
    setBusy(false);
  }

  async function save(result: HabitInput) {
    setBusy(true);
    setSaveError(null);
    try {
      await createHabit(result);
      navigate('/');
    } catch (err) {
      console.error(err);
      setSaveError('Could not save. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <section className="screen chat-screen">
      <header className="screen-header">
        <a className="btn btn-quiet btn-back" href={href('/')} aria-label="Back to Today">
          ‹ Back
        </a>
        <h1 className="screen-title">New habit</h1>
      </header>

      <div className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
        {segments.map((seg, i) => (
          <div key={i} className="chat-segment">
            {seg.bot.map((m, j) => (
              <p key={j} className="bubble bubble-bot">
                {m}
              </p>
            ))}
            {seg.user !== undefined && <p className="bubble bubble-user">{seg.user}</p>}
          </div>
        ))}
        <div ref={end} />
      </div>

      <div className="chat-input">
        {current?.result && (
          <div className="stack">
            <HabitSummary habit={current.result} today={today} />
            {saveError && (
              <p className="form-error" role="alert">
                {saveError}
              </p>
            )}
            <button className="btn btn-primary" onClick={() => save(current.result!)} disabled={busy}>
              Add habit
            </button>
          </div>
        )}
        {current?.input && <Answer key={segments.length} input={current.input} disabled={busy} onAnswer={reply} />}
        <div className="row chat-tools">
          {segments.length > 1 && (
            <button className="btn btn-quiet btn-small" onClick={undo} disabled={busy}>
              Change last answer
            </button>
          )}
          <a className="btn btn-quiet btn-small" href={href('/new?form=1')}>
            Use the form instead
          </a>
        </div>
      </div>
    </section>
  );
}

function Answer({ input, disabled, onAnswer }: { input: QuestionInput; disabled: boolean; onAnswer: (v: string) => void }) {
  const [text, setText] = useState('');

  if (input.kind === 'choice') {
    return (
      <div className="chips" role="group" aria-label="Choose an answer">
        {input.options.map((o) => (
          <button key={o.value} className={`chip${o.suggested ? ' chip-suggested' : ''}`} disabled={disabled} onClick={() => onAnswer(o.value)}>
            {o.label}
            {o.suggested && <span className="chip-note">suggested</span>}
          </button>
        ))}
      </div>
    );
  }

  const quick = input.kind === 'text' ? input.suggestions.map((s) => ({ label: s, value: s })) : input.kind === 'time' ? input.suggestions : input.quick;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim() || (input.kind === 'text' && input.skippable)) onAnswer(text);
  };

  return (
    <div className="stack">
      {quick.length > 0 && (
        <div className="chips" role="group" aria-label="Suggestions">
          {quick.map((o) => (
            <button key={o.value} className="chip" disabled={disabled} onClick={() => onAnswer(o.value)}>
              {o.label}
            </button>
          ))}
          {input.kind === 'text' && input.skippable && (
            <button className="chip chip-quiet" disabled={disabled} onClick={() => onAnswer('')}>
              Skip
            </button>
          )}
        </div>
      )}
      <form className="chat-form" onSubmit={submit}>
        {input.kind === 'text' ? (
          <input
            aria-label="Your answer"
            autoFocus
            value={text}
            maxLength={input.maxLength}
            placeholder={input.placeholder}
            onChange={(e) => setText(e.target.value)}
          />
        ) : (
          <input
            aria-label={input.kind === 'time' ? 'Pick a time' : 'Pick a date'}
            type={input.kind}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
        <button className="btn btn-primary btn-send" type="submit" disabled={disabled || !text.trim()} aria-label="Send">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function HabitSummary({ habit, today }: { habit: HabitInput; today: ISODate }) {
  const rows: [string, string][] = [
    ['Habit', habit.name],
    ['Schedule', habit.schedule_type === 'weekly' ? `${habit.weekly_target}× a week` : 'Every day'],
    ['Minimum', habit.minimum_version ?? '—'],
  ];
  if (habit.schedule_type === 'daily') rows.push(['Rest days', `${habit.rest_days_per_month} a month`]);
  const start = relativeDay(habit.start_date, today);
  rows.push(['Starts', start.charAt(0).toUpperCase() + start.slice(1)]);
  return (
    <dl className="card summary">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
