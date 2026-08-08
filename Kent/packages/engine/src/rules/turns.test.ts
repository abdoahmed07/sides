import { describe, expect, it } from "vitest";
import { EngineError } from "../errors.js";
import { basePlayingState, mixedHand } from "../testHelpers.js";
import { advanceTurn, discardCard, drawCard } from "./turns.js";

describe("drawCard", () => {
  it("moves the top card of the packet into the drawer's hand and marks them awaiting discard", () => {
    let state = basePlayingState(4, { p0: mixedHand() });
    state = {
      ...state,
      packets: [{ id: "packet-0", cards: [{ id: "K-clubs", rank: "K", suit: "clubs" }] }],
    };
    const next = drawCard(state, "p0", "packet-0");
    expect(next.hands.p0).toHaveLength(5);
    expect(next.hands.p0!.at(-1)!.id).toBe("K-clubs");
    expect(next.packets[0]!.cards).toHaveLength(0);
    expect(next.awaitingDiscardBy).toBe("p0");
  });

  it("rejects a draw out of turn", () => {
    let state = basePlayingState(4, { p0: mixedHand() });
    state = { ...state, packets: [{ id: "packet-0", cards: [{ id: "K-clubs", rank: "K", suit: "clubs" }] }] };
    expect(() => drawCard(state, "p1", "packet-0")).toThrow(EngineError);
  });

  it("rejects drawing from an empty or unknown packet", () => {
    const state = basePlayingState(4, { p0: mixedHand() });
    expect(() => drawCard(state, "p0", "packet-0")).toThrow(/no cards left/);
    expect(() => drawCard(state, "p0", "nope")).toThrow(EngineError);
  });

  it("rejects drawing again before discarding", () => {
    let state = basePlayingState(4, { p0: mixedHand() });
    state = {
      ...state,
      packets: [{ id: "packet-0", cards: [{ id: "K-clubs", rank: "K", suit: "clubs" }, { id: "Q-clubs", rank: "Q", suit: "clubs" }] }],
    };
    const afterDraw = drawCard(state, "p0", "packet-0");
    expect(() => drawCard(afterDraw, "p0", "packet-0")).toThrow(/Finish discarding/);
  });
});

describe("discardCard", () => {
  it("removes the card from hand, adds it face-down to the discard pile, and advances the turn", () => {
    let state = basePlayingState(4, { p0: mixedHand() });
    state = {
      ...state,
      packets: [
        { id: "packet-0", cards: [{ id: "K-clubs", rank: "K", suit: "clubs" }] },
        { id: "packet-1", cards: [{ id: "Q-clubs", rank: "Q", suit: "clubs" }] },
      ],
    };
    const afterDraw = drawCard(state, "p0", "packet-0");
    const afterDiscard = discardCard(afterDraw, "p0", "2-clubs", 1000);

    expect(afterDiscard.hands.p0).toHaveLength(4);
    expect(afterDiscard.hands.p0!.some((c) => c.id === "2-clubs")).toBe(false);
    expect(afterDiscard.discardPile).toHaveLength(1);
    expect(afterDiscard.discardPile[0]!.id).toBe("2-clubs");
    expect(afterDiscard.awaitingDiscardBy).toBeNull();
    expect(afterDiscard.turnPlayerId).toBe("p1");
  });

  it("rejects discarding without having drawn first", () => {
    const state = basePlayingState(4, { p0: mixedHand() });
    expect(() => discardCard(state, "p0", "2-clubs", 1000)).toThrow(/must draw/);
  });

  it("rejects discarding a card not in hand", () => {
    let state = basePlayingState(4, { p0: mixedHand() });
    state = { ...state, packets: [{ id: "packet-0", cards: [{ id: "K-clubs", rank: "K", suit: "clubs" }] }] };
    const afterDraw = drawCard(state, "p0", "packet-0");
    expect(() => discardCard(afterDraw, "p0", "not-a-real-card", 1000)).toThrow(EngineError);
  });

  it("ends the hand as a Real Deal once the stock is exhausted, with no letters awarded", () => {
    let state = basePlayingState(4, { p0: mixedHand() });
    state = { ...state, packets: [{ id: "packet-0", cards: [{ id: "K-clubs", rank: "K", suit: "clubs" }] }] };
    const afterDraw = drawCard(state, "p0", "packet-0");
    const afterDiscard = discardCard(afterDraw, "p0", "2-clubs", 1000);

    expect(afterDiscard.phase).toBe("between_hands");
    expect(afterDiscard.lastHandResult).toEqual({ type: "real_deal", atMs: 1000 });
    for (const p of Object.values(afterDiscard.partnerships)) {
      expect(p.letters).toBe("");
    }
  });
});

describe("advanceTurn", () => {
  it("moves clockwise by seat and wraps around", () => {
    const state = basePlayingState(4);
    expect(advanceTurn({ ...state, turnPlayerId: "p0" }).turnPlayerId).toBe("p1");
    expect(advanceTurn({ ...state, turnPlayerId: "p3" }).turnPlayerId).toBe("p0");
  });
});
