import { Heatmap, stateLabel } from '../components/Heatmap';
import { StreakLine } from '../components/StreakLine';
import { useData } from '../data/store';
import { addDays, shortDate, type ISODate } from '../lib/dates';
import { href } from '../lib/router';
import { computeStats, dayState } from '../lib/streak';
import type { Checkin, Habit } from '../lib/types';
import { useToday } from '../lib/useToday';

export function Overview() {
  const { loadState, activeHabits, habits, checkinsByHabit, refresh } = useData();
  const today = useToday();
  const archived = habits.filter((h) => h.archived_at);

  return (
    <section className="screen">
      <header className="screen-header">
        <h1 className="screen-title">Overview</h1>
      </header>

      {loadState === 'loading' && <OverviewSkeleton />}
      {loadState === 'error' && (
        <div className="card stack">
          <p>Couldn’t load your habits.</p>
          <button className="btn btn-quiet" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      )}
      {loadState === 'ready' && activeHabits.length === 0 && (
        <p className="muted">
          No habits yet. <a href={href('/new')}>Add your first one.</a>
        </p>
      )}

      <ul className="overview-list">
        {activeHabits.map((h) => (
          <li key={h.id}>
            <OverviewRow habit={h} entries={checkinsByHabit.get(h.id) ?? []} today={today} />
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <details className="archived">
          <summary>Archived ({archived.length})</summary>
          <ul className="archived-list">
            {archived.map((h) => (
              <li key={h.id}>
                <a href={href(`/habit/${h.id}`)}>{h.name}</a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function OverviewRow({ habit, entries, today }: { habit: Habit; entries: Checkin[]; today: ISODate }) {
  const stats = computeStats(habit, entries, today);
  const byDate = new Map(entries.map((e) => [e.date, e.status]));
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const summary = last7.map((d) => `${shortDate(d)} ${stateLabel(dayState(habit, byDate.get(d), d, today))}`).join(', ');

  return (
    <a className="card overview-row" href={href(`/habit/${habit.id}`)}>
      <div className="overview-info">
        <h2 className="habit-name">{habit.name}</h2>
        <StreakLine stats={stats} />
        <div className="dots" role="img" aria-label={`Last 7 days: ${summary}`}>
          {last7.map((d) => (
            <span key={d} className={`dot cell-${dayState(habit, byDate.get(d), d, today)}`} />
          ))}
        </div>
      </div>
      <Heatmap habit={habit} entries={entries} today={today} size="sm" />
    </a>
  );
}

function OverviewSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card skeleton" style={{ height: 150 }} />
      ))}
    </div>
  );
}
