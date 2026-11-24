import { describe, expect, it } from "vitest";
import { RECITERS, audioUrl, portionOrder, reciterById, segment, waitsAfter } from "../src/audio/recitation";
import { q } from "./helpers";

describe("listen and repeat", () => {
  it("plays straight through from the chosen ayah", () => {
    expect(segment("listen", 5, 0)).toEqual([0, 1, 2, 3, 4]);
    expect(segment("listen", 5, 3)).toEqual([3, 4]);
  });

  it("repeats one ayah at a time, and links ayahs 1…k", () => {
    expect(segment("repeat", 5, 2)).toEqual([2]);
    expect(segment("link", 5, 0)).toEqual([0]);
    expect(segment("link", 5, 2)).toEqual([0, 1, 2]);
  });

  it("stays inside the portion", () => {
    expect(segment("repeat", 3, 9)).toEqual([2]);
    expect(segment("link", 3, -1)).toEqual([0]);
    expect(segment("listen", 0, 0)).toEqual([]);
  });

  it("waits for the person in repeat and link, never on a timer", () => {
    expect(waitsAfter("listen")).toBe(false);
    expect(waitsAfter("repeat")).toBe(true);
    expect(waitsAfter("link")).toBe(true);
  });

  it("builds one file per ayah, named by surah and ayah", () => {
    const r = reciterById("husary");
    expect(audioUrl(r, 0)).toBe("https://everyayah.com/data/Husary_128kbps/001001.mp3");
    expect(audioUrl(r, 7)).toMatch(/\/002001\.mp3$/); // Al-Baqarah 1
    expect(audioUrl(r, q.surahRange(18)[0] + 9)).toMatch(/\/018010\.mp3$/);
    expect(audioUrl(r, 6235)).toMatch(/\/114006\.mp3$/);
    expect(reciterById("unknown")).toBe(RECITERS[0]);
  });

  it("reads a backward portion surah by surah from the end, each surah top to bottom", () => {
    const [nas] = q.surahRange(114);
    const [falaq] = q.surahRange(113);
    // An-Nas then Al-Falaq, as a plan "from the end" gives them.
    const got = portionOrder([nas + 1, nas, falaq + 1, falaq], q.surahOf);
    expect(got).toEqual([nas, nas + 1, falaq, falaq + 1]);
  });
});
