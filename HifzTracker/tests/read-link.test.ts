import { describe, expect, it } from "vitest";
import { decodeAyahs, encodeAyahs, parseTarget, readHref } from "../src/lib/read";

describe("reader links", () => {
  it("keeps a backward portion's order (An-Nas before Al-Falaq)", () => {
    const ayahs = [6230, 6231, 6232, 6225, 6226];
    expect(encodeAyahs(ayahs)).toBe("6230-6232,6225-6226");
    expect(decodeAyahs("6230-6232,6225-6226")).toEqual(ayahs);
  });

  it("reads what to show from the link, and ignores nonsense", () => {
    const p = (s: string) => parseTarget(new URLSearchParams(s));
    expect(p("surah=18")).toEqual({ kind: "surah", surah: 18 });
    expect(p("page=604")).toEqual({ kind: "page", page: 604 });
    expect(p("juz=30")).toEqual({ kind: "juz", juz: 30 });
    expect(p("page=999")).toEqual({ kind: "index" });
    expect(p("a=abc")).toEqual({ kind: "index" });
    expect(p("")).toEqual({ kind: "index" });
  });

  it("links from Today carry the item so Recite can save it", () => {
    expect(readHref({ kind: "ayahs", ayahs: [6230, 6231] }, { item: "sabaq", date: "2026-11-23" })).toBe(
      "/read/?a=6230-6231&item=sabaq&date=2026-11-23",
    );
  });
});
