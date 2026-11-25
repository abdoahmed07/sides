import { describe, expect, it } from "vitest";
import text from "../data/quran-text.json";
import { follow, type FollowOptions } from "../src/recite/follow";
import { ayahWords, quranWords } from "../src/recite/match";
import { q } from "./helpers";

const quran = text as unknown as string[];
const known = quranWords(quran);
const [first, last] = q.surahRange(2);
const ayahs = Array.from({ length: last - first + 1 }, (_, k) => ayahWords(quran[first + k]));
const baqarah = ayahs.flat(); // all of Al-Baqarah, as when it's opened from the Quran tab
/** Where ayah n of Al-Baqarah starts among its words. */
const at = (n: number) => ayahs.slice(0, n - 1).reduce((sum, a) => sum + a.length, 0);
/** Plain Arabic, as the phone writes it (Tanzil's simple text). */
const said = (s: string) => s.split(" ");
const PLAIN: Record<number, string> = {
  1: "الم",
  2: "ذلك الكتاب لا ريب فيه هدى للمتقين",
  3: "الذين يؤمنون بالغيب ويقيمون الصلاة ومما رزقناهم ينفقون",
  4: "والذين يؤمنون بما أنزل إليك وما أنزل من قبلك وبالآخرة هم يوقنون",
  5: "أولئك على هدى من ربهم وأولئك هم المفلحون",
  6: "إن الذين كفروا سواء عليهم أأنذرتهم أم لم تنذرهم لا يؤمنون",
  7: "ختم الله على قلوبهم وعلى سمعهم وعلى أبصارهم غشاوة ولهم عذاب عظيم",
  255: "الله لا إله إلا هو الحي القيوم لا تأخذه سنة ولا نوم له ما في السماوات وما في الأرض",
};
const live = { known, mode: "live" as const };

describe("finding where you are", () => {
  it("starts where you start: Ayat al-Kursi in a whole Al-Baqarah", () => {
    // Its first words (لا إله إلا هو) are in 2:163 too: it listens on until it can tell.
    const step = follow(baqarah, said(PLAIN[255]).slice(0, 7), 0, { ...live, begun: false });
    expect(step.start).toBe(at(255));
    expect(step.settled).toEqual([]);
    expect(step.live!.statuses.map((s) => [s.index, s.status])).toEqual(
      Array.from({ length: 7 }, (_, k) => [at(255) + k, "correct"]),
    );
  });

  it("starts at the beginning as usual, the isti'adha and basmala before it", () => {
    const step = follow(baqarah, said(`أعوذ بالله من الشيطان الرجيم بسم الله الرحمن الرحيم ${PLAIN[1]} ${PLAIN[2]}`), 0, { ...live, begun: false });
    expect(step.start).toBeUndefined();
    expect(step.live!.statuses.every((s) => s.status === "correct")).toBe(true);
    expect(step.live!.next).toBe(at(3));
  });

  it("follows you when you skip ahead: the words in between are skipped", () => {
    const step = follow(baqarah, said(PLAIN[7]).slice(0, 6), at(6), { ...live, begun: true });
    expect(step.settled.map((s) => s.status)).toEqual(ayahs[5].map(() => "skipped"));
    expect(step.next).toBe(at(7));
    expect(step.live!.statuses.every((s) => s.status === "correct")).toBe(true);
  });

  it("doesn't call going back to repeat yourself a mistake, even when you pause there", () => {
    const step = follow(baqarah, said(PLAIN[4]).slice(-5), at(5), { known, mode: "pause", begun: true });
    expect(step.settled).toEqual([]);
    expect(step.next).toBe(at(5));
    expect(step.used).toBe(5);
  });

  it("still calls a wrong word a mistake, not a jump", () => {
    const heard = said(PLAIN[2]);
    heard[2] = "إن"; // ذلك الكتاب إن ريب فيه…
    const step = follow(baqarah, heard, at(2), { known, mode: "pause", begun: true });
    expect(step.settled.map((s) => s.status)).toEqual(["correct", "correct", "wrong", "correct", "correct", "correct", "correct"]);
  });

  it("settles the older words of a long stretch without a pause, so each new word stays quick", () => {
    const heard = said([2, 3, 4, 5, 6].map((n) => PLAIN[n]).join(" "));
    const step = follow(baqarah, heard, at(2), { ...live, begun: true });
    expect(step.settled.length).toBeGreaterThan(0);
    expect(step.settled.every((s) => s.status === "correct")).toBe(true);
    expect(heard.length - step.used).toBeLessThanOrEqual(30);
    expect(step.live!.statuses.every((s) => s.status === "correct")).toBe(true);
    expect(step.live!.next).toBe(at(7));
  });
});

