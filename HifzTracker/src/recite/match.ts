/**
 * Recite and check: comparing what was heard with the real text.
 * Pure and tested. Only words are checked (skipped, wrong), not tajweed or vowels.
 *
 * The Quran text is Uthmani; speech recognition writes plain Arabic. Both are folded to a
 * common spelling (no vowel marks, one alef, no hamza, etc.), so the scripts' spelling
 * differences don't count as mistakes.
 */

/** Waqf (pause) signs and other marks that stand alone between words in the Uthmani text. */
const STANDALONE_MARK = /^[ۖ-ٰۭ࣓-ࣿؐ-ؚ۞۩]+$/;

/** The words of one ayah as written (for display), without stand-alone pause signs. */
export function ayahWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w && !STANDALONE_MARK.test(w));
}

/** One word in a common spelling for comparing Uthmani text with plain Arabic. */
export function fold(word: string): string {
  return word
    .replace(/\u0649\u0670(?=[\u0653-\u065F\u06D6-\u06ED]*$)/, "\u0649") // ىٰ at the end: ى (مُوسَىٰ = موسى)
    .replace(/\u0649\u0670/g, "\u0627") // ىٰ inside a word: ا (ءَاتَىٰهُمْ = آتاهم)
    .replace(/(\u0647[\u064B-\u0652]*)\u06E6/g, "$1") // the long vowel after ha, which plain Arabic doesn't write (بِهِۦ = به)
    .replace(/\u06E6/g, "\u064A") // small ya elsewhere: a ya plain Arabic writes (يُحْىِۦ = يحيي)
    .replace(/\u06E8/g, "\u0646") // small noon: a noon plain Arabic writes (نُـۨجِى = ننجي)
    .replace(/ٰ/g, "ا") // superscript alef → alef (Uthmani الكتـٰب = الكتاب)
    .replace(/[آأإٱٲٳ]/g, "ا") // alef forms
    .replace(/ى/g, "ي") // alef maqsura → ya
    .replace(/ة/g, "ه") // ta marbuta → ha
    .replace(/[ؤ]/g, "و") // waw hamza → waw
    .replace(/[ئ]/g, "ي") // ya hamza → ya
    .replace(/ۧ/g, "ي") // small ya (إِبْرَٰهِـۧمَ = إبراهيم, ٱلنَّبِيِّـۧنَ = النبيين)
    .replace(/[ً-ٟۖ-ۭ࣓-ࣿؐ-ؚـ]/g, "") // vowel marks, Quranic marks, tatweel
    .replace(/[^ء-ي]/g, ""); // letters only
}

/**
 * The plain spelling of words where the mushaf has a small alef that plain Arabic leaves out:
 * إِلَـٰهِ = إله, هَـٰذَا = هذا, ذَٰلِكَ = ذلك, عَلَىٰ = على, ٱلصَّلَوٰةَ = الصلاة. Elsewhere plain Arabic
 * does write it (مَـٰلِكِ = مالك), so a word matches either spelling.
 */
function plain(word: string): string {
  return word.replace(/وٰ/g, "ا").replace(/ٰ/g, "");
}

/**
 * Without hamza, or the waw or ya carrying it, which the mushaf and plain Arabic often write
 * differently (ٱلْمَلَؤُا۟ = الملأ, سَيِّـَٔاتِ = سيئات, ٱلْقُرْءَانُ = القرآن), and without the silent
 * letters only one of them writes (ثَمُودَا۟ = ثمود, أُو۟لُوا۟ = أولو, قالوا).
 */
function bare(word: string): string {
  return fold(
    word
      .replace(/[اىي]۟/g, "") // an alef or ya marked silent (وَمَلَإِي۟هِۦ = وملئه)
      .replace(/^ء(?=[ً-ْ]*أ)/, "ا") // a question's hamza (ءَأَنتُمْ = أأنتم)
      .replace(/[أإ](?=[ً-ْ]*$)/, "ء") // hamza on alef at the end (نَبَؤُا۟ = نبأ)
      .replace(/[ؤئ]/g, "ء"), // hamza on waw or ya
  )
    .replace(/ء/g, "")
    .replace(/وا$/, "و"); // the alef after a final waw
}

