import { describe, expect, it } from "vitest";
import { EngineError } from "../errors.js";
import { basePlayingState, fourOfAKindHand, mixedHand, withSignal } from "../testHelpers.js";
import { SIGNAL_ACTIVE_WINDOW_MS } from "../types.js";
import { callCounterKent, callKent, tapSignal } from "./kent.js";

describe("tapSignal", () => {
  it("records a tap event", () => {
    const state = basePlayingState(4);
    const next = tapSignal(state, "p0", "palm", 500);
    expect(next.signals).toHaveLength(1);
    expect(next.signals[0]).toMatchObject({ playerId: "p0", icon: "palm", atMs: 500 });
  });

  it("rejects tapping outside the playing phase", () => {
    const state = { ...basePlayingState(4), phase: "between_hands" as const };
    expect(() => tapSignal(state, "p0", "palm", 500)).toThrow(EngineError);
  });
});

// Seats 0/2 = team-0 (p0, p2); seats 1/3 = team-1 (p1, p3).
describe("callKent", () => {
  it("confirms the win when the partner genuinely holds four-of-a-kind, letter goes to the other team", () => {
    const state = basePlayingState(4, { p0: fourOfAKindHand("A"), p2: mixedHand() });
    const next = callKent(state, "p2", 1000);

    expect(next.lastHandResult).toMatchObject({ type: "kent_confirmed", winningPartnershipId: "team-0" });
    expect(next.partnerships["team-0"]!.letters).toBe("");
    expect(next.partnerships["team-1"]!.letters).toBe("K");
    expect(next.phase).toBe("between_hands");
  });

  it("punishes the caller's own team when the partner does not actually hold four-of-a-kind", () => {
    const state = basePlayingState(4, { p0: mixedHand(), p2: mixedHand() });
    const next = callKent(state, "p2", 1000);

    expect(next.lastHandResult).toMatchObject({ type: "kent_wrong" });
    expect(next.partnerships["team-0"]!.letters).toBe("K");
    expect(next.partnerships["team-1"]!.letters).toBe("");
  });

  it("in a 3-team game, an uncontested confirmed Kent letters BOTH other teams", () => {
    // 6 players -> team-0 (p0,p3), team-1 (p1,p4), team-2 (p2,p5)
    const state = basePlayingState(6, { p0: fourOfAKindHand("K"), p3: mixedHand() });
    const next = callKent(state, "p3", 1000);

    expect(next.partnerships["team-0"]!.letters).toBe("");
    expect(next.partnerships["team-1"]!.letters).toBe("K");
    expect(next.partnerships["team-2"]!.letters).toBe("K");
  });
});

describe("callCounterKent", () => {
  it("is correct when an opponent holds four-of-a-kind and recently tapped their team's real signal", () => {
    let state = basePlayingState(4, { p0: fourOfAKindHand("Q") });
    state = withSignal(state, "team-0", "peace");
    state = tapSignal(state, "p0", "peace", 900);

    const next = callCounterKent(state, "p1", 1000);
    expect(next.lastHandResult).toMatchObject({ type: "counter_kent_correct", culpritPlayerId: "p0" });
    expect(next.partnerships["team-0"]!.letters).toBe("K");
    expect(next.partnerships["team-1"]!.letters).toBe("");
  });

  it("is wrong (and punishes the caller) when the tap was a decoy, even if that player holds four-of-a-kind", () => {
    let state = basePlayingState(4, { p0: fourOfAKindHand("Q") });
    state = withSignal(state, "team-0", "peace");
    state = tapSignal(state, "p0", "ok", 900); // decoy, not the real "peace" signal

    const next = callCounterKent(state, "p1", 1000);
    expect(next.lastHandResult).toMatchObject({ type: "counter_kent_wrong" });
    expect(next.partnerships["team-1"]!.letters).toBe("K");
    expect(next.partnerships["team-0"]!.letters).toBe("");
  });

  it("is wrong when the real signal was tapped too long ago", () => {
    let state = basePlayingState(4, { p0: fourOfAKindHand("Q") });
    state = withSignal(state, "team-0", "peace");
    state = tapSignal(state, "p0", "peace", 900);

    const next = callCounterKent(state, "p1", 900 + SIGNAL_ACTIVE_WINDOW_MS + 1);
    expect(next.lastHandResult).toMatchObject({ type: "counter_kent_wrong" });
  });

  it("is wrong when nobody actually holds four-of-a-kind", () => {
    let state = basePlayingState(4, { p0: mixedHand() });
    state = withSignal(state, "team-0", "peace");
    state = tapSignal(state, "p0", "peace", 900);

    const next = callCounterKent(state, "p1", 1000);
    expect(next.lastHandResult).toMatchObject({ type: "counter_kent_wrong" });
    expect(next.partnerships["team-1"]!.letters).toBe("K");
  });

  it("never flags the caller's own partner as the culprit", () => {
    let state = basePlayingState(4, { p2: fourOfAKindHand("9") });
    state = withSignal(state, "team-0", "peace");
    state = tapSignal(state, "p2", "peace", 900);

    // p0 is on team-0 with p2 — calling Counter Kent against your own team should never succeed.
    const next = callCounterKent(state, "p0", 1000);
    expect(next.lastHandResult).toMatchObject({ type: "counter_kent_wrong" });
    expect(next.partnerships["team-0"]!.letters).toBe("K");
  });

  it("in a 4-team game, only the culprit's team and the calling team are affected", () => {
    // 8 players -> team-0 (p0,p4) team-1 (p1,p5) team-2 (p2,p6) team-3 (p3,p7)
    let state = basePlayingState(8, { p0: fourOfAKindHand("7") });
    state = withSignal(state, "team-0", "crossed");
    state = tapSignal(state, "p0", "crossed", 900);

    const next = callCounterKent(state, "p2", 1000); // p2 is on team-2
    expect(next.partnerships["team-0"]!.letters).toBe("K");
    expect(next.partnerships["team-1"]!.letters).toBe("");
    expect(next.partnerships["team-2"]!.letters).toBe("");
    expect(next.partnerships["team-3"]!.letters).toBe("");
  });
});
