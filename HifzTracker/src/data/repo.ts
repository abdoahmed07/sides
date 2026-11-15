/**
 * The storage interface the app talks to. The only implementation today is
 * IndexedDB via Dexie (local-first, no login); a Supabase implementation can
 * replace it later without touching core logic or UI components.
 */
import type { IsoDate } from "@/core/dates";
import type { Backup, Chat, Checkin, DayLog, MemUnit, PlanVersion } from "./types";

export interface Repo {
  getActivePlan(): Promise<PlanVersion | undefined>;
  listPlanVersions(): Promise<PlanVersion[]>;

  getUnits(): Promise<MemUnit[]>;

  getDayLog(date: IsoDate): Promise<DayLog | undefined>;
  listDayLogs(): Promise<DayLog[]>;
  putDayLog(log: DayLog): Promise<void>;

  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;

  getChat(id: string): Promise<Chat | undefined>;
  putChat(chat: Chat): Promise<void>;

  listCheckins(): Promise<Checkin[]>;
  putCheckin(c: Checkin): Promise<void>;

  /**
   * Atomically writes a new plan version and/or replaces units and/or a day
   * log. Either everything is written or nothing is.
   */
  commit(change: {
    plan?: Omit<PlanVersion, "id">;
    units?: MemUnit[];
    dayLog?: DayLog;
    meta?: Record<string, unknown>;
  }): Promise<{ planVersionId?: number }>;

  exportAll(): Promise<Backup>;
  /** Replaces all data with the backup, atomically. */
  importAll(backup: Backup): Promise<void>;
  clearAll(): Promise<void>;
}