/** The spellings an expected word is compared in: folded, plain, and the ones without hamza. */
type Forms = { f: string; p: string; b: string; bp: string; alts: string[]; letters: boolean };

function forms(word: string): Forms {
  const p = plain(word);
  const b = bare(word);
  const bp = bare(p);
  const alts = new Set([b, bp]);
  // تَسْـَٔلُونَ = تسألون: a hamza on a stroke, where plain Arabic writes أ.
  const stroke = /ـ[ً-ْ]*[ٕٔ][ً-ْ]*/g;
  if (stroke.test(word)) for (const v of [word, p]) alts.add(bare(v.replace(stroke, "ا")));
  // دَاوُۥدَ = داوود, ٱلْغَاوُۥنَ = الغاوون: a small waw (not after ha) that plain Arabic may write.
  const smallWaw = /(?<!ه[ً-ْ]*)ۥ/g;
  if (smallWaw.test(word)) for (const v of [word, p]) alts.add(bare(v.replace(smallWaw, "و")));
  /** Another spelling of the word (of each one so far). */
  const also = (test: RegExp, respell: (a: string) => string) => {
    if (test.test(word)) for (const a of [...alts]) alts.add(respell(a));
  };
  // عَلِيمًا: the alef of tanween, which recognition may leave out.
  also(/ًا$/, (a) => a.slice(0, -1));
  // رَءَا = رأى, وَنَـَٔا = ونأى: an alef after hamza at the end, which plain Arabic follows with ى.
  also(/(ءَ?|َ?َٔ?)ا[ٓ-ٟۖ-ۭ]*$/, (a) => a + "ي");
  // يُحْىِ = يحيي: plain Arabic writes the second ya.
  also(/ىِ$/, (a) => a + "ي");
  // فَسْـَٔلْ = فاسأل, وَسْـَٔلُوا۟ = واسألوا: "and/so ask", where plain Arabic writes an alef.
  also(/^[وف]َ?سْـ/, (a) => a[0] + "ا" + a.slice(1));
  // لْـَٔيْكَةِ = الأيكة
  also(/^لْ/, (a) => "ا" + a);
  // ٱلَّـٰتِى = اللاتي, ٱلَّـٰٓـِٔى = اللائي: plain Arabic writes both lams.
  also(/^([وف]َ)?ٱلَّ?ـٰ/, (a) => a.replace(/^([وف]?)ال/, "$1الل"));
  // بَصْۜطَةً = بسطة: ص with a small س over it, which may be read (and written) س.
  also(/ۜ/, (a) => a.replace(/ص/g, "س"));
  return {
    f: fold(word),
    p: fold(p),
    b,
    bp,
    alts: [...alts],
    // الٓمٓ, حمٓ, طه…: the opening letters of a surah, the only words written without vowel marks.
    letters: !/[ً-ْ]/.test(word),
  };
}

/** Two expected words written as one. */
const joined = (x: Forms, y: Forms): Forms => ({
  f: x.f + y.f,
  p: x.p + y.p,
  b: x.b + y.b,
  bp: x.bp + y.bp,
  alts: [x.b + y.b, x.bp + y.bp],
  letters: false,
});

/**
 * A heard word: folded, and without hamza. `letters`: the letters it spells when it's letter names
 * ("لام ميم" = لم), as one heard word or several put together (see `joinLetters`). `cut`: folded and
 * without hamza, without a final ة the phone may have added (see `hear`). `clipped`: the first word after
 * a pause, whose first sound the phone may have missed (see `fitOf`).
 */
type Heard = { f: string; b: string; letters?: string[]; cut?: [string, string]; clipped?: boolean };

/**
 * A heard word, for comparing. A word's last vowel said joined to the next word (لَا رَيْبَ فِيهِ: "rayba
 * fīh") the phone may write as ة (ريبة), so the word without it counts too.
 */
function hear(w: string): Heard {
  const f = fold(w);
  const b = bare(w);
  return /ة[\u064B-\u0652]*$/.test(w) && f.length > 3 ? { f, b, cut: [f.slice(0, -1), b.slice(0, -1)] } : { f, b };
}

