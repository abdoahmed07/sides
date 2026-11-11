/** Placeholder product name. Rename the app here. */
export const APP_NAME = 'Streak';

/** How many days back a check-in can be added or changed (today not included). */
export const BACKFILL_DAYS = 7;

/** Average days to automaticity from Lally et al. (2009). An average that varies, not a promise. */
export const MILESTONE_DAYS = 66;

/** Suggestions shown to a new user with no habits yet. */
export const SUGGESTED_HABITS = [
  {
    name: 'Gym',
    schedule_type: 'weekly',
    weekly_target: 4,
    minimum_version: 'Put on gym clothes and shoes',
    rest_days_per_month: 0,
  },
  {
    name: 'Read a page',
    schedule_type: 'daily',
    weekly_target: null,
    minimum_version: 'Read one page',
    rest_days_per_month: 2,
  },
  {
    name: 'Wake up early',
    schedule_type: 'daily',
    weekly_target: null,
    minimum_version: 'Out of bed by the target time',
    rest_days_per_month: 2,
  },
] as const;
