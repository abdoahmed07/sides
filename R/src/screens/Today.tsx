import { APP_NAME, SUGGESTED_HABITS } from '../config';
import { HabitCard } from '../components/HabitCard';
import { clearSnapshot, useData } from '../data/store';
import { formatLongDate } from '../lib/dates';
import { href } from '../lib/router';
import { supabase } from '../lib/supabase';
import { useToday } from '../lib/useToday';

export function Today() {
  const { loadState, activeHabits, checkinsByHabit, refresh, failedCount, syncingCount } = useData();
  const today = useToday();

  async function signOut() {
    const unsynced = failedCount + syncingCount;
    if (unsynced > 0 && !window.confirm(`${unsynced} check-in(s) haven’t synced yet. They’ll sync next time you sign in on this device. Sign out anyway?`)) {
      return;
    }
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    if (data.session) clearSnapshot(data.session.user.id);
    await supabase?.auth.signOut();
  }

  return (
    <section className="screen">
      <header className="today-header">
        <div>
          <p className="eyebrow">{APP_NAME}</p>
          <h1 className="screen-title">{formatLongDate(today)}</h1>
        </div>
        <button className="btn btn-quiet btn-small" onClick={signOut}>
          Sign out
        </button>
      </header>

      {loadState === 'loading' && (
        <div className="stack" aria-busy="true" aria-label="Loading your habits">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton" style={{ height: 128 }} />
          ))}
        </div>
      )}

      {loadState === 'error' && (
        <div className="card stack">
          <p>Couldn’t load your habits.</p>
          <button className="btn btn-quiet" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && activeHabits.length === 0 && (
        <div className="empty stack">
          <h2>Start with one small habit.</h2>
          <p className="muted">Pick one to begin, or make your own.</p>
          <div className="suggestions">
            {SUGGESTED_HABITS.map((s, i) => (
              <a key={s.name} className="suggestion" href={href(`/new?s=${i}`)}>
                <span>{s.name}</span>
                <small className="muted">{s.minimum_version}</small>
              </a>
            ))}
          </div>
          <a className="btn btn-primary" href={href('/new')}>
            Add your own habit
          </a>
        </div>
      )}

      {loadState === 'ready' && activeHabits.length > 0 && (
        <ul className="habit-list">
          {activeHabits.map((h) => (
            <li key={h.id}>
              <HabitCard habit={h} entries={checkinsByHabit.get(h.id) ?? []} today={today} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
