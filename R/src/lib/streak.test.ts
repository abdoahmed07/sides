import { describe, expect, it } from 'vitest';
import { addDays, weekStart, localISODate } from './dates';
import { canEditDay, canMarkRest, computeStats, restDaysLeft, type Entry, type HabitRules } from './streak';

const daily = (over: Partial<HabitRules> = {}): HabitRules => ({
  schedule_type: 'daily',
  weekly_target: null,
  rest_days_per_month: 2,
  start_date: '2026-01-01',
  ...over,
});

const weekly = (target: number, over: Partial<HabitRules> = {}): HabitRules => ({
  schedule_type: 'weekly',
  weekly_target: target,
  rest_days_per_month: 0,
  start_date: '2026-01-05', // a Monday
  ...over,
});

/** `n` consecutive entries starting at `from`. */
const run = (from: string, n: number, status: Entry['status'] = 'done'): Entry[] =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(from, i), status }));

describe('streak module: required cases', () => {
  it('1. seven consecutive done days gives a streak of 7', () => {
    const s = computeStats(daily(), run('2026-03-01', 7), '2026-03-07');
    expect(s.current).toBe(7);
    expect(s.best).toBe(7);
    expect(s.totalDone).toBe(7);
  });

  it('2. one missed past day resets the current streak but keeps the best', () => {
    // 1–5 done, 6 missed, 7–8 done
    const entries = [...run('2026-03-01', 5), ...run('2026-03-07', 2)];
    const s = computeStats(daily({ start_date: '2026-03-01' }), entries, '2026-03-08');
    expect(s.current).toBe(2);
    expect(s.best).toBe(5);
  });

  it('3. today not yet logged does not break the streak', () => {
    const s = computeStats(daily(), run('2026-03-01', 7), '2026-03-08');
    expect(s.current).toBe(7);
    // …but once today has fully passed with no entry, it does.
    expect(computeStats(daily(), run('2026-03-01', 7), '2026-03-09').current).toBe(0);
  });

  it('4. a rest day in the middle keeps the chain alive and does not add to it', () => {
    const entries = [...run('2026-03-01', 3), { date: '2026-03-04', status: 'rest' as const }, ...run('2026-03-05', 3)];
    const s = computeStats(daily({ start_date: '2026-03-01' }), entries, '2026-03-07');
    expect(s.current).toBe(6);
  });

  it('5. an excused day does the same', () => {
    const entries = [...run('2026-03-01', 3), { date: '2026-03-04', status: 'excused' as const }, ...run('2026-03-05', 3)];
    const s = computeStats(daily({ start_date: '2026-03-01' }), entries, '2026-03-07');
    expect(s.current).toBe(6);
    expect(s.totalDone).toBe(6);
  });

  it('6. rest allowance is per habit per calendar month and resets on the 1st', () => {
    const rules = daily({ rest_days_per_month: 2, start_date: '2026-03-01' });
    const twoRests: Entry[] = [
      { date: '2026-03-10', status: 'rest' },
      { date: '2026-03-20', status: 'rest' },
    ];
    expect(restDaysLeft(rules, twoRests, '2026-03-25')).toBe(0);
    expect(canMarkRest(rules, twoRests, '2026-03-25')).toBe(false);
    expect(canMarkRest(rules, twoRests, '2026-03-20')).toBe(true); // already a rest day
    // April 1st: fresh allowance
    expect(restDaysLeft(rules, twoRests, '2026-04-01')).toBe(2);
    expect(canMarkRest(rules, twoRests, '2026-04-01')).toBe(true);
    // Another habit's rests never count (each habit passes only its own entries).
    expect(restDaysLeft(rules, [], '2026-03-25')).toBe(2);

    // A rest day beyond the allowance (e.g. allowance lowered later) counts as a miss.
    const entries: Entry[] = [
      ...run('2026-03-01', 2),
      { date: '2026-03-03', status: 'rest' },
      { date: '2026-03-04', status: 'rest' },
      ...run('2026-03-05', 2),
    ];
    expect(computeStats({ ...rules, rest_days_per_month: 2 }, entries, '2026-03-06').current).toBe(4);
    expect(computeStats({ ...rules, rest_days_per_month: 1 }, entries, '2026-03-06').current).toBe(2);

    // Rest allowance on the last day of one month and the first of the next both count.
    const across: Entry[] = [
      ...run('2026-03-29', 2),
      { date: '2026-03-31', status: 'rest' },
      { date: '2026-04-01', status: 'rest' },
      ...run('2026-04-02', 1),
    ];
    expect(computeStats(daily({ rest_days_per_month: 1, start_date: '2026-03-29' }), across, '2026-04-02').current).toBe(3);
  });

  it('7. weekly target 4: met at 4 done days, broken at 3', () => {
    const rules = weekly(4);
    // Week 1 (Jan 5–11): 4 done. Week 2 (Jan 12–18): 4 done.
    const met = [...run('2026-01-05', 4), ...run('2026-01-12', 4)];
    expect(computeStats(rules, met, '2026-01-19').current).toBe(2);

    // Week 2 with only 3 done breaks the chain once the week is over.
    const broken = [...run('2026-01-05', 4), ...run('2026-01-12', 3)];
    const s = computeStats(rules, broken, '2026-01-19');
    expect(s.current).toBe(0);
    expect(s.best).toBe(1);

    // In-progress week: not yet met → shows as of last week; met → counts.
    expect(computeStats(rules, [...run('2026-01-05', 4), ...run('2026-01-12', 2)], '2026-01-14').current).toBe(1);
    const inProgress = computeStats(rules, [...run('2026-01-05', 4), ...run('2026-01-12', 4)], '2026-01-15');
    expect(inProgress.current).toBe(2);
    expect(inProgress.thisWeek).toEqual({ count: 4, target: 4 });

    // Excused counts toward the target; rest does not.
    const withExcused = [...run('2026-01-05', 3), { date: '2026-01-08', status: 'excused' as const }];
    expect(computeStats(rules, withExcused, '2026-01-12').current).toBe(1);
    const withRest = [...run('2026-01-05', 3), { date: '2026-01-08', status: 'rest' as const }];
    expect(computeStats(rules, withRest, '2026-01-12').current).toBe(0);
  });

  it('8. Sunday night to Monday is a week boundary in local time', () => {
    expect(weekStart('2026-01-11')).toBe('2026-01-05'); // Sunday belongs to the week before
    expect(weekStart('2026-01-12')).toBe('2026-01-12'); // Monday starts a new week

    // 23:59 Sunday and 00:01 Monday on this device are different weeks, whatever the timezone.
    const sundayNight = localISODate(new Date(2026, 0, 11, 23, 59));
    const mondayMorning = localISODate(new Date(2026, 0, 12, 0, 1));
    expect(sundayNight).toBe('2026-01-11');
    expect(mondayMorning).toBe('2026-01-12');

    const rules = weekly(2);
    // Done on Saturday + Sunday night → week 1 met. Done Monday → counts for week 2.
    const entries: Entry[] = [
      { date: '2026-01-10', status: 'done' },
      { date: sundayNight, status: 'done' },
      { date: mondayMorning, status: 'done' },
    ];
    const s = computeStats(rules, entries, mondayMorning);
    expect(s.current).toBe(1);
    expect(s.thisWeek).toEqual({ count: 1, target: 2 });
  });

  it('9. month boundary, leap day and year boundary', () => {
    // Month boundary: Jan 30 → Feb 2
    expect(computeStats(daily({ start_date: '2026-01-30' }), run('2026-01-30', 4), '2026-02-02').current).toBe(4);

    // Leap day: Feb 27 2028 → Mar 1 2028 is 4 days, including Feb 29.
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    const leap = run('2028-02-27', 4);
    expect(leap.map((e) => e.date)).toContain('2028-02-29');
    expect(computeStats(daily({ start_date: '2028-02-27' }), leap, '2028-03-01').current).toBe(4);
    // Non-leap year: Feb 28 → Mar 1
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');

    // Year boundary, daily: Dec 30 → Jan 2
    expect(computeStats(daily({ start_date: '2026-12-30' }), run('2026-12-30', 4), '2027-01-02').current).toBe(4);

    // Year boundary, weekly: the week of Mon Dec 28 2026 runs to Sun Jan 3 2027.
    expect(weekStart('2027-01-03')).toBe('2026-12-28');
    const rules = weekly(2, { start_date: '2026-12-21' });
    const entries = [...run('2026-12-21', 2), { date: '2026-12-31', status: 'done' as const }, { date: '2027-01-02', status: 'done' as const }];
    expect(computeStats(rules, entries, '2027-01-04').current).toBe(2);
  });

  it('10. backfilling a missed day repairs the chain', () => {
    const rules = daily({ start_date: '2026-03-01' });
    const withGap = [...run('2026-03-01', 3), ...run('2026-03-05', 3)];
    expect(computeStats(rules, withGap, '2026-03-07').current).toBe(3);
    const backfilled = [...withGap, { date: '2026-03-04', status: 'done' as const }];
    const s = computeStats(rules, backfilled, '2026-03-07');
    expect(s.current).toBe(7);
    expect(s.best).toBe(7);
  });
});

