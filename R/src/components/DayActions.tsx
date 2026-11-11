import { useState, type FormEvent } from 'react';
import { useData } from '../data/store';
import type { ISODate } from '../lib/dates';
import { canMarkRest, restDaysLeft } from '../lib/streak';
import type { Checkin, Habit } from '../lib/types';

interface Props {
  habit: Habit;
  entries: Checkin[];
  day: ISODate;
  /** Show a "Done" option (the Today card has its own check button instead). */
  showDone?: boolean;
  /** Called after a status was set or cleared. */
  onChange?: () => void;
}

/** The status options for one day: done, rest, excused (with a reason) or clear. */
export function DayActions({ habit, entries, day, showDone = true, onChange }: Props) {
  const { setCheckin } = useData();
  const entry = entries.find((e) => e.date === day);
  const [excusing, setExcusing] = useState(false);
  const [reason, setReason] = useState(entry?.status === 'excused' ? entry.note ?? '' : '');

  const daily = habit.schedule_type === 'daily';
  const restLeft = restDaysLeft(habit, entries, day);
  const restAllowed = canMarkRest(habit, entries, day);

  const set = (status: Checkin['status'] | null, note: string | null = null) => {
    setCheckin(habit.id, day, status, note);
    setExcusing(false);
    onChange?.();
  };

  function saveExcuse(e: FormEvent) {
    e.preventDefault();
    const note = reason.trim();
    if (note) set('excused', note);
  }

  if (excusing) {
    return (
      <form className="excuse-form" onSubmit={saveExcuse}>
        <label className="field">
          <span>What got in the way?</span>
          <input
            autoFocus
            maxLength={280}
            placeholder="e.g. sick, travelling"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={!reason.trim()}>
            Save as excused
          </button>
          <button className="btn btn-quiet" type="button" onClick={() => setExcusing(false)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="day-actions" role="group" aria-label="Set this day">
      {showDone && (
        <button className="action" aria-pressed={entry?.status === 'done'} onClick={() => set(entry?.status === 'done' ? null : 'done')}>
          <span className="swatch swatch-done" aria-hidden="true" />
          Done
        </button>
      )}
      {daily && (
        <button
          className="action"
          aria-pressed={entry?.status === 'rest'}
          disabled={!restAllowed}
          onClick={() => set(entry?.status === 'rest' ? null : 'rest')}
        >
          <span className="swatch swatch-rest" aria-hidden="true" />
          <span>
            Rest day
            <small>
              {entry?.status === 'rest'
                ? 'Tap to clear'
                : restLeft === 0
                  ? '0 rest days left this month'
                  : `${restLeft} left this month`}
            </small>
          </span>
        </button>
      )}
      <button className="action" aria-pressed={entry?.status === 'excused'} onClick={() => setExcusing(true)}>
        <span className="swatch swatch-excused" aria-hidden="true" />
        <span>
          Excused
          <small>{entry?.status === 'excused' && entry.note ? entry.note : 'Add a short reason'}</small>
        </span>
      </button>
      {entry && (
        <button className="action action-clear" onClick={() => set(null)}>
          <span className="swatch swatch-clear" aria-hidden="true" />
          Clear this day
        </button>
      )}
    </div>
  );
}
