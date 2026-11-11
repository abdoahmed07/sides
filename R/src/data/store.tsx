import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ISODate } from '../lib/dates';
import type { CheckinStatus } from '../lib/streak';
import { supabase } from '../lib/supabase';
import type { Checkin, Habit, HabitInput } from '../lib/types';

/**
 * Client data layer. Check-ins are optimistic: a tap updates the screen at once,
 * is queued (and saved to this device) and then synced. A failed sync stays
 * queued until it succeeds, so a tap is never lost.
 */

interface PendingOp {
  habit_id: string;
  date: ISODate;
  /** null = remove the entry */
  status: CheckinStatus | null;
  note: string | null;
  seq: number;
  failed: boolean;
}

type LoadState = 'loading' | 'ready' | 'error';

interface DataContextValue {
  loadState: LoadState;
  habits: Habit[];
  activeHabits: Habit[];
  /** Effective check-ins (server + not yet synced), per habit. */
  checkinsByHabit: Map<string, Checkin[]>;
  failedCount: number;
  syncingCount: number;
  refresh: () => Promise<void>;
  setCheckin: (habitId: string, date: ISODate, status: CheckinStatus | null, note?: string | null) => void;
  retryFailed: () => void;
  createHabit: (input: HabitInput) => Promise<Habit>;
  updateHabit: (id: string, patch: Partial<HabitInput>) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const key = (habitId: string, date: ISODate) => `${habitId}|${date}`;
const storageKey = (userId: string) => `streak.pending.${userId}`;
const PAGE = 1000;

function loadPending(userId: string): Map<string, PendingOp> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Map();
    const ops = JSON.parse(raw) as PendingOp[];
    return new Map(ops.map((op) => [key(op.habit_id, op.date), { ...op, failed: false }]));
  } catch {
    return new Map();
  }
}

function savePending(userId: string, m: Map<string, PendingOp>) {
  try {
    if (m.size === 0) localStorage.removeItem(storageKey(userId));
    else localStorage.setItem(storageKey(userId), JSON.stringify([...m.values()]));
  } catch {
    // storage unavailable: the queue still lives in memory for this session
  }
}

/**
 * Last data loaded on this device, so Today opens instantly (and offline).
 * It is replaced by fresh data as soon as the network answers.
 */
interface Snapshot {
  habits: Habit[];
  checkins: Checkin[];
}

const snapshotKey = (userId: string) => `streak.cache.${userId}`;

