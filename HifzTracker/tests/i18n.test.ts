import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "../src/i18n/ar";
import sv from "../src/i18n/sv";
import { t, tp, type Dict } from "../src/i18n";

/** Every English text the app translates: t("…"), tx("…") and the `other` form of tp({…}). */
export function collectKeys(dir = join(__dirname, "../src")): Map<string, string> {
  const keys = new Map<string, string>();
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) {
        if (f !== "i18n") walk(p);
      } else if (/\.(ts|tsx)$/.test(f)) {
        const src = readFileSync(p, "utf8");
        const str = String.raw`"((?:[^"\\]|\\.)*)"`;
        for (const m of src.matchAll(new RegExp(String.raw`(?<![\w.])tx?\(\s*` + str, "g"))) keys.set(JSON.parse(`"${m[1]}"`), p);
        const plural = String.raw`(?<![\w.])tp\(\s*\{\s*one:\s*` + str + String.raw`\s*,\s*other:\s*` + str;
        for (const m of src.matchAll(new RegExp(plural, "g"))) keys.set(JSON.parse(`"${m[2]}"`), p);
      }
    }
  };
  walk(dir);
  return keys;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const markup = (s: string) => [(s.match(/\*\*/g) ?? []).length, [...s.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1])];

describe.each([
  ["Swedish", sv],
  ["Arabic", ar],
] as [string, Dict][])("%s", (_, dict) => {
  const keys = collectKeys();

  it("has every text in the app", () => {
    const missing = [...keys.keys()].filter((k) => !(k in dict));
    expect(missing).toEqual([]);
  });

  it("keeps the placeholders, bold and links of each text", () => {
    const bad: string[] = [];
    for (const [en, tr] of Object.entries(dict)) {
      for (const form of typeof tr === "string" ? [tr] : Object.values(tr)) {
        const need = placeholders(en).filter((p) => p !== "n" || typeof tr === "string" || /\{n\}/.test(en));
        const got = placeholders(form);
        if (need.some((p) => !got.includes(p) && !(typeof tr === "object" && p === "n"))) bad.push(`${en} → ${form}`);
        if (JSON.stringify(markup(en)) !== JSON.stringify(markup(form))) bad.push(`markup: ${en} → ${form}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("has no leftover entries", () => {
    const keys = collectKeys();
    expect(Object.keys(dict).filter((k) => !keys.has(k))).toEqual([]);
  });
});

describe("translating", () => {
  it("falls back to English and fills placeholders", () => {
    expect(t("Page {n}", { n: 4 }, "en")).toBe("Page 4");
    expect(t("A sentence nobody translated", undefined, "sv")).toBe("A sentence nobody translated");
  });

  it("uses each language's plural rules", () => {
    const pages = { one: "{n} page", other: "{n} pages" };
    expect(tp(pages, 1, undefined, "en")).toBe("1 page");
    expect(tp(pages, 5, undefined, "en")).toBe("5 pages");
    // Arabic has separate forms for 1, 2, 3–10 and 11+.
    expect(new Set([1, 2, 5, 11].map((n) => tp(pages, n, undefined, "ar").replace(/\d+/, "#"))).size).toBeGreaterThan(2);
  });
});
