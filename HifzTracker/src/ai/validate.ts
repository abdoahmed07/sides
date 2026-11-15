/**
 * Validation of raw model output. Pure and unit-tested: the model's text is
 * parsed as JSON and checked against a Zod schema, plus content rules:
 *   - no Arabic script (the AI must never output Quran text),
 *   - explanations may only use numbers the engine produced.
 */
import type { z } from "zod";

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

/** Arabic script ranges (letters, diacritics, presentation forms). */
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function containsArabic(s: string): boolean {
  return ARABIC.test(s);
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

export function validateOutput<S extends z.ZodTypeAny>(text: string, schema: S): Validation<z.infer<S>> {
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
  if (stringsIn(parsed.data).some(containsArabic)) {
    return { ok: false, error: "Output contains Arabic script; Quran text must never be produced" };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Numbers in `text` that are not in `allowed`. Ordinals like "1st" and the
 * digits of dates are covered because the facts contain the same dates.
 */
export function unapprovedNumbers(text: string, allowed: Set<string>): string[] {
  const found = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return found.filter((n) => {
    const norm = n.replace(",", ".");
    if (allowed.has(norm) || allowed.has(String(Number(norm)))) return false;
    // Allow 0 and 1 ("1 day", "0 overdue") which carry no plan information.
    return !(Number(norm) === 0 || Number(norm) === 1);
  });
}
