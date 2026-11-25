import { describe, expect, it } from "vitest";
import text from "../data/quran-text.json";
import { align, ayahWords, fold, hintText, LOOSE_SCORE, quranWords, similarity, suggestRating } from "../src/recite/match";
import { q } from "./helpers";

const quran = text as unknown as string[];
const words = (surah: number, from = 1, to = q.surah(surah).ayahs) => {
  const [a] = q.surahRange(surah);
  return Array.from({ length: to - from + 1 }, (_, k) => ayahWords(quran[a + from - 1 + k])).flat();
};

describe("comparing Uthmani text with what the model writes", () => {
  it("treats the Uthmani and plain spellings of a word as the same", () => {
    // Al-Ikhlas 1–2 in plain Arabic, as a speech model would write it.
    const ikhlas = words(112, 1, 2);
    const plain = "قل هو الله احد الله الصمد".split(" ");
    ikhlas.forEach((w, k) => expect(similarity(fold(w), fold(plain[k]))).toBeGreaterThanOrEqual(0.7));
  });

  it("accepts the plain spelling of words the mushaf writes with a small alef", () => {
    const score = (expected: string[], heard: string) => align(expected, [heard], 0).statuses[0].score;
    expect(score(["إِلَـٰهِ"], "إله")).toBe(1);
    expect(score(["هَـٰذَا"], "هذا")).toBe(1);
    expect(score(["عَلَىٰ"], "على")).toBe(1);
    expect(score(["ٱلصَّلَوٰةَ"], "الصلاة")).toBe(1);
    expect(score(["إِبْرَٰهِـۧمَ"], "إبراهيم")).toBe(1);
    // …and where plain Arabic writes the alef, that too.
    expect(score(["مَـٰلِكِ"], "مالك")).toBe(1);
    expect(score(["ٱلْكِتَـٰبُ"], "الكتاب")).toBe(1);
  });

  it("leaves out stand-alone pause signs", () => {
    expect(ayahWords("ذَٰلِكَ ٱلْكِتَـٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى")).toHaveLength(6);
  });
});

describe("aligning a recitation", () => {
  const nas = words(114); // An-Nas, 20 words

  it("marks a correct recitation word by word", () => {
    const heard = "قل اعوذ برب الناس ملك الناس".split(" ");
    const r = align(nas, heard, 0);
    expect(r.statuses.every((s) => s.status === "correct")).toBe(true);
    expect(r.next).toBe(6);
  });

  it("finds a skipped word and a wrong word, and continues from where you are", () => {
    // Skips "ملك"; says "خير" instead of "شر".
    const heard = "قل اعوذ برب الناس الناس اله الناس من خير الوسواس".split(" ");
    const r = align(nas, heard, 0);
    const by = Object.fromEntries(r.statuses.map((s) => [s.index, s.status]));
    expect(by[4]).toBe("skipped"); // ملك
    expect(by[9]).toBe("wrong"); // شر
    expect(r.statuses.filter((s) => s.status !== "correct")).toHaveLength(2);
    expect(r.next).toBe(11);
    // The next chunk carries on from there.
    const r2 = align(nas, "الخناس الذي يوسوس".split(" "), r.next);
    expect(r2.statuses.map((s) => s.status)).toEqual(["correct", "correct", "correct"]);
  });

  it("ignores extra words like the isti'adha and repeating yourself", () => {
    const heard = "اعوذ بالله من الشيطان الرجيم قل اعوذ اعوذ برب الناس".split(" ");
    const r = align(nas, heard, 0);
    expect(r.statuses.filter((s) => s.status !== "correct")).toEqual([]);
    expect(r.next).toBe(4);
  });

  it("scores each pairing, so only confident matches are trusted from one pass", () => {
    // A cut-off "الوسواس" ("الوس") looks a bit like "إله" but isn't a confident match.
    const r = align(nas, ["الوس"], 6);
    expect(r.statuses[0].score).toBeLessThan(0.75);
    expect(align(nas, ["اله"], 6).statuses[0].score).toBeGreaterThanOrEqual(0.75);
  });

  it("forgives one misheard letter in a short word, but not a different word", () => {
    const heard = "قل اعوذ برب الناس تلك الناس".split(" ");
    expect(align(nas, heard, 0).statuses.every((s) => s.status === "correct")).toBe(true);
    expect(align(nas, "قل اعوذ برب البيت".split(" "), 0).statuses[3].status).toBe("wrong");
  });

  it("accepts words the mushaf joins and plain Arabic splits (يا أيها), and the other way round", () => {
    // Al-Baqarah 21: يَٰٓأَيُّهَا is one word in the mushaf.
    const baqarah = words(2, 21, 21);
    const r = align(baqarah, "يا ايها الناس اعبدوا ربكم".split(" "), 0);
    expect(r.statuses.map((s) => s.status)).toEqual(["correct", "correct", "correct", "correct"]);
    expect(r.next).toBe(4);
    // Two words heard as one.
    const r2 = align(nas, "قل اعوذ بربالناس".split(" "), 0);
    expect(r2.statuses.map((s) => s.status)).toEqual(["correct", "correct", "correct", "correct"]);
  });

  it("pairs a repeated word with its first place, so a skipped ayah is the one flagged", () => {
    // Ayah 2, then ayah 4 (ayah 3 "إله الناس" skipped): "الناس" belongs to ayah 2.
    const r = align(nas, "ملك الناس من شر الوسواس الخناس".split(" "), 4);
    const by = Object.fromEntries(r.statuses.map((s) => [s.index, s.status]));
    expect([by[4], by[5], by[6], by[7]]).toEqual(["correct", "correct", "skipped", "skipped"]);
    expect(r.next).toBe(12);
  });

  it("still catches a skipped word next to a word that was said", () => {
    const by = Object.fromEntries(align(nas, "قل اعوذ الناس ملك".split(" "), 0).statuses.map((s) => [s.index, s.status]));
    expect(by[2]).toBe("skipped"); // برب
    expect(by[3]).toBe("correct");
  });

  it("doesn't call the words you haven't reached yet skipped", () => {
    const r = align(nas, ["قل"], 0);
    expect(r.statuses).toEqual([{ index: 0, status: "correct", score: 1, heard: 0 }]);
    expect(r.next).toBe(1);
  });
});

