import { useMemo, useState } from 'react';
import { DayActions } from '../components/DayActions';
import { Heatmap, HeatmapLegend, stateLabel } from '../components/Heatmap';
import { StreakLine, streakUnit } from '../components/StreakLine';
import { BACKFILL_DAYS, MILESTONE_DAYS } from '../config';
import { useData } from '../data/store';
import { shortDate, type ISODate } from '../lib/dates';
import { href } from '../lib/router';
import { canEditDay, computeStats, dayState, type HabitStats } from '../lib/streak';
import { useToday } from '../lib/useToday';

export function HabitDetail({ habitId }: { habitId: string }) {
  const { habits, loadState, checkinsByHabit } = useData();
  const today = useToday();
  const habit = habits.find((h) => h.id === habitId);
  const entries = checkinsByHabit.get(habitId) ?? [];
  const [selected, setSelected] = useState<ISODate>(today);
  const stats = useMemo(() => (habit ? computeStats(habit, entries, today) : null), [habit, entries, today]);

  if (!habit || !stats) {
    return (
      <section className="screen">
        <p className="muted">{loadState === 'loading' ? 'Loading…' : 'This habit could not be found.'}</p>
        <a className="btn btn-quiet" href={href('/')}>
          Back to Today
        </a>
      </section>
    );
  }

  const weekly = habit.schedule_type === 'weekly';
  const selectedEntry = entries.find((e) => e.date === selected);
  const selectedState = dayState(habit, selectedEntry?.status, selected, today);
  const editable = canEditDay(habit, selected, today);

  return (
    <section className="screen">
      <header className="screen-header">
        <a className="btn btn-quiet btn-back" href={href('/')} aria-label="Back to Today">
          ‹ Back
        </a>
        <h1 className="screen-title detail-title">{habit.name}</h1>
        <a className="btn btn-quiet btn-small" href={href(`/habit/${habit.id}/edit`)}>
          Edit
        </a>
      </header>

      {habit.archived_at && <p className="notice">This habit is archived. Its history is kept here.</p>}

      <div className="detail-hero">
        <StreakLine stats={stats} size="lg" />
        {habit.minimum_version && <p className="muted">Minimum: {habit.minimum_version}</p>}
      </div>

      <dl className="stat-row">
        <div>
          <dt>Best streak</dt>
          <dd>
            {stats.best} <span>{streakUnit(stats, stats.best)}</span>
          </dd>
        </div>
        <div>
          <dt>Total done</dt>
          <dd>
            {stats.totalDone} <span>{stats.totalDone === 1 ? 'day' : 'days'}</span>
          </dd>
        </div>
        {stats.thisWeek && (
          <div>
            <dt>This week</dt>
            <dd>
              {stats.thisWeek.count} <span>of {stats.thisWeek.target}</span>
            </dd>
          </div>
        )}
      </dl>

      <Milestone stats={stats} />

      <div className="card stack">
        <Heatmap habit={habit} entries={entries} today={today} selected={selected} onSelect={setSelected} />
        <HeatmapLegend weekly={weekly} />
      </div>

      <div className="card stack day-panel" aria-live="polite">
        <h2 className="day-panel-title">
          {selected === today ? 'Today' : shortDate(selected)}
          <span className="muted"> · {stateLabel(selectedState)}</span>
        </h2>
        {selectedEntry?.status === 'excused' && selectedEntry.note && <p className="muted">“{selectedEntry.note}”</p>}
        {editable ? (
          <DayActions key={selected} habit={habit} entries={entries} day={selected} />
        ) : (
          <p className="muted">
            Days more than {BACKFILL_DAYS} days back are kept as they are.
          </p>
        )}
      </div>
    </section>
  );
}

function Milestone({ stats }: { stats: HabitStats }) {
  const weekly = stats.unit === 'weeks';
  const progress = MILESTONE_DAYS - stats.toMilestone;
  const pct = Math.min(100, Math.round((progress / MILESTONE_DAYS) * 100));
  const what = weekly ? 'sessions' : 'days';
  const label =
    stats.toMilestone === 0
      ? `Past ${MILESTONE_DAYS} ${what}.`
      : progress === 0
        ? `${MILESTONE_DAYS} ${what} is the first milestone`
        : `${stats.toMilestone} ${what} to ${MILESTONE_DAYS}`;
  return (
    <div className="milestone">
      <p>{label}</p>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={MILESTONE_DAYS} aria-valuenow={progress} aria-label={label}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="hint">
        {MILESTONE_DAYS} days is a research average for a habit to feel automatic. It varies a lot from person to person.
      </p>
    </div>
  );
}
