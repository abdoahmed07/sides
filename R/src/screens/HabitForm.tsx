import { useEffect, useState, type FormEvent } from 'react';
import { SUGGESTED_HABITS } from '../config';
import { useData } from '../data/store';
import { isValidISODate } from '../lib/dates';
import { href, navigate } from '../lib/router';
import type { HabitInput } from '../lib/types';
import { useToday } from '../lib/useToday';

interface Props {
  habitId?: string;
  /** Index into SUGGESTED_HABITS to prefill a new habit. */
  suggestion?: string | null;
}

export function HabitForm({ habitId, suggestion }: Props) {
  const { habits, loadState, createHabit, updateHabit, archiveHabit } = useData();
  const today = useToday();
  const habit = habitId ? habits.find((h) => h.id === habitId) : undefined;

  const [form, setForm] = useState<HabitInput>(() => initial(suggestion, today));
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Fill the form once the habit being edited is available.
  useEffect(() => {
    if (habit && loadedId !== habit.id) {
      setForm({
        name: habit.name,
        schedule_type: habit.schedule_type,
        weekly_target: habit.weekly_target,
        minimum_version: habit.minimum_version,
        rest_days_per_month: habit.rest_days_per_month,
        start_date: habit.start_date,
      });
      setLoadedId(habit.id);
    }
  }, [habit, loadedId]);

  if (habitId && !habit) {
    return (
      <section className="screen">
        <p className="muted">{loadState === 'loading' ? 'Loading…' : 'This habit could not be found.'}</p>
        <a className="btn btn-quiet" href={href('/')}>
          Back to Today
        </a>
      </section>
    );
  }

  const set = <K extends keyof HabitInput>(k: K, v: HabitInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const weekly = form.schedule_type === 'weekly';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return setError('Give your habit a name.');
    if (!isValidISODate(form.start_date)) return setError('Pick a start date.');
    const input: HabitInput = {
      ...form,
      name,
      minimum_version: form.minimum_version?.trim() || null,
      weekly_target: weekly ? form.weekly_target ?? 3 : null,
      rest_days_per_month: weekly ? 0 : form.rest_days_per_month,
    };
    setBusy(true);
    setError(null);
    try {
      if (habit) {
        await updateHabit(habit.id, input);
        navigate(`/habit/${habit.id}`);
      } else {
        await createHabit(input);
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      setError('Could not save. Check your connection and try again.');
      setBusy(false);
    }
  }

  async function archive() {
    if (!habit) return;
    setBusy(true);
    try {
      await archiveHabit(habit.id);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Could not archive. Try again.');
      setBusy(false);
    }
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <a
          className="btn btn-quiet btn-back"
          href={href(habit ? `/habit/${habit.id}` : '/')}
          aria-label={habit ? `Back to ${habit.name}` : 'Back to Today'}
        >
          ‹ Back
        </a>
        <h1 className="screen-title">{habit ? 'Edit habit' : 'New habit'}</h1>
      </header>

      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input
            value={form.name}
            maxLength={80}
            placeholder="e.g. Read a page"
            autoFocus={!habit}
            required
            onChange={(e) => set('name', e.target.value)}
          />
        </label>

        <fieldset className="field">
          <legend>Schedule</legend>
          <div className="segmented" role="radiogroup" aria-label="Schedule">
            {(['daily', 'weekly'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={form.schedule_type === t}
                className="segment"
                onClick={() => setForm((f) => ({ ...f, schedule_type: t, weekly_target: f.weekly_target ?? 3 }))}
              >
                {t === 'daily' ? 'Every day' : 'Times per week'}
              </button>
            ))}
          </div>
          {weekly && (
            <Stepper
              label="Times per week"
              value={form.weekly_target ?? 3}
              min={1}
              max={7}
              onChange={(v) => set('weekly_target', v)}
              suffix={(v) => `${v}× a week`}
            />
          )}
        </fieldset>

        <label className="field">
          <span>Minimum version</span>
          <input
            value={form.minimum_version ?? ''}
            maxLength={140}
            placeholder="The smallest version that still counts"
            onChange={(e) => set('minimum_version', e.target.value)}
          />
          <small className="hint">On hard days, this is enough.</small>
        </label>

        {!weekly && (
          <div className="field">
            <span id="rest-label">Rest days per month</span>
            <Stepper
              label="Rest days per month"
              value={form.rest_days_per_month}
              min={0}
              max={10}
              onChange={(v) => set('rest_days_per_month', v)}
              suffix={(v) => (v === 0 ? 'None' : v === 1 ? '1 day' : `${v} days`)}
            />
            <small className="hint">Rest days keep your streak alive without adding to it.</small>
          </div>
        )}

        <label className="field">
          <span>Start date</span>
          <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
          <small className="hint">Nothing before this day counts.</small>
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {habit ? 'Save' : 'Add habit'}
        </button>
      </form>

      {habit && (
        <div className="archive-zone">
          {confirmArchive ? (
            <div className="stack">
              <p className="muted">Archive “{habit.name}”? It leaves Today. Its history is kept.</p>
              <div className="row">
                <button className="btn btn-danger" onClick={archive} disabled={busy}>
                  Archive
                </button>
                <button className="btn btn-quiet" onClick={() => setConfirmArchive(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-quiet" onClick={() => setConfirmArchive(true)}>
              Archive habit
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function initial(suggestion: string | null | undefined, today: string): HabitInput {
  const s = suggestion != null ? SUGGESTED_HABITS[Number(suggestion)] : undefined;
  return {
    name: s?.name ?? '',
    schedule_type: s?.schedule_type ?? 'daily',
    weekly_target: s?.weekly_target ?? null,
    minimum_version: s?.minimum_version ?? '',
    rest_days_per_month: s?.rest_days_per_month ?? 0,
    start_date: today,
  };
}

function Stepper(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix: (v: number) => string;
}) {
  const { label, value, min, max, onChange, suffix } = props;
  return (
    <div className="stepper">
      <button type="button" className="btn btn-icon" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output aria-live="polite" aria-label={label}>
        {suffix(value)}
      </output>
      <button type="button" className="btn btn-icon" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
