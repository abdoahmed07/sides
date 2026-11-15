import Dexie, { type Table } from "dexie";
import type { Repo } from "./repo";
import type { Backup, Chat, Checkin, DayLog, MemUnit, PlanVersion } from "./types";

class HifzDB extends Dexie {
  planVersions!: Table<PlanVersion, number>;
  units!: Table<MemUnit, number>;
  dayLogs!: Table<DayLog, string>;
  chats!: Table<Chat, string>;
  checkins!: Table<Checkin, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("hifz-tracker");
    this.version(1).stores({
      planVersions: "++id, createdAt",
      units: "page, nextDue",
      dayLogs: "date",
      chats: "id",
      checkins: "id, date",
      meta: "key",
    });
  }
}

let _db: HifzDB | null = null;
export function db(): HifzDB {
  if (!_db) _db = new HifzDB();
  return _db;
}

export const dexieRepo: Repo = {
  async getActivePlan() {
    return db().planVersions.orderBy("id").last();
  },
  async listPlanVersions() {
    return db().planVersions.orderBy("id").reverse().toArray();
  },
  async getUnits() {
    return db().units.toArray();
  },
  async getDayLog(date) {
    return db().dayLogs.get(date);
  },
  async listDayLogs() {
    return db().dayLogs.toArray();
  },
  async putDayLog(log) {
    await db().dayLogs.put(log);
  },
  async getMeta<T>(key: string) {
    return (await db().meta.get(key))?.value as T | undefined;
  },
  async setMeta(key, value) {
    await db().meta.put({ key, value });
  },
  async getChat(id) {
    return db().chats.get(id);
  },
  async putChat(chat) {
    await db().chats.put(chat);
  },
  async listCheckins() {
    return db().checkins.orderBy("date").reverse().toArray();
  },
  async putCheckin(c) {
    await db().checkins.put(c);
  },
  async commit(change) {
    const d = db();
    return d.transaction("rw", [d.planVersions, d.units, d.dayLogs, d.meta], async () => {
      let planVersionId: number | undefined;
      if (change.plan) planVersionId = (await d.planVersions.add(change.plan as PlanVersion)) as number;
      if (change.units) {
        await d.units.clear();
        await d.units.bulkPut(change.units);
      }
      if (change.dayLog) await d.dayLogs.put(change.dayLog);
      for (const [key, value] of Object.entries(change.meta ?? {})) await d.meta.put({ key, value });
      return { planVersionId };
    });
  },
  async exportAll(): Promise<Backup> {
    const d = db();
    return {
      app: "hifz-tracker",
      version: 1,
      exportedAt: new Date().toISOString(),
      planVersions: await d.planVersions.toArray(),
      units: await d.units.toArray(),
      dayLogs: await d.dayLogs.toArray(),
      chats: await d.chats.toArray(),
      checkins: await d.checkins.toArray(),
      meta: await d.meta.toArray(),
    };
  },
  async importAll(b) {
    const d = db();
    await d.transaction("rw", [d.planVersions, d.units, d.dayLogs, d.chats, d.checkins, d.meta], async () => {
      await Promise.all([d.planVersions.clear(), d.units.clear(), d.dayLogs.clear(), d.chats.clear(), d.checkins.clear(), d.meta.clear()]);
      await d.planVersions.bulkAdd(b.planVersions as PlanVersion[]);
      await d.units.bulkPut(b.units as MemUnit[]);
      await d.dayLogs.bulkPut(b.dayLogs as DayLog[]);
      await d.chats.bulkPut(b.chats as Chat[]);
      await d.checkins.bulkPut(b.checkins as Checkin[]);
      await d.meta.bulkPut(b.meta);
    });
  },
  async clearAll() {
    const d = db();
    await d.transaction("rw", [d.planVersions, d.units, d.dayLogs, d.chats, d.checkins, d.meta], async () => {
      await Promise.all([d.planVersions.clear(), d.units.clear(), d.dayLogs.clear(), d.chats.clear(), d.checkins.clear(), d.meta.clear()]);
    });
  },
};

export const repo: Repo = dexieRepo;
