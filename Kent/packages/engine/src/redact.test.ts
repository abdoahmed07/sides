import { describe, expect, it } from "vitest";
import { redactStateFor } from "./redact.js";
import { basePlayingState, fourOfAKindHand, mixedHand, withSignal } from "./testHelpers.js";

describe("redactStateFor", () => {
  it("shows the viewer's own hand in full but only counts for everyone else", () => {
    let state = basePlayingState(4, { p0: fourOfAKindHand("A"), p1: mixedHand() });
    state = { ...state, packets: [{ id: "packet-0", cards: fourOfAKindHand("K") }], discardPile: [mixedHand()[0]!] };

    const viewOfP0 = redactStateFor(state, "p0");
    expect(viewOfP0.yourHand).toEqual(fourOfAKindHand("A"));
    expect(viewOfP0.handCounts.p1).toBe(4);
    expect((viewOfP0 as unknown as { hands?: unknown }).hands).toBeUndefined();
  });

  it("never leaks another player's hand contents into the viewer's own payload", () => {
    const state = basePlayingState(4, { p0: fourOfAKindHand("A"), p1: mixedHand() });
    const viewOfP1 = redactStateFor(state, "p1");
    expect(viewOfP1.yourHand).toEqual(mixedHand());
    expect(JSON.stringify(viewOfP1)).not.toContain("A-clubs");
  });

  it("exposes packet and discard counts only, never contents", () => {
    let state = basePlayingState(4);
    state = { ...state, packets: [{ id: "packet-0", cards: fourOfAKindHand("K") }], discardPile: fourOfAKindHand("9") };

    const view = redactStateFor(state, "p0");
    expect(view.packets).toEqual([{ id: "packet-0", count: 4 }]);
    expect(view.discardCount).toBe(4);
    expect(JSON.stringify(view)).not.toContain("K-clubs");
    expect(JSON.stringify(view)).not.toContain("9-clubs");
  });

  it("only reveals a partnership's real signal to its own members", () => {
    let state = basePlayingState(4);
    state = withSignal(state, "team-0", "peace");

    const ownView = redactStateFor(state, "p0"); // p0 is on team-0
    expect(ownView.partnerships["team-0"]!.signal).toBe("peace");
    expect(ownView.partnerships["team-0"]!.signalChosen).toBe(true);

    const opponentView = redactStateFor(state, "p1"); // p1 is on team-1
    expect(opponentView.partnerships["team-0"]!.signal).toBeNull();
    expect(opponentView.partnerships["team-0"]!.signalChosen).toBe(true);
  });
});
