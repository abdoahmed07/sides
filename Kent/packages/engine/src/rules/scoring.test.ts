import { describe, expect, it } from "vitest";
import { basePlayingState } from "../testHelpers.js";
import { applyLetters, findMatchLoser, finishHand } from "./scoring.js";

describe("applyLetters", () => {
  it("spells K-E-N-T one letter at a time and then stops", () => {
    let state = basePlayingState(4);
    for (const expected of ["K", "KE", "KEN", "KENT", "KENT"]) {
      state = applyLetters(state, ["team-0"]);
      expect(state.partnerships["team-0"]!.letters).toBe(expected);
    }
  });

  it("leaves other partnerships untouched", () => {
    const state = applyLetters(basePlayingState(4), ["team-0"]);
    expect(state.partnerships["team-1"]!.letters).toBe("");
  });
});

describe("findMatchLoser", () => {
  it("finds the partnership that spelled KENT", () => {
    let state = basePlayingState(4);
    state = applyLetters(state, ["team-0"]);
    state = applyLetters(state, ["team-0"]);
    state = applyLetters(state, ["team-0"]);
    expect(findMatchLoser(state)).toBeNull();
    state = applyLetters(state, ["team-0"]);
    expect(findMatchLoser(state)).toBe("team-0");
  });
});

describe("finishHand", () => {
  it("rotates the dealer seat and resets every player's ready flag", () => {
    let state = basePlayingState(4);
    state = {
      ...state,
      dealerSeat: 1,
      players: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, { ...p, ready: true }])),
    };
    const next = finishHand(state, { type: "real_deal", atMs: 1 }, []);
    expect(next.dealerSeat).toBe(2);
    for (const p of Object.values(next.players)) expect(p.ready).toBe(false);
  });

  it("moves to match_over once a partnership completes KENT", () => {
    let state = basePlayingState(4);
    state = { ...state, partnerships: { ...state.partnerships, "team-0": { ...state.partnerships["team-0"]!, letters: "KEN" } } };
    const next = finishHand(state, { type: "real_deal", atMs: 1 }, ["team-0"]);
    expect(next.phase).toBe("match_over");
    expect(next.matchLoserPartnershipId).toBe("team-0");
  });

  it("otherwise moves to between_hands", () => {
    const state = basePlayingState(4);
    const next = finishHand(state, { type: "real_deal", atMs: 1 }, []);
    expect(next.phase).toBe("between_hands");
    expect(next.matchLoserPartnershipId).toBeNull();
  });
});
