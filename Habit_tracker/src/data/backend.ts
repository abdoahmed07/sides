import type { SupabaseClient } from '@supabase/supabase-js';
import type { ISODate } from '../lib/dates';
import type { Checkin, Habit, HabitInput } from '../lib/types';

/**
 * Where habits and check-ins are kept. The store only talks to this interface,
 * so the app works the same with an account (Supabase, synced) or without one
 * (this device only).
 */
export interface Backend {
  kind: 'account' | 'device';
  load(): Promise<{ habits: Habit[]; checkins: Checkin[] }>;
  /** Insert or replace the one entry for (habit_id, date). */
  saveCheckin(c: Omit<Checkin, 'id'>): Promise<Checkin>;
  removeCheckin(habitId: string, date: ISODate): Promise<void>;
  createHabit(input: HabitInput & { sort_order: number }): Promise<Habit>;
  updateHabit(id: string, patch: HabitPatch): Promise<Habit>;
}

export type HabitPatch = Partial<HabitInput> & { archived_at?: string | null };

const byOrder = (a: Habit, b: Habit) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

/* ---------- Account: Supabase ---------- */

const PAGE = 1000;
const CHECKIN_COLUMNS = 'id, habit_id, date, status, note';

export function supabaseBackend(db: SupabaseClient): Backend {
  return {
    kind: 'account',
    async load() {
      const { data: habits, error: he } = await db.from('habits').select('*').order('sort_order').order('created_at');
      if (he) throw he;
      const checkins: Checkin[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db
          .from('checkins')
          .select(CHECKIN_COLUMNS)
          .order('date')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        checkins.push(...(data as Checkin[]));
        if (!data || data.length < PAGE) break;
      }
      return { habits: habits as Habit[], checkins };
    },
    async saveCheckin(c) {
      const { data, error } = await db
        .from('checkins')
        .upsert(c, { onConflict: 'habit_id,date' })
        .select(CHECKIN_COLUMNS)
        .single();
      if (error) throw error;
      return data as Checkin;
    },
    async removeCheckin(habitId, date) {
      const { error } = await db.from('checkins').delete().eq('habit_id', habitId).eq('date', date);
      if (error) throw error;
    },
    async createHabit(input) {
      const { data, error } = await db.from('habits').insert(input).select('*').single();
      if (error) throw error;
      return data as Habit;
    },
    async updateHabit(id, patch) {
      const { data, error } = await db.from('habits').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      return data as Habit;
    },
  };
}

/* ---------- No account: this device only ---------- */

export const DEVICE_STORAGE_KEY = 'streak.device.v1';
export const DEVICE_USER_ID = 'device';

interface DeviceData {
  habits: Habit[];
  checkins: Checkin[];
}

/** The parts of `Storage` the device backend needs (so tests can pass a fake). */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * Keeps everything in this browser's storage. Nothing leaves the device and
 * nothing syncs to other devices.
 */
export function deviceBackend(store?: KeyValueStore, now: () => Date = () => new Date()): Backend {
  // Resolved on use: touching localStorage can throw where storage is blocked.
  const kv = () => store ?? localStorage;
  const read = (): DeviceData => {
    const raw = kv().getItem(DEVICE_STORAGE_KEY);
    if (!raw) return { habits: [], checkins: [] };
    const data = JSON.parse(raw) as Partial<DeviceData>; // a corrupt value throws, so it is never overwritten
    return { habits: data.habits ?? [], checkins: data.checkins ?? [] };
  };
  // setItem throws when storage is full or blocked; the store then keeps the tap queued.
  const write = (d: DeviceData) => kv().setItem(DEVICE_STORAGE_KEY, JSON.stringify(d));

  return {
    kind: 'device',
    async load() {
      const d = read();
      return { habits: [...d.habits].sort(byOrder), checkins: d.checkins };
    },
    async saveCheckin(c) {
      const d = read();
      if (!d.habits.some((h) => h.id === c.habit_id)) throw new Error('Unknown habit');
      const existing = d.checkins.find((x) => x.habit_id === c.habit_id && x.date === c.date);
      const row: Checkin = { id: existing?.id ?? newId(), habit_id: c.habit_id, date: c.date, status: c.status, note: c.note };
      write({ ...d, checkins: [...d.checkins.filter((x) => x !== existing), row] });
      return row;
    },
    async removeCheckin(habitId, date) {
      const d = read();
      write({ ...d, checkins: d.checkins.filter((x) => !(x.habit_id === habitId && x.date === date)) });
    },
    async createHabit(input) {
      const d = read();
      const habit: Habit = {
        ...input,
        id: newId(),
        user_id: DEVICE_USER_ID,
        archived_at: null,
        created_at: now().toISOString(),
      };
      write({ ...d, habits: [...d.habits, habit] });
      return habit;
    },
    async updateHabit(id, patch) {
      const d = read();
      const current = d.habits.find((h) => h.id === id);
      if (!current) throw new Error('Unknown habit');
      const updated: Habit = { ...current, ...patch };
      write({ ...d, habits: d.habits.map((h) => (h.id === id ? updated : h)) });
      return updated;
    },
  };
}