/** Whether a heard word is the expected word, in any of its spellings. */
function sameWord(w: Forms, x: Heard): boolean {
  if (x.f === w.f || x.f === w.p || w.alts.includes(x.b)) return true;
  return !!x.cut && (x.cut[0] === w.f || x.cut[0] === w.p || w.alts.includes(x.cut[1]));
}

/** An expected word without the و ("and") it starts with, when there's a word left (وَأُو۟لَـٰٓئِكَ = أولئك). */
function withoutWa(w: Forms): Forms | null {
  if (w.f[0] !== "و" || w.f.length < 4) return null;
  const cut = (s: string) => (s[0] === "و" ? s.slice(1) : s);
  return { ...w, f: cut(w.f), p: cut(w.p), b: cut(w.b), bp: cut(w.bp), alts: w.alts.map(cut) };
}

/**
 * Every word of the Quran, in each spelling, for strict checking: a heard word that's one of these
 * but not the expected word is another real word (a mistake), not a different spelling.
 */
export function quranWords(text: string[]): Set<string> {
  const words = new Set<string>();
  for (const ayah of text) for (const w of ayahWords(ayah)) words.add(w);
  const known = new Set<string>();
  for (const w of words) {
    const x = forms(w);
    for (const s of [x.f, x.p, ...x.alts]) known.add(s);
  }
  known.delete("");
  return known;
}

/**
 * The opening letters of some surahs (الٓمٓ, كٓهيعٓصٓ, حمٓ…) are recited by their names, "alif lam
 * mim", and recognition writes the names: ألف لام ميم, or joined, ياسين. (لا: the drawn-out "laaam"
 * the phone wrote before it heard the m, which it then writes as part of ميم.)
 */
const LETTER_NAMES: [name: string, letter: string][] = [
  ["الف", "ا"],
  ["لام", "ل"],
  ["لا", "ل"],
  ["ميم", "م"],
  ["صاد", "ص"],
  ["را", "ر"],
  ["كاف", "ك"],
  ["ها", "ه"],
  ["يا", "ي"],
  ["عين", "ع"],
  ["طا", "ط"],
  ["سين", "س"],
  ["حا", "ح"],
  ["قاف", "ق"],
  ["نون", "ن"],
];

/** The letters of the opening letters, which recognition may also write one by one ("ا ل م"). */
const OPENING_LETTERS = new Set("المصركهيعطسحقن");

/** Every surah's opening letters (the only words of the Quran written without vowel marks), folded. */
const OPENINGS = new Set(["الم", "المص", "الر", "المر", "كهيعص", "طه", "طسم", "طس", "يس", "ص", "حم", "عسق", "ق", "ن"]);

const spellCache = new Map<string, string[]>();
/**
 * The letters a heard word (without hamza) spells as letter names, one after another (ألف, لام, ياسين
 * = ي + س): more than one when it reads more ways (لاميم: لا + ميم; لام + يم isn't names), none when it
 * isn't names. A single letter on its own is itself.
 */
function nameLetters(b: string): string[] {
  let out = spellCache.get(b);
  if (!out) {
    const found = new Set<string>();
    const read = (k: number, sofar: string) => {
      if (found.size > 8) return;
      if (k === b.length) return void found.add(sofar);
      for (const [name, letter] of LETTER_NAMES) if (b.startsWith(name, k)) read(k + name.length, sofar + letter);
    };
    if (b.length === 1) {
      if (OPENING_LETTERS.has(b)) found.add(b);
    } else if (b) read(0, "");
    out = [...found];
    if (spellCache.size > 5000) spellCache.clear();
    spellCache.set(b, out);
  }
  return out;
}

/** What a heard word may spell as opening letters: as names, or as the letters themselves (الم, ا). */
function spellings(b: string): string[] {
  const out = nameLetters(b);
  return b.length > 1 && [...b].every((c) => OPENING_LETTERS.has(c)) ? [...out, b] : out;
}

/** Every way some words' spellings put together read (a few at most). */
function together(each: string[][]): string[] {
  let out = [""];
  for (const ways of each) out = out.flatMap((a) => ways.map((w) => a + w)).slice(0, 32);
  return out;
}