describe("checking the phone's recognition strictly", () => {
  const known = quranWords(quran);
  const strict = { known };
  const at = (surah: number, ayah: number) => q.surahRange(surah)[0] + ayah - 1;
  /** Statuses for a recitation of whole ayahs, as words of the given ayahs (strict, as the phone is checked). */
  const check = (surah: number, ayah: number, heard: string, opts = {}) =>
    align(ayahWords(quran[at(surah, ayah)]), heard.split(" "), 0, { ...strict, ...opts }).statuses.map((s) => s.status);

  it("calls a similar word a mistake, where the forgiving check let it through", () => {
    const fatiha = words(1, 1, 4); // بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين
    const heard = "بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحيم الرحيم مالك يوم الدين".split(" ");
    expect(align(fatiha, heard, 0, strict).statuses[8].status).toBe("wrong");
    expect(align(fatiha, heard, 0).statuses[8].status).toBe("correct");
    // One letter off, but another word: يعلمون for تعلمون, عليه for عليهم, الذي for الذين.
    const baqarah216 = "كتب عليكم القتال وهو كره لكم وعسى أن تكرهوا شيئا وهو خير لكم وعسى أن تحبوا شيئا وهو شر لكم والله يعلم وأنتم لا";
    expect(check(2, 216, `${baqarah216} يعلمون`, { stopped: "end" }).at(-1)).toBe("wrong");
    expect(check(2, 216, `${baqarah216} تعلمون`, { stopped: "end" }).at(-1)).toBe("correct");
    expect(check(1, 7, "صراط الذين أنعمت عليه غير المغضوب عليهم ولا الضالين")[3]).toBe("wrong");
    expect(check(1, 7, "صراط الذي أنعمت عليهم غير المغضوب عليهم ولا الضالين")[1]).toBe("wrong");
  });

  it("accepts the plain spellings phones write", () => {
    // Plain Arabic as the phone writes it (Tanzil's simple text): hamza, small alef, silent letters, يا joined.
    const plain: [number, number, string][] = [
      [2, 3, "الذين يؤمنون بالغيب ويقيمون الصلاة ومما رزقناهم ينفقون"],
      [2, 40, "يا بني إسرائيل اذكروا نعمتي التي أنعمت عليكم وأوفوا بعهدي أوف بعهدكم وإياي فارهبون"],
      [7, 60, "قال الملأ من قومه إنا لنراك في ضلال مبين"],
      [20, 9, "وهل أتاك حديث موسى"],
      [3, 66, "ها أنتم هؤلاء حاججتم فيما لكم به علم فلم تحاجون فيما ليس لكم به علم والله يعلم وأنتم لا تعلمون"],
      [12, 87, "يا بني اذهبوا فتحسسوا من يوسف وأخيه ولا تيأسوا من روح الله إنه لا ييأس من روح الله إلا القوم الكافرون"],
      [10, 94, "فإن كنت في شك مما أنزلنا إليك فاسأل الذين يقرءون الكتاب من قبلك لقد جاءك الحق من ربك فلا تكونن من الممترين"],
      [38, 26, "يا داوود إنا جعلناك خليفة في الأرض فاحكم بين الناس بالحق ولا تتبع الهوى فيضلك عن سبيل الله إن الذين يضلون عن سبيل الله لهم عذاب شديد بما نسوا يوم الحساب"],
      [106, 2, "إيلافهم رحلة الشتاء والصيف"],
    ];
    for (const [surah, ayah, heard] of plain) {
      const statuses = check(surah, ayah, heard, { stopped: "end" });
      expect(statuses.length, `${surah}:${ayah}`).toBe(ayahWords(quran[at(surah, ayah)]).length);
      expect(statuses.every((s) => s === "correct"), `${surah}:${ayah}`).toBe(true);
    }
  });

  it("hears the opening letters said by their names (alif lam mim)", () => {
    const baqarah = words(2, 1, 2);
    const r = align(baqarah, "ألف لام ميم ذلك الكتاب لا ريب فيه هدى للمتقين".split(" "), 0, strict);
    expect(r.statuses.map((s) => s.status)).toEqual(baqarah.map(() => "correct"));
    expect(align(words(36, 1, 2), "ياسين والقرآن الحكيم".split(" "), 0, strict).statuses.every((s) => s.status === "correct")).toBe(true);
    // …or as the letters themselves.
    expect(align(baqarah, "ا ل م ذلك الكتاب".split(" "), 0, strict).statuses.every((s) => s.status === "correct")).toBe(true);
  });

  it("counts the opening letters as said when the phone doesn't catch them (drawn out, they're often missed)", () => {
    const baqarah = words(2, 1, 2);
    for (const heard of ["ذلك الكتاب لا ريب فيه", "اللهم ذلك الكتاب لا ريب فيه"]) {
      const r = align(baqarah, heard.split(" "), 0, strict);
      expect(r.statuses[0]).toMatchObject({ index: 0, status: "correct" });
      expect(r.statuses.every((s) => s.status === "correct"), heard).toBe(true);
    }
    // On its own, a guess like that only counts as a guess (it doesn't show where you started: see follow).
    expect(align(baqarah, ["اللهم"], 0, { ...strict, stopped: "pause" }).statuses[0]).toMatchObject({ index: 0, status: "correct", score: LOOSE_SCORE });
  });

  it("forgives the phone's spelling of the drawn-out letter names", () => {
    const baqarah = words(2, 1, 2);
    const next = " ذلك الكتاب لا ريب فيه";
    // Some of the names (the phone missed one), the names cut short, or a word that sounds like them.
    for (const alm of ["ألف لام", "الف لا ميم", "الف لا م", "الف لاميم", "لام ميم", "الف", "ميم", "علم", "عالم", "اليم", "آلام"]) {
      const r = align(baqarah, (alm + next).split(" "), 0, strict);
      expect(r.statuses.map((s) => s.status), alm).toEqual(baqarah.slice(0, 6).map(() => "correct"));
    }
    // The isti'adha and basmala before them aren't taken for them.
    const r = align(baqarah, `أعوذ بالله من الشيطان الرجيم بسم الله الرحمن الرحيم${next}`.split(" "), 0, strict);
    expect(r.statuses[0]).toMatchObject({ index: 0, status: "correct", heard: -1 });
  });

  it("still calls another surah's opening letters a mistake", () => {
    const baqarah = words(2, 1, 2);
    for (const other of ["ألف لام را", "الر", "حا ميم", "ألف لام ميم صاد"]) {
      const r = align(baqarah, `${other} ذلك الكتاب لا ريب`.split(" "), 0, strict);
      expect(r.statuses.map((s) => s.status), other).toEqual(["wrong", "correct", "correct", "correct", "correct"]);
    }
    // …but not the letters of the next one, said in the right place (Ash-Shura 42:1–2).
    const shura = words(42, 1, 3);
    expect(align(shura, "حا ميم عين سين قاف كذلك يوحي".split(" "), 0, strict).statuses.slice(0, 4).map((s) => s.status)).toEqual(
      ["correct", "correct", "correct", "correct"],
    );
  });

  it("forgives what an iPhone wrote in a real recitation (Al-Baqarah 2:2–5)", () => {
    const baqarah = words(2, 1, 5);
    // لَا رَيْبَ فِيهِ, "rayba fih": the joined vowel written as ة.
    expect(align(baqarah, "ذلك الكتاب لا ريبة فيه".split(" "), 1, strict).statuses.map((s) => s.status)).toEqual(Array(5).fill("correct"));
    // The و of وَأُو۟لَـٰٓئِكَ not heard, after a pause…
    const at = baqarah.length - 3;
    const end = (clipped: boolean) => align(baqarah, "اولائك هم المفلحون".split(" "), at, { ...strict, stopped: "end", clipped }).statuses[0].status;
    expect(end(true)).toBe("correct");
    // …but in the middle of reciting it's a mistake.
    expect(end(false)).toBe("wrong");
  });

  it("doesn't call the letter names said again a mistake (the phone writing them once more)", () => {
    const baqarah = words(2, 1, 2);
    const r = align(baqarah, ["لام", "ميم"], 1, { ...strict, stopped: "pause" });
    expect(r.statuses.filter((s) => s.status !== "correct")).toEqual([]);
  });
});