describe('streak module: other rules', () => {
  it('ignores entries before start_date and in the future', () => {
    const entries = [...run('2026-02-25', 10)]; // Feb 25 – Mar 6
    const s = computeStats(daily({ start_date: '2026-03-01' }), entries, '2026-03-04');
    expect(s.current).toBe(4);
    expect(s.totalDone).toBe(4);
  });

  it('a habit starting today shows 0 and is not broken', () => {
    expect(computeStats(daily({ start_date: '2026-03-04' }), [], '2026-03-04').current).toBe(0);
  });

  it('first week target is capped at the days available', () => {
    // Starts Saturday Jan 10 with target 4: 2 days available, both done → met.
    const s = computeStats(weekly(4, { start_date: '2026-01-10' }), run('2026-01-10', 2), '2026-01-12');
    expect(s.current).toBe(1);
  });

  it('changing the schedule recomputes from history', () => {
    const entries = [...run('2026-01-05', 3), ...run('2026-01-12', 3)];
    expect(computeStats(weekly(4), entries, '2026-01-19').current).toBe(0);
    expect(computeStats(weekly(3), entries, '2026-01-19').current).toBe(2);
  });

  it('backfill window is 7 days and never before start or after today', () => {
    const rules = daily({ start_date: '2026-01-01' });
    expect(canEditDay(rules, '2026-03-10', '2026-03-10')).toBe(true);
    expect(canEditDay(rules, '2026-03-03', '2026-03-10')).toBe(true);
    expect(canEditDay(rules, '2026-03-02', '2026-03-10')).toBe(false);
    expect(canEditDay(rules, '2026-03-11', '2026-03-10')).toBe(false);
    expect(canEditDay(daily({ start_date: '2026-03-08' }), '2026-03-07', '2026-03-10')).toBe(false);
  });

  it('milestone counts toward 66', () => {
    expect(computeStats(daily(), run('2026-03-01', 54), '2026-04-23').toMilestone).toBe(12);
  });
});
