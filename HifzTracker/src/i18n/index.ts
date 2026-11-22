/**
 * Languages: English (the source), Swedish and Arabic.
 *
 * The English text is the key: t("Today") looks "Today" up in the active
 * language's dictionary and falls back to the English. Placeholders use
 * {name}: t("Page {n}", { n: 3 }). Plurals use tp(), which picks the form
 * with the language's own rules (Arabic has six).
 *
 * The active language is a module-level value so plain functions (dates,
 * labels from the planning engine) can use it too. It is "en" until the app
 * has started in the browser (so the prerendered HTML and the first render
 * match), then switches to the saved choice; see LanguageStarter.
 *
 * No React here: this file is also used by server code (the AI route). The
 * component hook is in ./react.ts.
 */
import ar from "./ar";
import sv from "./sv";

export type Lang = "en" | "sv" | "ar";
export type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Dict = Record<string, string | Plural>;

export const LANGS: { code: Lang; name: string }[] = [
  { code: "en", name: "English" },
  { code: "sv", name: "Svenska" },
  { code: "ar", name: "العربية" },
];

const DICTS: Record<Lang, Dict> = { en: {}, sv, ar };
const LOCALE: Record<Lang, string> = { en: "en-GB", sv: "sv-SE", ar: "ar-u-nu-latn" };
export const STORAGE_KEY = "hifz:lang";

let active: Lang = "en";
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return active;
}
export function locale(lang: Lang = active): string {
  return LOCALE[lang];
}
export function isRtl(lang: Lang = active): boolean {
  return lang === "ar";
}

/** The saved choice, or the browser's language the first time. */
export function preferredLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "sv" || saved === "ar") return saved;
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
  return nav.startsWith("sv") ? "sv" : nav.startsWith("ar") ? "ar" : "en";
}

function applyToDocument(lang: Lang) {
  const el = document.documentElement;
  el.lang = lang;
  el.dir = isRtl(lang) ? "rtl" : "ltr";
  el.classList.remove("i18n-pending");
}

/** Switches the language (and remembers it, unless `remember` is false). */
export function setLang(lang: Lang, remember = true) {
  if (remember)
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  active = lang;
  if (typeof document !== "undefined") applyToDocument(lang);
  listeners.forEach((l) => l());
}

/** For the React hooks in ./react.ts. */
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}


function fill(s: string, vars?: Record<string, string | number>) {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Translates English text into the active language. */
export function t(en: string, vars?: Record<string, string | number>, lang: Lang = active): string {
  const hit = DICTS[lang][en];
  return fill(typeof hit === "string" ? hit : (hit?.other ?? en), vars);
}

/**
 * Plural text. `forms` is the English: { one: "{n} page", other: "{n} pages" };
 * the dictionaries use forms.other as the key. {n} is filled in.
 */
export function tp(forms: Plural, n: number, vars?: Record<string, string | number>, lang: Lang = active): string {
  const rule = new Intl.PluralRules(locale(lang)).select(n);
  const hit = DICTS[lang][forms.other];
  const pool: Plural = typeof hit === "object" ? hit : typeof hit === "string" ? { other: hit } : forms;
  const s = pool[rule] ?? pool.other;
  return fill(s, { n, ...vars });
}

/** Marks English text kept in a list or constant for translation; translate it with t() where it is shown. */
export const tx = (en: string) => en;

