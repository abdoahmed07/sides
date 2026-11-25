/**
 * How your phone writes words you say right, at their place in the Quran. A phone's recognition stumbles
 * on the same words in the same places (with your voice, again and again): when you tap such a word on
 * the result screen ("I said it right"), what the phone wrote there is remembered, and next time it
 * counts there. Only there: elsewhere that spelling may be a real slip. Kept on this device.
 */
const KEY = "hifz:heardAs";
/** Spellings kept per place, and places in all (the oldest go first). */
const PER_PLACE = 3;
const MAX_PLACES = 3000;

type Store = Record<string, string[]>;
let store: Store | null = null;

function load(): Store {
  if (store) return store;
  try {
    store = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    store = {};
  }
  return store;
}

/** A word's place: the ayah (index in the whole Quran) and the word in it. */
export const placeOf = (ayah: number, word: number) => `${ayah}:${word}`;

/** The spellings remembered for a place (in the matcher's form: see `heardKey`). */
export const heardAs = (place: string): readonly string[] | undefined => load()[place];

/** Remembers that the phone wrote `spelling` (in the matcher's form) for the word at `place`, said right. */
export function rememberHeardAs(place: string, spelling: string) {
  const s = load();
  if (!spelling) return;
  const was = (s[place] ?? []).filter((x) => x !== spelling);
  delete s[place];
  s[place] = [spelling, ...was].slice(0, PER_PLACE);
  const places = Object.keys(s);
  for (const p of places.slice(0, Math.max(0, places.length - MAX_PLACES))) delete s[p];
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* not kept beyond this visit; fine */
  }
}
