import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ISODate } from '../lib/dates';
import type { CheckinStatus } from '../lib/streak';
import type { Checkin, Habit, HabitInput } from '../lib/types';
import type { Backend } from './backend';

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
  /** 'account': synced through Supabase. 'device': kept in this browser only. */
  mode: Backend['kind'];
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

interface ProviderProps {
  userId: string;
  backend: Backend;
  children: ReactNode;
}

export function DataProvider({ userId, backend, children }: ProviderProps) {
  // A device backend already lives on the device, so it needs no cached copy.
  const cached = backend.kind === 'account';
  const [snapshot] = useState(() => (cached ? loadSnapshot(userId) : null));
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
      const { habits: h, checkins: rows } = await backend.load();
      setHabits(h);
      setServer(new Map(rows.map((c) => [key(c.habit_id, c.date), c])));
      setLoadState('ready');
    } catch (e) {
      console.error(e);
      setLoadState((s) => (s === 'ready' ? s : 'error'));
    }
  }, [backend]);

  // Keep the on-device snapshot current with the latest server data.
  useEffect(() => {
    if (!cached || loadState !== 'ready') return;
    const id = window.setTimeout(() => saveSnapshot(userId, { habits, checkins: [...server.values()] }), 300);
    return () => window.clearTimeout(id);
  }, [cached, userId, loadState, habits, server]);

  const flush = useCallback(
    async (k: string) => {
      if (inFlight.current.has(k)) return; // re-checked when the current request ends
      const op = pendingRef.current.get(k);
      if (!op) return;
      inFlight.current.add(k);
      try {
        if (op.status === null) {
          await backend.removeCheckin(op.habit_id, op.date);
          setServer((m) => {
            const next = new Map(m);
            next.delete(k);
            return next;
          });
        } else {
          const saved = await backend.saveCheckin({ habit_id: op.habit_id, date: op.date, status: op.status, note: op.note });
          setServer((m) => new Map(m).set(k, saved));
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
    [backend, updatePending],
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
      const created = await backend.createHabit({ ...input, sort_order });
      setHabits((hs) => [...hs, created]);
      return created;
    },
    [backend, habits],
  );

  const updateHabit = useCallback(
    async (id: string, patch: Partial<HabitInput>) => {
      const updated = await backend.updateHabit(id, patch);
      setHabits((hs) => hs.map((h) => (h.id === id ? updated : h)));
    },
    [backend],
  );

  const archiveHabit = useCallback(
    async (id: string) => {
      const updated = await backend.updateHabit(id, { archived_at: new Date().toISOString() });
      setHabits((hs) => hs.map((h) => (h.id === id ? updated : h)));
    },
    [backend],
  );

  let failedCount = 0;
  for (const op of pending.values()) if (op.failed) failedCount += 1;

  const value: DataContextValue = {
    mode: backend.kind,
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