describe("when you stop", () => {
  const known = quranWords(quran);
  const nas = words(114);
  const stop = (heard: string, from = 0, stopped: "pause" | "end" = "pause") =>
    align(nas, heard.split(" "), from, { known, stopped });

  it("calls a wrong word you stop on a mistake (while reciting, it waits)", () => {
    expect(stop("قل أعوذ برب الفلق").statuses.map((s) => s.status)).toEqual(["correct", "correct", "correct", "wrong"]);
    // Even a word nothing like the right one.
    expect(stop("قل أعوذ برب يوم").statuses[3]).toMatchObject({ index: 3, status: "wrong" });
    // Still reciting: the last word may be the start of what comes next, so it's left open.
    expect(align(nas, "قل أعوذ برب يوم".split(" "), 0, { known }).statuses.every((s) => s.status === "correct")).toBe(true);
  });

  it("doesn't count the isti'adha, the basmala, repeating yourself or sadaqa Allahu l-'azim", () => {
    expect(stop("أعوذ بالله من الشيطان الرجيم بسم الله الرحمن الرحيم").statuses).toEqual([]);
    expect(stop("قل أعوذ برب الناس ملك الناس الناس").statuses.every((s) => s.status === "correct")).toBe(true);
    const end = stop("من الجنة والناس صدق الله العظيم", 17, "end");
    expect(end.statuses.map((s) => s.status)).toEqual(["correct", "correct", "correct"]);
  });

  it("after a pause, lets the start of a word wait for the rest (يا of يا أيها)", () => {
    const baqarah = words(2, 21, 21); // يَـٰٓأَيُّهَا ٱلنَّاسُ ٱعْبُدُوا۟ رَبَّكُمُ …
    const paused = align(baqarah, ["يا"], 0, { known, stopped: "pause" });
    expect(paused).toMatchObject({ statuses: [], rest: 1 });
    expect(align(baqarah, "يا أيها الناس اعبدوا".split(" "), 0, { known, stopped: "pause" }).statuses.every((s) => s.status === "correct")).toBe(true);
    // At the end it's decided.
    expect(align(baqarah, ["يا"], 0, { known, stopped: "end" }).statuses[0].status).toBe("wrong");
  });
});

describe("rating and hints", () => {
  it("suggests a rating from mistakes and hints", () => {
    expect(suggestRating(100, 0, 0)).toBe("strong");
    expect(suggestRating(100, 2, 1)).toBe("okay");
    expect(suggestRating(20, 5, 0)).toBe("weak");
    expect(suggestRating(100, 0, 1)).toBe("okay");
  });

  it("reveals long words a letter at a time and short words at once", () => {
    const word = words(114, 4, 4)[2]; // ٱلْوَسْوَاسِ
    expect(hintText(word, 0)).toBe("");
    expect(hintText(word, 1)).toMatch(/…$/);
    expect(hintText(word, 2).length).toBeGreaterThan(hintText(word, 1).length);
    expect(hintText(word, 99)).toBe(word);
    expect(hintText("قُلْ", 1)).toBe("قُلْ");
  });
});
