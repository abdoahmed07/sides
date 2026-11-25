import { afterEach, describe, expect, it, vi } from "vitest";
import text from "../data/quran-text.json";
import { align, ayahWords, type WordStatus } from "../src/recite/match";
import { reveal } from "../src/recite/reveal";
import { assemble, heardWords, WebSpeech, type SpeechProblem } from "../src/recite/webspeech";
import { q } from "./helpers";

const quran = text as unknown as string[];
const [nasStart] = q.surahRange(114);
const nas = Array.from({ length: 6 }, (_, k) => ayahWords(quran[nasStart + k])).flat(); // 20 words
const pending = (): WordStatus[] => nas.map(() => "pending");
const shown = (s: WordStatus[]) => s.map((v) => (v === "pending" ? "." : v[0])).join("");

describe("putting the phone's recognition results together", () => {
  it("joins pieces (Chrome) and keeps a result that grows (Android, iPhone) once", () => {
    expect(assemble(["قل أعوذ برب الناس", "ملك الناس"])).toBe("قل أعوذ برب الناس ملك الناس");
    expect(assemble(["قل أعوذ", "قل أعوذ برب الناس", "قل أعوذ برب الناس ملك"])).toBe("قل أعوذ برب الناس ملك");
  });

  it("drops a repeated piece, but not a word you really said twice", () => {
    expect(assemble(["قل أعوذ برب الناس", "برب الناس"])).toBe("قل أعوذ برب الناس");
    expect(assemble(["ملك الناس", "الناس"])).toBe("ملك الناس الناس");
  });

  it("ignores punctuation the recognizer adds", () => {
    expect(heardWords("قل أعوذ برب الناس . ؟")).toEqual(["قل", "أعوذ", "برب", "الناس"]);
    // An iPhone writes the "alif" of alif lam mim as a number (ألف is also "a thousand").
    expect(heardWords("\u200F1000 لام ميم")).toEqual(["ألف", "لام", "ميم"]);
    expect(heardWords("١٠٠٠ سنة")).toEqual(["ألف", "سنة"]);
  });
});

describe("revealing words while reciting", () => {
  it("waits on a word not heard right (not marking mistakes) until you go on, then shows it as not heard", () => {
    const settled: WordStatus[] = ["correct", "correct", "wrong", "pending", "pending"];
    // Stopped on it: it stays hidden, waiting for you to say it again.
    expect(reveal(settled, null, undefined, 0, true)).toEqual({ status: ["correct", "correct", "pending", "pending", "pending"], next: 2 });
    // You went on and the next word was heard right: it shows (as not heard), and so does the next one.
    const after: WordStatus[] = ["correct", "correct", "wrong", "correct", "pending"];
    expect(reveal(after, null, undefined, 0, true)).toEqual({ status: after, next: 4 });
    // Marking mistakes: it shows straight away.
    expect(reveal(settled, null, undefined, 0, false).status[2]).toBe("wrong");
  });

  it("reveals words in order: a later word waits for the one before it", () => {
    // Word 2 isn't heard clearly yet, word 3 is: only 0–1 show.
    const live = { statuses: [0, 1, 3].map((index, k) => ({ index, status: "correct" as const, score: 1, heard: k })), heard: 4 };
    const r = reveal(pending(), live);
    expect(shown(r.status).slice(0, 5)).toBe("cc...");
    expect(r.next).toBe(2);
  });

  it("waits with the last word until it's (almost) exact: it may be cut off", () => {
    const heard = "قل اعوذ برب النا".split(" ");
    const r = reveal(pending(), { statuses: align(nas, heard, 0).statuses, heard: heard.length });
    expect(shown(r.status).slice(0, 5)).toBe("ccc..");
  });

  it("shows a mistake only after two right words follow it", () => {
    // Ayah 3 (إله الناس) skipped.
    const settled = pending().map((s, i) => (i < 6 ? "correct" : s));
    const one = "من".split(" ");
    const a = reveal(settled, { statuses: align(nas, one, 6).statuses, heard: one.length });
    expect(shown(a.status).slice(6, 10)).toBe("....");
    const three = "من شر الوسواس".split(" ");
    const b = reveal(settled, { statuses: align(nas, three, 6).statuses, heard: three.length });
    expect(shown(b.status).slice(6, 12)).toBe("ssccc.");
  });

  it("keeps settled words as they are, and adds words heard right earlier (on-device mode)", () => {
    const settled = pending().map((s, i): WordStatus => (i === 0 ? "correct" : i === 1 ? "wrong" : s));
    const r = reveal(settled, null, new Set([2, 4]));
    expect(shown(r.status).slice(0, 6)).toBe("cwc...");
    expect(r.next).toBe(3);
  });
});

describe("the phone's speech recognition", () => {
  type Handler = ((e?: unknown) => void) | null;
  class FakeRec {
    static all: FakeRec[] = [];
    lang = "";
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onresult: Handler = null;
    onerror: Handler = null;
    onend: Handler = null;
    onsoundstart: Handler = null;
    onspeechstart: Handler = null;
    started = false;
    constructor() {
      FakeRec.all.push(this);
    }
    start() {
      this.started = true;
    }
    stop() {
      setTimeout(() => this.onend?.(), 0);
    }
    abort() {}
    say(parts: [string, boolean][]) {
      const results = parts.map(([t, isFinal]) => Object.assign([{ transcript: t }], { isFinal }));
      this.onresult?.({ results });
    }
  }
  const setup = () => {
    FakeRec.all = [];
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRec });
    const got: { text: string; final: boolean }[] = [];
    const problems: SpeechProblem[] = [];
    const ends: number[] = [];
    const s = new WebSpeech({
      onText: (text, final) => got.push({ text, final }),
      onSessionEnd: () => ends.push(1),
      onError: (p) => problems.push(p),
    });
    return { s, got, problems, ends };
  };
  afterEach(() => vi.unstubAllGlobals());

  it("listens in Arabic, with live results, and carries on in a new session when one ends", () => {
    const { s, got, ends } = setup();
    s.start();
    const first = FakeRec.all[0];
    expect([first.lang, first.continuous, first.interimResults, first.started]).toEqual(["ar-SA", true, true, true]);
    first.say([["قل أعوذ", false]]);
    first.say([["قل أعوذ برب الناس", true]]);
    expect(got).toEqual([
      { text: "قل أعوذ", final: false },
      { text: "قل أعوذ برب الناس", final: true },
    ]);
    first.onend?.();
    expect(ends).toHaveLength(1);
    expect(FakeRec.all).toHaveLength(2);
    expect(FakeRec.all[1].started).toBe(true);
  });

  it("explains a blocked microphone, and asks for a tap when it stops working later", () => {
    const a = setup();
    a.s.start();
    FakeRec.all[0].onerror?.({ error: "not-allowed" });
    expect(a.problems).toEqual(["blocked"]);

    const b = setup();
    b.s.start();
    FakeRec.all[0].say([["قل", false]]);
    FakeRec.all[0].onerror?.({ error: "not-allowed" });
    expect(b.problems).toEqual(["interrupted"]);
  });

  it("gives up when sessions keep ending at once (e.g. not available here)", () => {
    const { s, problems } = setup();
    s.start();
    for (let k = 0; k < 3; k++) FakeRec.all[k].onend?.();
    expect(problems).toEqual(["unavailable"]);
  });

  it("stops when asked, without starting a new session", async () => {
    const { s, ends } = setup();
    s.start();
    await s.stop();
    expect(ends).toHaveLength(1);
    expect(FakeRec.all).toHaveLength(1);
  });
});
