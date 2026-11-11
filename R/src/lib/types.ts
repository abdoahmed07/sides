import type { ISODate } from './dates';
import type { CheckinStatus, HabitRules } from './streak';

export interface Habit extends HabitRules {
  id: string;
  user_id: string;
  name: string;
  minimum_version: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface Checkin {
  id?: string;
  habit_id: string;
  date: ISODate;
  status: CheckinStatus;
  note: string | null;
}

/** Fields the habit form edits. */
export type HabitInput = Pick<
  Habit,
  'name' | 'schedule_type' | 'weekly_target' | 'minimum_version' | 'rest_days_per_month' | 'start_date'
>;
