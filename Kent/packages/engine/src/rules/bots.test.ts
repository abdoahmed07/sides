import { describe, expect, it } from "vitest";
import type { Card } from "../cards.js";
import { applyAction } from "../reducer.js";
import { createSoloMatch, HUMAN_ID, isBotId } from "../solo.js";
import { basePlayingState, fourOfAKindHand, withSignal } from "../testHelpers.js";
import { bestSwap, chooseBotAction } from "./bots.js";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ id: `${rank}-${suit}`, rank, suit });
const always = () => 0; // rng that always passes every probability check
const never = () => 0.999;
const allBots = () => true;
// Small seeded random generator so the "many tries" tests are repeatable.
function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("bestSwap", () => {
  it("takes a center card that grows the biggest group, giving up a loner", () => {
    const hand = [c("A", "clubs"), c("A", "hearts"), c("5", "clubs"), c("7", "clubs")];
    const center = [c("9", "clubs"), c("A", "spades"), c("2", "clubs"), c("3", "clubs")];
    const swap = bestSwap(hand, center);
    expect(swap?.centerSlot).toBe(1);
    expect(["5-clubs", "7-clubs"]).toContain(swap?.handCardId);
  });

  it("never breaks up a bigger group for a smaller one", () => {
    const hand = [c("A", "clubs"), c("A", "hearts"), c("A", "spades"), c("5", "clubs")];
    const center = [c("5", "hearts"), c("9", "clubs"), c("2", "clubs"), c("3", "clubs")];
    expect(bestSwap(hand, center)).toBeNull();
  });

  it("returns null when nothing in the center matches the hand", () => {
    const hand = [c("A", "clubs"), c("K", "hearts"), c("5", "clubs"), c("7", "clubs")];
    const center = [c("9", "clubs"), c("2", "spades"), c("3", "clubs"), c("4", "clubs")];
    expect(bestSwap(hand, center)).toBeNull();
  });
});

describe("chooseBotAction", () => {
  it("swaps toward four-of-a-kind when the center helps", () => {
    let state = basePlayingState(4, { p1: [c("3", "hearts"), c("3", "spades"), c("9", "clubs"), c("K", "clubs")] });
    state = withSignal(withSignal(state, "team-0", "palm"), "team-1", "ok");
    // default center slot 0 is 3-clubs
    const action = chooseBotAction(state, "p1", allBots, 0, always);
    expect(action).toMatchObject({ type: "SWAP_CARD", playerId: "p1", centerSlot: 0 });
  });

  it("passes the round when no swap helps", () => {
    let state = basePlayingState(4, { p1: [c("A", "hearts"), c("K", "spades"), c("Q", "clubs"), c("J", "clubs")] });
    state = withSignal(withSignal(state, "team-0", "palm"), "team-1", "ok");
    expect(chooseBotAction(state, "p1", allBots, 0, always)).toEqual({ type: "DECLARE_DONE", playerId: "p1" });
  });

  it("signals with the team's real gesture when holding four-of-a-kind", () => {
    let state = basePlayingState(4, { p1: fourOfAKindHand("Q") });
    state = withSignal(withSignal(state, "team-0", "palm"), "team-1", "ok");
    expect(chooseBotAction(state, "p1", allBots, 0, always)).toEqual({ type: "TAP_SIGNAL", playerId: "p1", icon: "ok" });
  });

  it("calls KENT after seeing its partner tap the team's real signal", () => {
    let state = basePlayingState(4, { p1: fourOfAKindHand("Q") });
    state = withSignal(withSignal(state, "team-0", "palm"), "team-1", "ok");
    state = applyAction(state, { type: "TAP_SIGNAL", playerId: "p1", icon: "ok" }, 1000);
    // p3 is p1's partner (team-1)
    expect(chooseBotAction(state, "p3", allBots, 1500, always)).toEqual({ type: "CALL_KENT", playerId: "p3" });
  });

  it("calls COUNTER KENT when an opponent keeps tapping the same gesture", () => {
    let state = basePlayingState(4, { p1: fourOfAKindHand("Q") });
    state = withSignal(withSignal(state, "team-0", "palm"), "team-1", "ok");
    // Medium bots need three of the same gesture before they get suspicious.
    state = applyAction(state, { type: "TAP_SIGNAL", playerId: "p1", icon: "ok" }, 1000);
    state = applyAction(state, { type: "TAP_SIGNAL", playerId: "p1", icon: "ok" }, 1500);
    state = applyAction(state, { type: "TAP_SIGNAL", playerId: "p1", icon: "ok" }, 2000);
    expect(chooseBotAction(state, "p0", allBots, 2500, always)).toEqual({ type: "CALL_COUNTER_KENT", playerId: "p0" });
  });

  it("waits when the dice say so", () => {
    let state = basePlayingState(4, { p1: [c("3", "hearts"), c("3", "spades"), c("9", "clubs"), c("K", "clubs")] });
    state = withSignal(withSignal(state, "team-0", "palm"), "team-1", "ok");
    expect(chooseBotAction(state, "p1", allBots, 0, never)).toBeNull();
  });
});

