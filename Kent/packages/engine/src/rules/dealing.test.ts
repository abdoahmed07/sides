import { describe, expect, it } from "vitest";
import { dealNewHand } from "./dealing.js";

describe("dealNewHand", () => {
  it.each([4, 6, 8] as const)("deals 4 cards to each of %i players", (n) => {
    const playerIds = Array.from({ length: n }, (_, i) => `p${i}`);
    const { hands, packets } = dealNewHand(playerIds);

    for (const pid of playerIds) {
      expect(hands[pid]).toHaveLength(4);
    }

    const dealtCount = n * 4;
    const stockCount = 52 - dealtCount;
    expect(stockCount % 4).toBe(0);
    expect(packets).toHaveLength(stockCount / 4);
    for (const packet of packets) {
      expect(packet.cards).toHaveLength(4);
    }
  });

  it("deals every card exactly once (no duplicates, nothing missing)", () => {
    const playerIds = Array.from({ length: 6 }, (_, i) => `p${i}`);
    const { hands, packets } = dealNewHand(playerIds);

    const allIds = [
      ...Object.values(hands).flat().map((c) => c.id),
      ...packets.flatMap((p) => p.cards.map((c) => c.id)),
    ];
    expect(allIds).toHaveLength(52);
    expect(new Set(allIds).size).toBe(52);
  });

  it("is deterministic given the same rng (ignoring auto-generated packet ids)", () => {
    const playerIds = Array.from({ length: 4 }, (_, i) => `p${i}`);
    const a = dealNewHand(playerIds, () => 0.123456);
    const b = dealNewHand(playerIds, () => 0.123456);
    expect(a.hands).toEqual(b.hands);
    expect(a.packets.map((p) => p.cards)).toEqual(b.packets.map((p) => p.cards));
  });
});
