import { describe, expect, it } from "vitest";
import { fourOfAKindHand, mixedHand } from "../testHelpers.js";
import { isFourOfAKind } from "./fourOfAKind.js";

describe("isFourOfAKind", () => {
  it("is true for four matching ranks across different suits", () => {
    expect(isFourOfAKind(fourOfAKindHand("Q"))).toBe(true);
  });

  it("is false for a mixed hand", () => {
    expect(isFourOfAKind(mixedHand())).toBe(false);
  });

  it("is false for fewer than 4 cards", () => {
    expect(isFourOfAKind(fourOfAKindHand("Q").slice(0, 3))).toBe(false);
  });

  it("is false for undefined or empty hands", () => {
    expect(isFourOfAKind(undefined)).toBe(false);
    expect(isFourOfAKind([])).toBe(false);
  });

  it("is false if three match and one doesn't", () => {
    const hand = fourOfAKindHand("7");
    hand[3] = { id: "9-spades", rank: "9", suit: "spades" };
    expect(isFourOfAKind(hand)).toBe(false);
  });
});