describe("bluffing and difficulty", () => {
  const rngFrom = (values: number[]) => { let i = 0; return () => values[i++ % values.length]!; };

  it("bluffs with a fake gesture while idle, never with its team's real signal", () => {
    let state = basePlayingState(4, { p1: [c("A", "hearts"), c("K", "spades"), c("Q", "clubs"), c("J", "clubs")] });
    state = withSignal(withSignal(state, "team-0", "palm"), "team-1", "ok");
    state = { ...state, doneStatus: { p1: true } }; // passed the round, nothing else to do
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const rnd = mulberry(seed);
      const action = chooseBotAction(state, "p1", allBots, 0, rnd, "hard");
      if (action?.type === "TAP_SIGNAL") seen.add(action.icon);
    }
    expect(seen.size).toBeGreaterThan(0);
    expect(seen.has("ok")).toBe(false);
  });

  it("hard bots space out real-signal taps so they don't form an obvious pattern", () => {
    let state = basePlayingState(4, { p1: fourOfAKindHand("Q") });
    state = withSignal(withSignal(state, "team-0", "palm"), "team-1", "ok");
    state = applyAction(state, { type: "TAP_SIGNAL", playerId: "p1", icon: "ok" }, 1000);
    const soon = chooseBotAction(state, "p1", allBots, 1500, always, "hard");
    expect(soon).toMatchObject({ type: "TAP_SIGNAL" });
    expect(soon).not.toMatchObject({ icon: "ok" });
    expect(chooseBotAction(state, "p1", allBots, 4000, always, "hard")).toMatchObject({ type: "TAP_SIGNAL", icon: "ok" });
  });

  it("hard bots only suspect repeated taps from opponents who have stopped swapping", () => {
    let state = basePlayingState(4, { p0: [c("A", "hearts"), c("K", "spades"), c("Q", "clubs"), c("J", "clubs")] });
    state = withSignal(withSignal(state, "team-0", "palm"), "team-1", "ok");
    state = applyAction(state, { type: "TAP_SIGNAL", playerId: "p1", icon: "peace" }, 1000);
    state = applyAction(state, { type: "TAP_SIGNAL", playerId: "p1", icon: "peace" }, 2000);
    // p1 still swapping: looks like a bluffer, so no accusation (p0 has no useful swap and passes instead).
    expect(chooseBotAction(state, "p0", allBots, 2500, rngFrom([0.99, 0.99, 0]), "hard")?.type).not.toBe("CALL_COUNTER_KENT");
    state = { ...state, doneStatus: { p1: true } };
    expect(chooseBotAction(state, "p0", allBots, 2500, always, "hard")).toEqual({ type: "CALL_COUNTER_KENT", playerId: "p0" });
  });

  it("easy bots sometimes make careless swaps", () => {
    let state = basePlayingState(4, { p1: [c("3", "hearts"), c("3", "spades"), c("9", "clubs"), c("K", "clubs")] });
    state = withSignal(withSignal(state, "team-0", "palm"), "team-1", "ok");
    const best = chooseBotAction(state, "p1", allBots, 0, always, "easy");
    const careless = chooseBotAction(state, "p1", allBots, 0, rngFrom([0, 0, 0.99, 0.99]), "easy");
    expect(best).toMatchObject({ type: "SWAP_CARD", centerSlot: 0 });
    expect(careless).toMatchObject({ type: "SWAP_CARD" });
    expect(careless).not.toEqual(best);
  });
});

describe("solo match with bots", () => {
  it("bots pick their own team's signal and ready up, but leave the human's team signal to the human", () => {
    let state = createSoloMatch("Me", 4, 0);
    expect(state.phase).toBe("between_hands");

    for (let pass = 0; pass < 4; pass++) {
      for (const id of Object.keys(state.players).filter(isBotId)) {
        const action = chooseBotAction(state, id, isBotId, 0, always);
        if (action) state = applyAction(state, action, 0);
      }
    }
    expect(state.phase).toBe("between_hands"); // still waiting on the human
    expect(state.partnerships["team-1"]!.signal).not.toBeNull();
    expect(state.partnerships["team-0"]!.signal).toBeNull();

    state = applyAction(state, { type: "SET_TEAM_SIGNAL", playerId: HUMAN_ID, icon: "peace" }, 0);
    state = applyAction(state, { type: "SET_READY", playerId: HUMAN_ID, ready: true }, 0);
    expect(state.phase).toBe("playing");
    expect(state.hands[HUMAN_ID]).toHaveLength(4);
  });
});
