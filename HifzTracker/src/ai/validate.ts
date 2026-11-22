/**
 * Validation of raw model output. Pure and unit-tested: the model's text is
 * parsed as JSON and checked against a Zod schema, plus content rules:
 *   - no Quran text: no Arabic script at all, or, for Arabic replies, no
 *     Quranic vowel marks and no 5-word run that appears in the Quran,
 *   - explanations may only use numbers the engine produced.
 */
import type { z } from "zod";

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

/** Arabic script ranges (letters, diacritics, presentation forms). */
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function containsArabic(s: string): boolean {
  return ARABIC.test(s);
}

/** Harakat, superscript alef and the Quran's annotation marks: ordinary Arabic prose has almost none. */
const QURANIC_MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g;

/** Letters only, with spelling variants folded together, so quotes are found however they are written. */
export function normalizeArabic(s: string): string[] {
  return s
    .replace(QURANIC_MARKS, "")
    .replace(/\u0640/g, "") // tatweel
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") // alef forms
    .replace(/\u0649/g, "\u064A") // alef maqsura → ya
    .replace(/\u0629/g, "\u0647") // ta marbuta → ha
    .replace(/[^\u0621-\u064A\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const NGRAM = 5;
let quranNgrams: Set<string> | null = null;
/** Every 5-word run of the Quran (built once, on the server). */
async function quranGrams(): Promise<Set<string>> {
  if (quranNgrams) return quranNgrams;
  const text = (await import("../../data/quran-text.json")).default as unknown as string[];
  const set = new Set<string>();
  for (const ayah of text) {
    const w = normalizeArabic(ayah);
    for (let i = 0; i + NGRAM <= w.length; i++) set.add(w.slice(i, i + NGRAM).join(" "));
  }
  return (quranNgrams = set);
}

/**
 * True if Arabic text looks like Quran text: fully vowelled (the Quran has a
 * mark on nearly every letter; everyday writing a few per sentence, like the
 * tanween in يومياً), or a 5-word run from the Quran.
 */
export async function looksLikeQuran(s: string): Promise<boolean> {
  const letters = (s.match(/[\u0621-\u064A]/g) ?? []).length;
  const marks = (s.match(QURANIC_MARKS) ?? []).length;
  if (letters >= 8 && marks / letters >= 0.3) return true;
  const w = normalizeArabic(s);
  if (w.length < NGRAM) return false;
  const grams = await quranGrams();
  for (let i = 0; i + NGRAM <= w.length; i++) if (grams.has(w.slice(i, i + NGRAM).join(" "))) return true;
  return false;
}

function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    // Tolerate a fenced block or stray prose around the JSON object.
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("Output is not JSON");
  }
}

function stringsIn(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => stringsIn(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => stringsIn(x, out));
  return out;
}

export async function validateOutput<S extends z.ZodTypeAny>(text: string, schema: S, opts: { arabic?: boolean } = {}): Promise<Validation<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    };
  }
  const strings = stringsIn(parsed.data);
  if (!opts.arabic && strings.some(containsArabic)) {
    return { ok: false, error: "Output contains Arabic script; Quran text must never be produced" };
  }
  if (opts.arabic) {
    for (const s of strings)
      if (await looksLikeQuran(s)) return { ok: false, error: "Output contains Quran text (or fully vowelled Arabic); never quote the Quran" };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Numbers in `text` that are not in `allowed`. Ordinals like "1st" and the
 * digits of dates are covered because the facts contain the same dates.
 */
export function unapprovedNumbers(text: string, allowed: Set<string>): string[] {
  // Arabic-Indic (٠-٩) and Persian (۰-۹) digits count too.
  const western = text.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const found = western.match(/\d+(?:[.,٫]\d+)?/g) ?? [];
  return found.filter((n) => {
    const norm = n.replace(/[,٫]/, ".");
    if (allowed.has(norm) || allowed.has(String(Number(norm)))) return false;
    // Allow 0 and 1 ("1 day", "0 overdue") which carry no plan information.
    return !(Number(norm) === 0 || Number(norm) === 1);
  });
}
