import { describe, expect, it } from "vitest";
import { EngineError } from "../errors.js";
import { basePlayingState, fourOfAKindHand, mixedHand } from "../testHelpers.js";
import { callKent } from "./kent.js";
import { declareDone, swapCard } from "./swapping.js";

describe("swapCard", () => {
  it("is a pure 1-for-1 trade: your card takes the center slot, nothing is discarded or drawn", () => {
    const state = basePlayingState(4, { p0: mixedHand() });
    const next = swapCard(state, "p0", "2-clubs", 0);

    expect(next.hands.p0!.some((c) => c.id === "3-clubs")).toBe(true); // took the center card
    expect(next.hands.p0!.some((c) => c.id === "2-clubs")).toBe(false);
    expect(next.hands.p0).toHaveLength(4);

    expect(next.center[0]!.id).toBe("2-clubs"); // their card took the vacated slot directly
    expect(next.center[1]!.id).toBe("4-diamonds"); // other slots untouched

    expect(next.discardPile).toHaveLength(0); // nothing discarded
    expect(next.stock).toEqual(state.stock); // stock untouched
  });

  it("rejects swapping once a player has declared done", () => {
    let state = basePlayingState(4, { p0: mixedHand() });
    state = { ...state, doneStatus: { p0: true } };
    expect(() => swapCard(state, "p0", "2-clubs", 0)).toThrow(EngineError);
  });

  it("rejects an out-of-range center slot", () => {
    const state = basePlayingState(4, { p0: mixedHand() });
    expect(() => swapCard(state, "p0", "2-clubs", 4)).toThrow(EngineError);
    expect(() => swapCard(state, "p0", "2-clubs", -1)).toThrow(EngineError);
  });

  it("rejects swapping a card not in hand", () => {
    const state = basePlayingState(4, { p0: mixedHand() });
    expect(() => swapCard(state, "p0", "not-a-real-card", 0)).toThrow(EngineError);
  });

  it("rejects swapping outside the playing phase", () => {
    const state = { ...basePlayingState(4, { p0: mixedHand() }), phase: "between_hands" as const };
    expect(() => swapCard(state, "p0", "2-clubs", 0)).toThrow(EngineError);
  });

  it("lets a later swap take a card that an earlier swap just placed (first to swap is first to get)", () => {
    let state = basePlayingState(4, { p0: mixedHand(), p1: fourOfAKindHand("9") });
    state = swapCard(state, "p0", "2-clubs", 0); // slot 0 now holds 2-clubs
    const next = swapCard(state, "p1", "9-clubs", 0); // p1 grabs whatever is in slot 0 right now
    expect(next.hands.p1!.some((c) => c.id === "2-clubs")).toBe(true);
    expect(next.center[0]!.id).toBe("9-clubs");
  });
});

describe("declareDone", () => {
  it("locks a player out of swapping without advancing the round while others aren't done", () => {
    const state = basePlayingState(4, { p0: mixedHand() });
    const next = declareDone(state, "p0", 1000);

    expect(next.doneStatus.p0).toBe(true);
    expect(next.phase).toBe("playing");
    expect(next.center).toEqual(state.center); // round hasn't turned over yet
    expect(() => swapCard(next, "p0", "2-clubs", 0)).toThrow(EngineError);
  });

  it("rejects declaring done twice", () => {
    const state = declareDone(basePlayingState(4), "p0", 1000);
    expect(() => declareDone(state, "p0", 2000)).toThrow(EngineError);
  });

  it("advances to a fresh round once everyone is done and the stock can refill the center", () => {
    let state = basePlayingState(4);
    state = {
      ...state,
      stock: [
        { id: "9-clubs", rank: "9", suit: "clubs" },
        { id: "9-diamonds", rank: "9", suit: "diamonds" },
        { id: "9-hearts", rank: "9", suit: "hearts" },
        { id: "9-spades", rank: "9", suit: "spades" },
        { id: "T-clubs", rank: "10", suit: "clubs" },
      ],
    };
    const oldCenter = state.center;

    state = declareDone(state, "p0", 1000);
    state = declareDone(state, "p1", 1000);
    state = declareDone(state, "p2", 1000);
    expect(state.phase).toBe("playing");

    state = declareDone(state, "p3", 2000);
    expect(state.phase).toBe("playing"); // still mid-match, just a new round
    expect(state.center.map((c) => c.id)).toEqual(["9-clubs", "9-diamonds", "9-hearts", "9-spades"]);
    expect(state.stock).toEqual([{ id: "T-clubs", rank: "10", suit: "clubs" }]);
    expect(state.discardPile).toEqual(oldCenter); // the old 4 retired to the discard pile
    expect(state.doneStatus).toEqual({}); // everyone can swap again in the new round
  });

  it("ends the hand as a Real Deal when everyone is done but the stock can't refill the center", () => {
    let state = basePlayingState(4); // default stock only has 3 cards, less than CENTER_SIZE
    state = declareDone(state, "p0", 1000);
    state = declareDone(state, "p1", 1000);
    state = declareDone(state, "p2", 1000);
    state = declareDone(state, "p3", 2000);

    expect(state.phase).toBe("between_hands");
    expect(state.lastHandResult).toEqual({ type: "real_deal", atMs: 2000 });
    for (const p of Object.values(state.partnerships)) expect(p.letters).toBe("");
  });

  it("rejects declaring done outside the playing phase", () => {
    const state = { ...basePlayingState(4), phase: "between_hands" as const };
    expect(() => declareDone(state, "p0", 1000)).toThrow(EngineError);
  });

  it("does not block signaling or a Kent claim for a player who has declared done", () => {
    let state = basePlayingState(4, { p0: fourOfAKindHand("A"), p2: mixedHand() });
    state = declareDone(state, "p2", 1000); // p2 is p0's partner (team-0) and the one who will call Kent
    const next = callKent(state, "p2", 2000);
    expect(next.lastHandResult).toMatchObject({ type: "kent_confirmed" });
  });
});
