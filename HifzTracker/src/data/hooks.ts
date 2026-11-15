"use client";
/**
 * Reactive reads for the UI. They use Dexie live queries today; a backend
 * swap would replace this file and dexie.ts only.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { localToday } from "@/core/dates";
import { repo } from "./dexie";

export function usePlan() {
  return useLiveQuery(() => repo.getActivePlan().then((p) => p ?? null), []);
}
export function usePlanVersions() {
  return useLiveQuery(() => repo.listPlanVersions(), []);
}
export function useUnits() {
  return useLiveQuery(() => repo.getUnits(), []);
}
export function useDayLog(date: string) {
  return useLiveQuery(() => repo.getDayLog(date).then((l) => l ?? null), [date]);
}
export function useDayLogs() {
  return useLiveQuery(() => repo.listDayLogs(), []);
}
export function useMeta<T>(key: string) {
  return useLiveQuery(() => repo.getMeta<T>(key).then((v) => (v === undefined ? null : v)), [key]);
}
export function useCheckins() {
  return useLiveQuery(() => repo.listCheckins(), []);
}

/** Today's local date; updates when the day changes while the app is open. */
export function useToday() {
  const [today, setToday] = useState(() => localToday());
  useEffect(() => {
    const t = setInterval(() => setToday(localToday()), 60_000);
    const onFocus = () => setToday(localToday());
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return today;
}
