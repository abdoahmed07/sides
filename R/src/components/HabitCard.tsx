import { memo, useMemo, useRef, useState } from 'react';
import { useData } from '../data/store';
import { relativeDay, type ISODate } from '../lib/dates';
import { href } from '../lib/router';
import { computeStats } from '../lib/streak';
import type { Checkin, Habit } from '../lib/types';
import { DayActions } from './DayActions';
import { StreakLine } from './StreakLine';

interface Props {
  habit: Habit;
  entries: Checkin[];
  today: ISODate;
}

export const HabitCard = memo(function HabitCard({ habit, entries, today }: Props) {
  const { setCheckin } = useData();
  const [menuOpen, setMenuOpen] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const stats = useMemo(() => computeStats(habit, entries, today), [habit, entries, today]);
  const todayEntry = entries.find((e) => e.date === today);
  const done = todayEntry?.status === 'done';
  const notStarted = habit.start_date > today;
  const menuId = `menu-${habit.id}`;

  const toggle = () => setCheckin(habit.id, today, done ? null : 'done');

  return (
    <article
      className={`card habit-card${done ? ' is-done' : ''}${todayEntry && !done ? ' is-protected' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && menuOpen) {
          setMenuOpen(false);
          moreButton.current?.focus();
        }
      }}
    >
      <div className="habit-card-body">
        <div className="habit-main">
          <div className="habit-title-row">
            <a className="habit-name" href={href(`/habit/${habit.id}`)}>
              {habit.name}
            </a>
            <button
              ref={moreButton}
              className="btn btn-icon btn-more"
              aria-label={`More options for ${habit.name}`}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="6" cy="12" r="1.4" />
                <circle cx="12" cy="12" r="1.4" />
                <circle cx="18" cy="12" r="1.4" />
              </svg>
            </button>
          </div>

          {notStarted ? (
            <p className="streak-line muted">Starts {relativeDay(habit.start_date, today)}</p>
          ) : (
            <StreakLine stats={stats} />
          )}

          {habit.minimum_version && <p className="habit-min">{habit.minimum_version}</p>}

          <p className="habit-meta">
            {stats.thisWeek && (
              <span>
                {stats.thisWeek.count} of {stats.thisWeek.target} this week
              </span>
            )}
            {todayEntry?.status === 'rest' && (
              <span className="tag tag-rest">
                <span className="swatch swatch-rest" aria-hidden="true" />
                Rest day
              </span>
            )}
            {todayEntry?.status === 'excused' && (
              <span className="tag tag-excused">
                <span className="swatch swatch-excused" aria-hidden="true" />
                Excused{todayEntry.note ? `: ${todayEntry.note}` : ''}
              </span>
            )}
          </p>
        </div>

        {!notStarted && (
          <button
            className="check"
            aria-pressed={done}
            aria-label={done ? `Undo ${habit.name} for today` : `Mark ${habit.name} done for today`}
            onClick={toggle}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 12.5l4 4 8-9" />
            </svg>
          </button>
        )}
      </div>

      {menuOpen && (
        <div className="card-menu" id={menuId}>
          {!notStarted && (
            <DayActions habit={habit} entries={entries} day={today} showDone={false} onChange={() => setMenuOpen(false)} />
          )}
          <div className="row card-menu-links">
            <a className="btn btn-quiet btn-small" href={href(`/habit/${habit.id}`)}>
              Details and past days
            </a>
            <a className="btn btn-quiet btn-small" href={href(`/habit/${habit.id}/edit`)}>
              Edit habit
            </a>
          </div>
        </div>
      )}
    </article>
  );
});