/** Whether all of `part`'s letters are in `whole`, in order (some of the letters, the others not heard). */
function within(part: string, whole: string): boolean {
  let k = 0;
  for (const c of whole) if (c === part[k]) k++;
  return !!part && k === part.length;
}

/**
 * Puts heard letter names together, where opening letters are expected: names that spell them
 * (ألف لام ميم, ا ل م) become one heard word, the letters themselves; other names next to each other
 * (ألف لام, the phone missing ميم; ألف لام را) one word that spells what they spell, for the check
 * (some of the letters count, another surah's letters are a mistake: see `fitOf`).
 */
function joinLetters(h: Heard[], at: number[], wanted: Set<string>): [Heard[], number[]] {
  if (!wanted.size) return [h, at];
  const out: Heard[] = [];
  const outAt: number[] = [];
  for (let t = 0; t < h.length; ) {
    // The names here, and the longest start of them that spells opening letters expected.
    let run = 0;
    while (run < 5 && t + run < h.length && nameLetters(h[t + run].b).length) run++;
    const spelled = together(h.slice(t, t + run).map((x) => nameLetters(x.b)));
    let len = 0;
    let letters = "";
    for (let l = Math.min(5, h.length - t); l > 0 && !len; l--) {
      const s = together(h.slice(t, t + l).map((x) => spellings(x.b))).find((x) => wanted.has(x));
      if (s) [len, letters] = [l, s];
    }
    // (Unless all the names say another surah's letters: ألف لام ميم صاد where الٓمٓ is.)
    if (len && !(run > len && spelled.some((s) => OPENINGS.has(s) && !wanted.has(s)))) {
      out.push({ f: letters, b: letters });
      outAt.push(at[t + len - 1]);
      t += len;
    } else if (run) {
      const names = h.slice(t, t + run);
      out.push(run === 1 ? { ...h[t], letters: spelled } : { f: names.map((x) => x.f).join(""), b: names.map((x) => x.b).join(""), letters: spelled });
      outAt.push(at[t + run - 1]);
      t += run;
    } else {
      out.push(h[t]);
      outAt.push(at[t]);
      t++;
    }
  }
  return [out, outAt];
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** 1 = same word, 0 = nothing alike. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const len = Math.max(a.length, b.length);
  return len ? 1 - editDistance(a, b) / len : 0;
}

/**
 * The forgiving check (the on-device model, without `known`): close enough to
 * count as the right word. Allows the usual script
 * differences and a misheard letter or two (the small model's typical slips,
 * e.g. ملك heard as تلك). Real mistakes are mostly other words or missing ones;
 * a false "mistake" is worse for the person than a missed one.
 */
export const SAME = 0.5;

export type WordStatus = "pending" | "correct" | "wrong" | "skipped";

export type Alignment = {
  /**
   * Status per expected word, from `from` on (earlier words are untouched).
   * `score`: how alike the heard and expected word were (0–1); `heard`: which heard word it was paired with.
   */
  statuses: { index: number; status: Exclude<WordStatus, "pending">; score: number; heard: number }[];
  /** First expected word not yet covered. */
  next: number;
  /**
   * After a pause: how many heard words at the end may be the start of the next word ("يا" of يا أيها,
   * which the mushaf writes as one word). They're left out, to be checked with what comes after them.
   */
  rest?: number;
};

/** Cost of a heard word that isn't in the text (repeating yourself): cheaper than a skip, dearer than a near-match. */
const EXTRA = 0.8;
/**
 * The Uthmani text and plain Arabic don't always split words the same way: يَـٰٓأَيُّهَا and يَـٰقَوْمِ are
 * one word in the mushaf but "يا أيها", "يا قوم" in plain writing, and recognition sometimes joins two
 * words. One heard word may stand for two expected ones (or two for one), but only when the joined
 * spelling matches, so a really skipped word is still caught. A little extra cost keeps a plain
 * one-to-one pairing first when both fit.
 */
const JOIN_SAME = 0.8;
const JOIN = 0.15;
/**
 * Strict checking: a heard word that is no word of the Quran (a spelling the text doesn't have, a
 * misheard letter) still counts as right when this close.
 */
