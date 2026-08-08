import { describe, expect, it } from "vitest";
import { CENTER_SIZE } from "../types.js";
import { dealNewHand } from "./dealing.js";

describe("dealNewHand", () => {
  it.each([4, 6, 8] as const)("deals 4 cards to each of %i players plus a full center", (n) => {
    const playerIds = Array.from({ length: n }, (_, i) => `p${i}`);
    const { hands, center, stock } = dealNewHand(playerIds);

    for (const pid of playerIds) {
      expect(hands[pid]).toHaveLength(4);
    }
    expect(center).toHaveLength(CENTER_SIZE);
    expect(stock).toHaveLength(52 - n * 4 - CENTER_SIZE);
  });

  it("deals every card exactly once (no duplicates, nothing missing)", () => {
    const playerIds = Array.from({ length: 6 }, (_, i) => `p${i}`);
    const { hands, center, stock } = dealNewHand(playerIds);

    const allIds = [...Object.values(hands).flat().map((c) => c.id), ...center.map((c) => c.id), ...stock.map((c) => c.id)];
    expect(allIds).toHaveLength(52);
    expect(new Set(allIds).size).toBe(52);
  });

  it("is deterministic given the same rng", () => {
    const playerIds = Array.from({ length: 4 }, (_, i) => `p${i}`);
    const a = dealNewHand(playerIds, () => 0.123456);
    const b = dealNewHand(playerIds, () => 0.123456);
    expect(a).toEqual(b);
  });
});
