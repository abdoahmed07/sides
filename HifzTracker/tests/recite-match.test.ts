import { describe, expect, it } from "vitest";
import text from "../data/quran-text.json";
import { align, ayahWords, fold, hintText, similarity, suggestRating } from "../src/recite/match";
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

  it("doesn't call the words you haven't reached yet skipped", () => {
    const r = align(nas, ["قل"], 0);
    expect(r.statuses).toEqual([{ index: 0, status: "correct", score: 1, heard: 0 }]);
    expect(r.next).toBe(1);
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