const CLOSE = 0.75;
/** Strict checking: the extra cost of a wrong word, so a word heard exactly a little further on wins. */
const WRONG = 0.4;
/** A word you stopped on that nothing explains: dearer than any pairing, so it's called a mistake. */
const UNEXPLAINED = 2;
/**
 * The opening letters of a surah (الٓمٓ, حمٓ…) are recited as long, drawn-out letter names, which phones
 * hear badly or not at all. Not hearing them costs almost nothing, and once the words after them are
 * heard they count as said.
 */
const LETTERS_SKIP = 0.1;
/** Some of the opening letters, as names (the phone missed the others): right, at a little cost. */
const SOME_LETTERS = 0.2;
/**
 * Anything else heard where opening letters are (اللهم, علم: the phone's guess at the drawn-out names)
 * counts as them too, at a little more cost, so letters not heard at all and the words after them still
 * come first. Not the isti'adha or basmala, nor another surah's opening letters (that's a mistake).
 */
const LOOSE_LETTERS = 0.3;
/** How alike such a guess counts as: under `SAME`, so on its own it doesn't show where you started (see follow). */
export const LOOSE_SCORE = 0.4;
/** The first word after a pause heard without its و: right, at a little cost (a plain match comes first). */
const CLIPPED = 0.1;
/** How far back a word you stopped on still counts as repeating yourself. */
const RECENT = 12;
/** Said around a recitation, not part of it: the isti'adha, the basmala, "sadaqa Allahu l-'azim", amin. */
const AROUND = new Set(["اعوذ", "بالله", "من", "الشيطان", "الرجيم", "بسم", "الله", "الرحمن", "الرحيم", "صدق", "العظيم", "امين"]);

export type AlignOptions = {
  /**
   * Every word of the Quran (`quranWords`): checks strictly, for recognition that writes real words
   * (the phone's). A heard word then counts only when it's the same word, in some spelling; another
   * word (الرحيم for الرحمن, تعلمون for يعلمون) is a mistake. Without it the check forgives a misheard
   * letter or two (`SAME`), which the on-device model needs.
   */
  known?: Set<string>;
  /**
   * The reciter has stopped: paused (and may go on), or ended. The last words heard must fit too, so
   * a wrong word you stop on is a mistake; after a pause, a word that may be the start of the next one
   * waits instead (`rest`).
   */
  stopped?: "pause" | "end";
  /** The first heard word is the first after a pause (or the start): the phone may have missed its و. */
  clipped?: boolean;
};

/** How a heard word fits an expected one: its cost in an alignment, how alike they are, and whether it's right. */
function fitOf(w: Forms, x: Heard, known: Set<string> | undefined): { cost: number; score: number; ok: boolean; loose?: boolean } {
  if (sameWord(w, x)) return { cost: 0, score: 1, ok: true };
  if (w.letters) {
    const letters = x.letters ?? (OPENINGS.has(x.f) ? [x.f] : []);
    // Letter names: some of the letters count (the phone missed the others). One letter alone (لا, ميم)
    // is as unsure as a guess, though: on its own it doesn't show where you started.
    const some = letters.filter((l) => within(l, w.f));
    if (some.length) return { cost: SOME_LETTERS, score: some.some((l) => l.length > 1) ? 0.9 : LOOSE_SCORE, ok: true };
    // Another surah's opening letters are a mistake: paired with these at no cost, so it isn't passed over.
    if (letters.some((l) => l.length > 1 && OPENINGS.has(l))) return { cost: 0, score: 0, ok: false };
    if (!AROUND.has(x.f)) return { cost: LOOSE_LETTERS, score: LOOSE_SCORE, ok: true, loose: true };
  }
  // The first word after a pause, its و not heard: phones often miss the first sound after a silence.
  if (x.clipped) {
    const v = withoutWa(w);
    if (v && sameWord(v, x)) return { cost: CLIPPED, score: 0.9, ok: true };
  }
  const s = w.p === w.f ? similarity(w.f, x.f) : Math.max(similarity(w.f, x.f), similarity(w.p, x.f));
  if (!known) return { cost: 1.3 * (1 - s), score: s, ok: s >= SAME };
  // Strict: another word of the Quran is a mistake; a spelling the Quran doesn't have counts when close.
  const ok = s >= CLOSE && !known.has(x.f) && !known.has(x.b);
  return { cost: 1.3 * (1 - s) + (ok ? 0 : WRONG), score: s, ok };
}