function loadSnapshot(userId: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(snapshotKey(userId));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

function saveSnapshot(userId: string, s: Snapshot) {
  try {
    localStorage.setItem(snapshotKey(userId), JSON.stringify(s));
  } catch {
    // storage full or blocked: the app still works, just without the instant start
  }
}

/** Remove this device's cached copy of a user's data (on sign out). */
export function clearSnapshot(userId: string) {
  try {
    localStorage.removeItem(snapshotKey(userId));
  } catch {
    // ignore
  }
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export function DataProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [snapshot] = useState(() => loadSnapshot(userId));
  const [loadState, setLoadState] = useState<LoadState>(snapshot ? 'ready' : 'loading');
  const [habits, setHabits] = useState<Habit[]>(snapshot?.habits ?? []);
  const [server, setServer] = useState<Map<string, Checkin>>(
    () => new Map((snapshot?.checkins ?? []).map((c) => [key(c.habit_id, c.date), c])),
  );
  const [pending, setPending] = useState<Map<string, PendingOp>>(() => loadPending(userId));
  const pendingRef = useRef(pending);
  const inFlight = useRef(new Set<string>());
  const seq = useRef(Date.now());

  const updatePending = useCallback(
    (fn: (m: Map<string, PendingOp>) => void) => {
      const next = new Map(pendingRef.current);
      fn(next);
      pendingRef.current = next;
      setPending(next);
      savePending(userId, next);
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    try {
      const { data: h, error: he } = await db()
        .from('habits')
        .select('*')
        .order('sort_order')
        .order('created_at');
      if (he) throw he;

      const rows: Checkin[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db()
          .from('checkins')
          .select('id, habit_id, date, status, note')
          .order('date')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data as Checkin[]));
        if (!data || data.length < PAGE) break;
      }

      setHabits(h as Habit[]);
      setServer(new Map(rows.map((c) => [key(c.habit_id, c.date), c])));
      setLoadState('ready');
    } catch (e) {
      console.error(e);
      setLoadState((s) => (s === 'ready' ? s : 'error'));
    }
  }, []);

  // Keep the on-device snapshot current with the latest server data.
  useEffect(() => {
    if (loadState !== 'ready') return;
    const id = window.setTimeout(() => saveSnapshot(userId, { habits, checkins: [...server.values()] }), 300);
    return () => window.clearTimeout(id);
  }, [userId, loadState, habits, server]);

  const flush = useCallback(
    async (k: string) => {
      if (inFlight.current.has(k)) return; // re-checked when the current request ends
      const op = pendingRef.current.get(k);
      if (!op) return;
      inFlight.current.add(k);
      try {
        if (op.status === null) {
          const { error } = await db().from('checkins').delete().eq('habit_id', op.habit_id).eq('date', op.date);
          if (error) throw error;
          setServer((m) => {
            const next = new Map(m);
            next.delete(k);
            return next;
          });
        } else {
          const { data, error } = await db()
            .from('checkins')
            .upsert({ habit_id: op.habit_id, date: op.date, status: op.status, note: op.note }, { onConflict: 'habit_id,date' })
            .select('id, habit_id, date, status, note')
            .single();
          if (error) throw error;
          setServer((m) => new Map(m).set(k, data as Checkin));
        }
        updatePending((m) => {
          if (m.get(k)?.seq === op.seq) m.delete(k);
        });
      } catch (e) {
        console.error(e);
        updatePending((m) => {
          const cur = m.get(k);
          if (cur?.seq === op.seq) m.set(k, { ...cur, failed: true });
        });
      } finally {
        inFlight.current.delete(k);
        const cur = pendingRef.current.get(k);
        if (cur && cur.seq !== op.seq && !cur.failed) void flush(k);
      }
    },
    [updatePending],
  );

  const setCheckin = useCallback(
    (habitId: string, date: ISODate, status: CheckinStatus | null, note: string | null = null) => {
      const k = key(habitId, date);
      seq.current += 1;
      const op: PendingOp = { habit_id: habitId, date, status, note, seq: seq.current, failed: false };
      updatePending((m) => m.set(k, op));
      void flush(k);
    },
    [flush, updatePending],
  );

  const retryFailed = useCallback(() => {
    const keys = [...pendingRef.current].filter(([, op]) => op.failed || !inFlight.current.has(key(op.habit_id, op.date))).map(([k]) => k);
    updatePending((m) => {
      for (const k of keys) {
        const op = m.get(k);
        if (op) m.set(k, { ...op, failed: false });
      }
    });
    keys.forEach((k) => void flush(k));
  }, [flush, updatePending]);

  // First load, plus re-sync whenever the app comes back to the foreground or online.
  useEffect(() => {
    void refresh();
    retryFailed(); // anything queued on this device from a previous visit
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
        retryFailed();
      }
    };
    const onOnline = () => retryFailed();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [refresh, retryFailed]);

  const checkinsByHabit = useMemo(() => {
    const merged = new Map(server);
    for (const [k, op] of pending) {
      if (op.status === null) merged.delete(k);
      else merged.set(k, { ...merged.get(k), habit_id: op.habit_id, date: op.date, status: op.status, note: op.note });
    }
    const byHabit = new Map<string, Checkin[]>();
    for (const c of merged.values()) {
      const list = byHabit.get(c.habit_id);
      if (list) list.push(c);
      else byHabit.set(c.habit_id, [c]);
    }
    return byHabit;
  }, [server, pending]);

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived_at), [habits]);

  const createHabit = useCallback(
    async (input: HabitInput) => {
      const sort_order = habits.reduce((max, h) => Math.max(max, h.sort_order), -1) + 1;
      const { data, error } = await db().from('habits').insert({ ...input, sort_order }).select('*').single();
      if (error) throw error;
      setHabits((hs) => [...hs, data as Habit]);
      return data as Habit;
    },
    [habits],
  );

  const updateHabit = useCallback(async (id: string, patch: Partial<HabitInput>) => {
    const { data, error } = await db().from('habits').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    setHabits((hs) => hs.map((h) => (h.id === id ? (data as Habit) : h)));
  }, []);

  const archiveHabit = useCallback(async (id: string) => {
    const archived_at = new Date().toISOString();
    const { error } = await db().from('habits').update({ archived_at }).eq('id', id);
    if (error) throw error;
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, archived_at } : h)));
  }, []);

  let failedCount = 0;
  for (const op of pending.values()) if (op.failed) failedCount += 1;

  const value: DataContextValue = {
    loadState,
    habits,
    activeHabits,
    checkinsByHabit,
    failedCount,
    syncingCount: pending.size - failedCount,
    refresh,
    setCheckin,
    retryFailed,
    createHabit,
    updateHabit,
    archiveHabit,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
