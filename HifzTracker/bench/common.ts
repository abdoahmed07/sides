/**
 * Shared by the bench's steps: the Quran text, where things are kept, and which recitations are used.
 * See bench/README.md.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import text from "../data/quran-text.json";
import { getQuran } from "../src/core/quran";
import { ayahWords } from "../src/recite/match";

export const q = getQuran();
export const quran = text as unknown as string[];
export const words = (ayah: number) => ayahWords(quran[ayah]);

export const BENCH = dirname(fileURLToPath(import.meta.url));
/** Downloaded audio, transcripts and reports: not part of the project (git-ignored). */
export const CACHE = join(BENCH, ".cache");
export const dir = (...parts: string[]) => {
  const d = join(CACHE, ...parts);
  mkdirSync(d, { recursive: true });
  return d;
};

/** EveryAyah recitations (the app plays the same ones; 64 kbps is plenty for recognition). */
export const RECITATIONS: Record<string, string> = {
  alafasy: "Alafasy_64kbps",
  husary: "Husary_64kbps",
  abdulbasit: "Abdul_Basit_Murattal_64kbps",
};

/** 002001: an ayah's file name at EveryAyah. */
export const fileOf = (ayah: number) => String(q.surahOf[ayah]).padStart(3, "0") + String(q.ayahOf[ayah]).padStart(3, "0");
export const nameOf = (ayah: number) => `${q.surahOf[ayah]}:${q.ayahOf[ayah]}`;
