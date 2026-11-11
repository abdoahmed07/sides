import type { HabitStats } from '../lib/streak';

export function streakUnit(stats: HabitStats, n = stats.current): string {
  if (stats.unit === 'weeks') return n === 1 ? 'week' : 'weeks';
  return n === 1 ? 'day' : 'days';
}

/** The streak as the hero number, or a calm line when there is no chain yet. */
export function StreakLine({ stats, size = 'md' }: { stats: HabitStats; size?: 'md' | 'lg' }) {
  if (stats.current > 0) {
    return (
      <p className={`streak-line streak-${size}`}>
        <span className="streak-number">{stats.current}</span>
        <span className="streak-unit">{streakUnit(stats)}</span>
      </p>
    );
  }
  if (stats.best > 0) {
    return <p className={`streak-line streak-${size} muted`}>Fresh start. Best streak: {stats.best}</p>;
  }
  return (
    <p className={`streak-line streak-${size} muted`}>
      {stats.unit === 'weeks' ? 'Week one starts now' : 'Day one starts today'}
    </p>
  );
}