/** Whether a heard word is the expected word (strictly, with `known`, as phone recognition is checked). */
export function wordFits(expected: string, heard: string, known?: Set<string>): boolean {
  if (!fold(heard)) return false;
  const x = hear(heard);
  const letters = nameLetters(x.b);
  return fitOf(forms(expected), { ...x, ...(letters.length && { letters }) }, known).ok;
}

/** Said around a recitation rather than in it (the isti'adha, the basmala…), so it doesn't tell where you are. */
export const isAround = (word: string) => AROUND.has(fold(word));

/** Where each spelling of each word is in a text (worked out once per text). */
const placesCache = new WeakMap<string[], Map<string, number[]>>();
function wordPlaces(expected: string[]): Map<string, number[]> {
  let places = placesCache.get(expected);
  if (!places) {
    const map = new Map<string, number[]>();
    expected.forEach((w, i) => {
      const x = forms(w);
      for (const s of new Set([x.f, x.p, ...x.alts])) {
        const l = map.get(s);
        if (l) l.push(i);
        else map.set(s, [i]);
      }
    });
    placesCache.set(expected, map);
    places = map;
  }
  return places;
}

/**
 * Every place in the text where some heard words are said in a row (checked strictly, as phone
 * recognition is), as the index of the first: to find where someone is who didn't go on from where
 * they were (started further on, skipped ahead, went back).
 */
export function findRun(expected: string[], run: string[], known: Set<string>): number[] {
  const h = run.filter((w) => fold(w));
  if (h.length < 2) return [];
  const places = wordPlaces(expected);
  // Candidates: where the rarest of the first few words is, and where two of them are written as one
  // (يا أهل = يَـٰٓأَهْلَ: the words after such a pair aren't where their own spelling is).
  let best: Set<number> | null = null;
  const pairs = new Set<number>();
  for (let k = 0; k < Math.min(3, h.length); k++) {
    const found = new Set<number>();
    for (const key of [fold(h[k]), bare(h[k])]) for (const p of places.get(key) ?? []) found.add(Math.max(0, p - k));
    if (found.size && (!best || found.size < best.size)) best = found;
    if (k + 1 < h.length)
      for (const key of [fold(h[k]) + fold(h[k + 1]), bare(h[k]) + bare(h[k + 1])])
        for (const p of places.get(key) ?? []) pairs.add(Math.max(0, p - k));
  }
  const starts = new Set<number>();
  for (const c of new Set([...(best ?? []), ...pairs])) {
    const r = align(expected, h, Math.max(0, c - 1), { known });
    let a = 0;
    while (a < r.statuses.length && r.statuses[a].status === "skipped") a++;
    const said = r.statuses.slice(a);
    // All right, all of it (one word may be two written as one, or a stray word), from its first word.
    if (!said.length || said.some((s) => s.status !== "correct")) continue;
    if (said.length < h.length - 1 || said[said.length - 1].heard !== h.length - 1 || said[0].heard > 1) continue;
    starts.add(said[0].index);
  }
  return [...starts].sort((x, y) => x - y);
}

/**
 * Aligns heard words to the expected words starting at `from` (edit-distance
 * alignment). Extra heard words (repeating yourself, "a'udhu billah") are
 * ignored. Expected words left out between two matched words are "skipped";
 * a heard word in the place of an expected one that doesn't match is "wrong".
 * Words after the last heard one stay pending.
 */