/** The words of a surah, and where each ayah starts among them. */
const surah = (n: number) => {
  const [a, b] = q.surahRange(n);
  const list = Array.from({ length: b - a + 1 }, (_, k) => ayahWords(quran[a + k]));
  const starts = list.map((_, k) => list.slice(0, k).reduce((sum, x) => sum + x.length, 0));
  return { words: list.flat(), starts };
};

/** Recites stretches of plain Arabic with a pause after each (the last one ends it), and returns the result. */
function recite(expected: string[], parts: string[]) {
  const status: string[] = expected.map(() => "pending");
  let at = 0;
  let begun = false;
  let start: number | undefined;
  let carry: string[] = [];
  parts.forEach((part, k) => {
    const words = [...carry, ...said(part)];
    const mode: FollowOptions["mode"] = k === parts.length - 1 ? "end" : "pause";
    const step = follow(expected, words, at, { known, mode, begun });
    if (step.start !== undefined) start = step.start;
    for (const s of step.settled) status[s.index] = s.status;
    if (step.settled.length) begun = true;
    at = Math.max(at, step.next);
    carry = words.slice(step.used);
  });
  const flagged = status.map((s, i) => [i, s] as const).filter(([, s]) => s === "wrong" || s === "skipped");
  return { status, start, flagged };
}

describe("following a recitation over pauses", () => {
  it("tells ayahs that open alike apart: 22:8 starts like 22:3 for eight words", () => {
    const { words, starts } = surah(22);
    const r = recite(words, ["ومن الناس من يجادل في الله بغير علم ولا هدى ولا كتاب منير"]);
    expect(r.start).toBe(starts[7]);
    expect(r.flagged).toEqual([]);
  });

  it("waits, after a short first ayah, until it can tell where you are", () => {
    const { words, starts } = surah(90);
    const r = recite(words, ["فلا اقتحم العقبة", "وما أدراك ما العقبة", "فك رقبة"]);
    expect(r.start).toBe(starts[10]);
    expect(r.flagged).toEqual([]);
    expect(r.status.slice(starts[10], starts[13]).every((s) => s === "correct")).toBe(true);
  });

  it("finds a skipped ayah among Ar-Rahman's refrains", () => {
    const { words, starts } = surah(55);
    const refrain = "فبأي آلاء ربكما تكذبان";
    const r = recite(words, [refrain, "سنفرغ لكم أيه الثقلان", refrain, refrain, "يرسل عليكما شواظ من نار ونحاس فلا تنتصران"]);
    // 55:33 was skipped, and only it.
    expect(r.flagged.map(([i]) => i)).toEqual(Array.from({ length: starts[33] - starts[32] }, (_, k) => starts[32] + k));
    expect(r.status.slice(starts[33], starts[35]).every((s) => s === "correct")).toBe(true);
  });

  it("calls a skipped ayah skipped where the next one is built the same way (Ash-Shams)", () => {
    const { words, starts } = surah(91);
    const r = recite(words, ["والنهار إذا جلاها", "والليل إذا يغشاها", "والأرض وما طحاها", "ونفس وما سواها"]);
    expect(r.flagged).toEqual([0, 1, 2].map((k) => [starts[4] + k, "skipped"]));
  });

  it("finds you after a long skipped ayah, from the few words you stop on", () => {
    const { words, starts } = surah(74);
    const r = recite(words, ["لواحة للبشر", "عليها تسعة عشر", "كلا والقمر", "والليل إذ أدبر"]);
    expect(r.flagged.every(([i, s]) => s === "skipped" && i >= starts[30] && i < starts[31])).toBe(true);
    expect(r.flagged).toHaveLength(starts[31] - starts[30]);
  });

  it("starting a little in is where you started, not a skip", () => {
    const { words } = surah(1);
    expect(recite(words, ["الحمد لله رب العالمين", "الرحمن الرحيم"])).toMatchObject({ start: 4, flagged: [] });
  });
});
