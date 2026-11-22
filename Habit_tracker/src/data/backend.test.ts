import { describe, expect, it } from 'vitest';
import { DEVICE_STORAGE_KEY, deviceBackend, type KeyValueStore } from './backend';
import type { HabitInput } from '../lib/types';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const input: HabitInput & { sort_order: number } = {
  name: 'Read a page',
  schedule_type: 'daily',
  weekly_target: null,
  minimum_version: 'Read one page',
  rest_days_per_month: 2,
  start_date: '2026-11-20',
  sort_order: 0,
};

describe('device backend (no account)', () => {
  it('starts empty', async () => {
    expect(await deviceBackend(memoryStore()).load()).toEqual({ habits: [], checkins: [] });
  });

  it('creates, updates and archives habits, and keeps them across reloads', async () => {
    const store = memoryStore();
    const a = deviceBackend(store);
    const habit = await a.createHabit(input);
    expect(habit).toMatchObject({ ...input, archived_at: null });
    expect(habit.id).toBeTruthy();

    await a.updateHabit(habit.id, { name: 'Read' });
    await a.updateHabit(habit.id, { archived_at: '2026-11-21T10:00:00.000Z' });

    const reopened = await deviceBackend(store).load(); // a fresh instance reads what was saved
    expect(reopened.habits).toHaveLength(1);
    expect(reopened.habits[0]).toMatchObject({ name: 'Read', archived_at: '2026-11-21T10:00:00.000Z' });
  });

  it('keeps one entry per habit per day: saving again replaces it', async () => {
    const b = deviceBackend(memoryStore());
    const h = await b.createHabit(input);
    const first = await b.saveCheckin({ habit_id: h.id, date: '2026-11-20', status: 'done', note: null });
    const second = await b.saveCheckin({ habit_id: h.id, date: '2026-11-20', status: 'excused', note: 'sick' });
    expect(second.id).toBe(first.id);
    const { checkins } = await b.load();
    expect(checkins).toEqual([{ id: first.id, habit_id: h.id, date: '2026-11-20', status: 'excused', note: 'sick' }]);
  });

  it('removes a check-in (undo)', async () => {
    const b = deviceBackend(memoryStore());
    const h = await b.createHabit(input);
    await b.saveCheckin({ habit_id: h.id, date: '2026-11-19', status: 'done', note: null });
    await b.saveCheckin({ habit_id: h.id, date: '2026-11-20', status: 'done', note: null });
    await b.removeCheckin(h.id, '2026-11-20');
    expect((await b.load()).checkins.map((c) => c.date)).toEqual(['2026-11-19']);
  });

  it('rejects a check-in for an unknown habit', async () => {
    const b = deviceBackend(memoryStore());
    await expect(b.saveCheckin({ habit_id: 'nope', date: '2026-11-20', status: 'done', note: null })).rejects.toThrow();
  });

  it('returns habits in their Today order', async () => {
    const b = deviceBackend(memoryStore());
    await b.createHabit({ ...input, name: 'Second', sort_order: 1 });
    await b.createHabit({ ...input, name: 'First', sort_order: 0 });
    expect((await b.load()).habits.map((h) => h.name)).toEqual(['First', 'Second']);
  });

  it('never overwrites data it cannot read', async () => {
    const store = memoryStore();
    store.data.set(DEVICE_STORAGE_KEY, '{not json');
    const b = deviceBackend(store);
    await expect(b.load()).rejects.toThrow();
    await expect(b.createHabit(input)).rejects.toThrow();
    expect(store.data.get(DEVICE_STORAGE_KEY)).toBe('{not json');
  });
});