export function align(expected: string[], heard: string[], from: number, opts: AlignOptions = {}): Alignment {
  const { known, stopped, clipped } = opts;
  let h: Heard[] = [];
  let at: number[] = []; // which word of `heard` each one is
  heard.forEach((w, k) => {
    if (!fold(w)) return;
    h.push({ ...hear(w), ...(clipped && !h.length && { clipped: true }) });
    at.push(k);
  });
  const n = Math.min(expected.length - from, h.length + 8);
  if (!h.length || n <= 0) return { statuses: [], next: from };
  // The expected words within reach, and a few before them (to tell repeating yourself from a mistake).
  const lo = Math.max(0, from - RECENT);
  const ex = expected.slice(lo, from + n).map(forms);
  const off = from - lo;
  // (Opening letters just before `from` too: their names said again are you repeating yourself.)
  [h, at] = joinLetters(h, at, new Set(ex.filter((w) => w.letters).map((w) => w.f)));
  const m = h.length;

  const fit = (w: Forms, x: Heard) => fitOf(w, x, known);
  /** Words joined or split differently: they must match as written (strict) or nearly. */
  const joinFit = (w: Forms, x: Heard) => {
    if (sameWord(w, x)) return { cost: JOIN, score: 1 };
    if (known) return null;
    const s = Math.max(similarity(w.f, x.f), similarity(w.p, x.f));
    return s >= JOIN_SAME ? { cost: 1.3 * (1 - s) + JOIN, score: s } : null;
  };
  const pairs = Array.from({ length: n }, (_, i) => h.map((x) => fit(ex[off + i], x)));
  /** Expected words i-2 and i-1 written as one; heard words j-2 and j-1 as one. */
  const twoExpected = Array.from({ length: n + 1 }, (_, i) => (i >= 2 ? joined(ex[off + i - 2], ex[off + i - 1]) : null));
  const twoHeard = Array.from({ length: m + 1 }, (_, j): Heard | null =>
    j >= 2 ? { f: h[j - 2].f + h[j - 1].f, b: h[j - 2].b + h[j - 1].b } : null,
  );

  // cost[i][j]: aligning expected[0..i) with heard[0..j). Skipping an expected word costs 1, an extra heard
  // word EXTRA, pairing two words 1.3 × (1 − similarity): a near-match is cheap, a wrong word ~1.3.
  // closed[i][j]: the same without ending on an extra heard word (where a stopped recitation may end).
  const table = (fill: number) => Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(fill));
  const cost = table(0);
  const closed = table(Infinity);
  // 1 diag, 2 skip expected, 3 extra heard, 4 two expected = one heard, 5 one expected = two heard
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  const closedMove = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  closed[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    cost[i][0] = closed[i][0] = i;
    move[i][0] = closedMove[i][0] = 2;
  }
  for (let j = 1; j <= m; j++) {
    cost[0][j] = j * EXTRA;
    move[0][j] = 3;
  }
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      // A wrong word costs a bit more than a skipped one, so a later exact match pulls the alignment into place.
      let best = cost[i - 1][j - 1] + pairs[i - 1][j - 1].cost;
      let mv = 1;
      // On a tie, a heard word goes with the earlier of two same words ("الناس" is in every ayah of
      // An-Nas): what you said comes first and the skipped stretch after it, not the other way round.
      const skip = cost[i - 1][j] + (ex[off + i - 1].letters ? LETTERS_SKIP : 1);
      if (skip <= best) [best, mv] = [skip, 2];
      const two = twoExpected[i] && joinFit(twoExpected[i]!, h[j - 1]);
      if (two && cost[i - 2][j - 1] + two.cost < best) [best, mv] = [cost[i - 2][j - 1] + two.cost, 4];
      const split = twoHeard[j] && joinFit(ex[off + i - 1], twoHeard[j]!);
      if (split && cost[i - 1][j - 2] + split.cost < best) [best, mv] = [cost[i - 1][j - 2] + split.cost, 5];
      closed[i][j] = best;
      closedMove[i][j] = mv;
      const extra = cost[i][j - 1] + EXTRA;
      if (extra < best) [best, mv] = [extra, 3];
      cost[i][j] = best;
      move[i][j] = mv;
    }

  // Where the alignment ends. While reciting: wherever is cheapest (the expected words after it are simply
  // still to come, and the last word heard may be the start of what comes next). Once stopped, a heard word
  // left over at the end is fine when it's a repeat or the isti'adha and the like; anything else costs more
  // than a mistake, so the word you stopped on is called one rather than ignored.
  let endI = 0;
  let endJ = m;
  /** After a pause, the last word heard may be the first part of the next one (يا of يَـٰٓأَيُّهَا). */
  const startsNext = (i: number) => {
    const w = ex[off + i];
    const x = h[m - 1];
    return (
      stopped === "pause" &&
      !!w &&
      x.f.length >= 2 &&
      x.f.length < w.f.length &&
      (w.f.startsWith(x.f) || w.p.startsWith(x.f) || w.alts.some((a) => a.startsWith(x.b)))
    );
  };
  if (!stopped) {
    for (let i = 1; i <= n; i++) if (cost[i][m] < cost[endI][m]) endI = i;
  } else {
    const firstFit = h.map((x) =>
      ex.findIndex((w) => {
        const p = fit(w, x);
        return p.ok && !p.loose;
      }),
    );
    let best = Infinity;
    for (let i = 0; i <= n; i++) {
      let tail = 0;
      for (let k = 0; k <= m; k++) {
        if (k) {
          const t = m - k;
          const repeat = firstFit[t] >= 0 && firstFit[t] < off + i;
          const fine = h[t].f.length < 2 || AROUND.has(h[t].f) || repeat || (k === 1 && startsNext(i));
          tail += fine ? EXTRA : UNEXPLAINED;
        }
        if (closed[i][m - k] + tail < best) [best, endI, endJ] = [closed[i][m - k] + tail, i, m - k];
      }
    }
  }
  const rest = endJ === m - 1 && startsNext(endI) ? heard.length - at[m - 1] : 0;

  const statuses: Alignment["statuses"] = [];
  let i = endI;
  let j = endJ;
  let mv = stopped ? closedMove[i][j] : move[i][j];
  while (i > 0 || j > 0) {
    if (mv === 1) {
      const p = pairs[i - 1][j - 1];
      statuses.push({ index: from + i - 1, status: p.ok ? "correct" : "wrong", score: p.score, heard: at[j - 1] });
      i--;
      j--;
    } else if (mv === 2) {
      // Opening letters not heard: said (see LETTERS_SKIP).
      statuses.push({ index: from + i - 1, status: ex[off + i - 1].letters ? "correct" : "skipped", score: 0, heard: -1 });
      i--;
    } else if (mv === 4) {
      const score = joinFit(twoExpected[i]!, h[j - 1])!.score;
      statuses.push({ index: from + i - 1, status: "correct", score, heard: at[j - 1] });
      statuses.push({ index: from + i - 2, status: "correct", score, heard: at[j - 1] });
      i -= 2;
      j--;
    } else if (mv === 5) {
      const score = joinFit(ex[off + i - 1], twoHeard[j]!)!.score;
      statuses.push({ index: from + i - 1, status: "correct", score, heard: at[j - 1] });
      i--;
      j -= 2;
    } else j--;
    mv = move[i][j];
  }
  statuses.reverse();
  // Trailing skips aren't mistakes yet: the person may simply not have got there.
  // (Nor are opening letters not heard yet: they count once what follows them is heard.)
  while (statuses.length && statuses[statuses.length - 1].heard === -1) statuses.pop();
  const last = statuses[statuses.length - 1];
  return { statuses, next: last ? last.index + 1 : from, ...(rest && { rest }) };
}

/** A match this close is trusted from a single pass (it locks the word in as right). */
export const SURE = 0.75;

export type Rating = "strong" | "okay" | "weak";

/**
 * A suggested rating from the result: no mistakes and no help → Strong; a few
 * (up to 1 in 20 words, at least 2) → Okay; more → Weak. Each hint counts as
 * half a mistake.
 */
export function suggestRating(words: number, mistakes: number, hints: number): Rating {
  const score = mistakes + hints / 2;
  if (score === 0) return "strong";
  if (score <= Math.max(2, words / 20)) return "okay";
  return "weak";
}

/**
 * The hint for a word after `presses` presses: short words show whole at
 * once; longer ones one more letter each time, then the whole word.
 */
export function hintText(word: string, presses: number): string {
  if (presses <= 0) return "";
  const letters = [...word.matchAll(/[ء-يٱ][ً-ٰٟۖ-ۭ]*/g)].map((m) => m[0]);
  if (letters.length <= 3 || presses >= letters.length) return word;
  return letters.slice(0, presses).join("") + "…";
}
