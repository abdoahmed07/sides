import { useLayoutEffect, useMemo, useRef } from 'react';
import { addDays, daysBetween, monthAbbr, shortDate, weekStart, type ISODate } from '../lib/dates';
import { dayState, type CheckinStatus, type DayState } from '../lib/streak';
import type { Checkin, Habit } from '../lib/types';

const STATE_LABEL: Record<DayState, string> = {
  done: 'done',
  rest: 'rest day',
  excused: 'excused',
  rescued: 'rescued',
  missed: 'nothing logged',
  open: 'not logged yet',
  future: 'upcoming',
  before: 'before start',
};

export const stateLabel = (s: DayState) => STATE_LABEL[s];

interface Props {
  habit: Habit;
  entries: Checkin[];
  today: ISODate;
  /** `lg`: interactive, scrolls back through all history. `sm`: last 12 weeks, display only. */
  size?: 'lg' | 'sm';
  selected?: ISODate | null;
  onSelect?: (day: ISODate) => void;
}

const VISIBLE_WEEKS = 12;
const MAX_WEEKS = 156; // three years of scroll-back

/** One rounded square per day, a column per Monday–Sunday week, newest on the right. */
export function Heatmap({ habit, entries, today, size = 'lg', selected, onSelect }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const byDate = useMemo(() => new Map<ISODate, CheckinStatus>(entries.map((e) => [e.date, e.status])), [entries]);

  const weeks = useMemo(() => {
    const lastMonday = weekStart(today);
    let firstMonday = addDays(lastMonday, -7 * (VISIBLE_WEEKS - 1));
    if (size === 'lg') {
      const startMonday = weekStart(habit.start_date);
      if (startMonday < firstMonday) firstMonday = startMonday;
      if (daysBetween(firstMonday, lastMonday) / 7 >= MAX_WEEKS) firstMonday = addDays(lastMonday, -7 * (MAX_WEEKS - 1));
    }
    const cols: ISODate[][] = [];
    for (let m = firstMonday; m <= lastMonday; m = addDays(m, 7)) {
      cols.push(Array.from({ length: 7 }, (_, i) => addDays(m, i)));
    }
    return cols;
  }, [habit.start_date, today, size]);

  // Start scrolled to the newest week, and stay there on resize until the user scrolls back.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let pinned = true;
    const toEnd = () => {
      if (pinned) el.scrollLeft = el.scrollWidth;
    };
    const onScroll = () => {
      pinned = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    };
    toEnd();
    const ro = new ResizeObserver(toEnd);
    ro.observe(el);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
    };
  }, [weeks.length]);

  const interactive = size === 'lg' && !!onSelect;

  return (
    <div className={`heatmap heatmap-${size}`}>
      {size === 'lg' && (
        <div className="heatmap-days" aria-hidden="true">
          <span>M</span>
          <span />
          <span>W</span>
          <span />
          <span>F</span>
          <span />
          <span>S</span>
        </div>
      )}
      <div className="heatmap-scroll" ref={scroller}>
        {size === 'lg' && (
          <div className="heatmap-months" aria-hidden="true">
            {weeks.map((col) => {
              const first = col.find((d) => d.endsWith('-01'));
              return <span key={col[0]}>{first ? monthAbbr(Number(first.slice(5, 7))) : ''}</span>;
            })}
          </div>
        )}
        <div
          className="heatmap-grid"
          role={interactive ? 'group' : 'img'}
          aria-label={interactive ? 'Calendar. Choose a day to change it.' : `${habit.name}: last 12 weeks`}
        >
          {weeks.flat().map((day) => {
            const state = dayState(habit, byDate.get(day), day, today);
            const cls = `cell cell-${state}${day === today ? ' cell-today' : ''}${day === selected ? ' cell-selected' : ''}`;
            if (!interactive) return <span key={day} className={cls} />;
            const selectable = state !== 'future' && state !== 'before';
            return (
              <button
                key={day}
                className={cls}
                disabled={!selectable}
                aria-pressed={day === selected}
                aria-label={`${shortDate(day)}: ${stateLabel(state)}`}
                title={`${shortDate(day)}: ${stateLabel(state)}`}
                onClick={() => onSelect?.(day)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Small key for the heatmap colours and markers. */
export function HeatmapLegend({ weekly }: { weekly: boolean }) {
  return (
    <ul className="legend" aria-label="Key">
      <li>
        <span className="cell cell-done" aria-hidden="true" /> Done
      </li>
      {!weekly && (
        <li>
          <span className="cell cell-rest" aria-hidden="true" /> Rest
        </li>
      )}
      <li>
        <span className="cell cell-excused" aria-hidden="true" /> Excused
      </li>
      <li>
        <span className="cell cell-missed" aria-hidden="true" /> Not logged
      </li>
    </ul>
  );
}
