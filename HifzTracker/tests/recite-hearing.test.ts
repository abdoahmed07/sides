import { describe, expect, it } from "vitest";
import text from "../data/quran-text.json";
import { Hearing, type Settled } from "../src/recite/hearing";
import { ayahWords, quranWords } from "../src/recite/match";
import { q } from "./helpers";

const quran = text as unknown as string[];
const known = quranWords(quran);
const words = (surah: number, from: number, to: number) => {
  const [a] = q.surahRange(surah);
  return Array.from({ length: to - from + 1 }, (_, k) => ayahWords(quran[a + from - 1 + k])).flat();
};

/** A Hearing over some text, and what it decided for each word. */
function hearing(expected: string[]) {
  const status: (Settled | "pending")[] = expected.map(() => "pending");
  const h = new Hearing(expected, known, () => expected.length, {
    statuses: (updates) => {
      for (const [i, s] of updates) status[i] = s;
    },
  });
  /** The phone writing a session's text word by word (one text after another, as it grows). */
  const grow = (from: string, to: string) => {
    let t = from;
    for (const w of to.split(" ")) h.hear((t = `${t} ${w}`.trim()));
    return t;
  };
  return { h, status, grow };
}

describe("following what the phone writes", () => {
  it("settles each ayah when you pause after it", () => {
    const { h, status, grow } = hearing(words(114, 1, 3));
    let t = grow("", "قل أعوذ برب الناس");
    h.settle(false);
    t = grow(t, "ملك الناس");
    h.settle(false);
    grow(t, "إله الناس");
    h.settle(true);
    expect(status).toEqual(Array(8).fill("correct"));
  });

  it("turns a word right when the phone rewrites it (its final version, after a guess)", () => {
    // What an iPhone did with Al-Baqarah 2:2: "ولا ريبة" first, settled at the pause, then "لا ريب".
    const { h, status } = hearing(words(2, 2, 2));
    h.hear("ذلك الكتاب ولا ريبة فيه هدى للمتقين");
    h.settle(false);
    expect(status[2]).toBe("wrong");
    h.hear("ذلك الكتاب لا ريب فيه هدى للمتقين");
    expect(status[2]).toBe("correct");
  });

  it("keeps a word right that the phone once wrote right, whatever it writes later", () => {
    // Al-Baqarah 2:14: "شياطين هم" while you go on, then the phone's final text drops "هم".
    const { h, status, grow } = hearing(words(2, 14, 14));
    grow("", "وإذا لقوا الذين آمنوا قالوا آمنا وإذا خلوا إلى شياطين هم قالوا");
    h.hear("وإذا لقوا الذين آمنوا قالوا آمنا وإذا خلوا إلى شياطين قالوا إنا معكم إنما نحن مستهزئون");
    h.settle(true);
    expect(status.every((s) => s === "correct")).toBe(true);
  });

  it("carries on into a new session (the phone starts its text over)", () => {
    const { h, status } = hearing(words(114, 1, 4));
    h.hear("قل أعوذ برب الناس ملك الناس");
    h.sessionEnded();
    h.newSession();
    h.hear("إله الناس من شر الوسواس الخناس");
    h.settle(true);
    expect(status).toEqual(Array(12).fill("correct"));
  });

  it("turns a word you stopped on right when you say it again", () => {
    const { h, status } = hearing(words(114, 1, 2));
    h.hear("قل أعوذ برب الفلق");
    h.settle(false);
    expect(status[3]).toBe("wrong");
    // A new session (you tapped to go on), saying it again and going on.
    h.newSession();
    h.hear("الناس ملك الناس");
    h.settle(true);
    expect(status).toEqual(Array(6).fill("correct"));
  });

  it("still calls a wrong word a mistake", () => {
    const { h, status } = hearing(words(114, 1, 2));
    h.hear("قل أعوذ برب الفلق ملك الناس");
    h.settle(true);
    expect(status).toEqual(["correct", "correct", "correct", "wrong", "correct", "correct"]);
  });
});
