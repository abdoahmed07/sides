import { getQuran } from "../src/core/quran";
import { defaultConfig, type PlanConfig } from "../src/core/plan/schema";

export const q = getQuran();
export const TODAY = "2026-11-16"; // a Monday

export function cfg(over: Partial<PlanConfig> = {}): PlanConfig {
  return { ...defaultConfig(TODAY), ...over };
}

export function noneMemorized() {
  return new Uint8Array(q.count);
}

export function memorizedRange(a: number, b: number) {
  const m = noneMemorized();
  for (let i = a; i <= b; i++) m[i] = 1;
  return m;
}
