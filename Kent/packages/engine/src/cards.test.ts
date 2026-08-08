import { describe, expect, it } from "vitest";
import { createDeck, shuffle } from "./cards.js";

describe("createDeck", () => {
  it("has 52 unique cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it("has 13 ranks across 4 suits", () => {
    const deck = createDeck();
    const bySuit = new Map<string, number>();
    for (const card of deck) {
      bySuit.set(card.suit, (bySuit.get(card.suit) ?? 0) + 1);
    }
    expect(bySuit.size).toBe(4);
    for (const count of bySuit.values()) expect(count).toBe(13);
  });
});

describe("shuffle", () => {
  it("preserves the same set of cards", () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    expect(shuffled).toHaveLength(deck.length);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(deck.map((c) => c.id)));
  });

  it("does not mutate the input array", () => {
    const deck = createDeck();
    const copy = [...deck];
    shuffle(deck, () => 0.42);
    expect(deck).toEqual(copy);
  });

  it("is deterministic for a given rng", () => {
    const deck = createDeck();
    const a = shuffle(deck, () => 0);
    const b = shuffle(deck, () => 0);
    expect(a).toEqual(b);
  });
});
