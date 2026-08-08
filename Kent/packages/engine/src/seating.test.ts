import { describe, expect, it } from "vitest";
import { VALID_PLAYER_COUNTS } from "./types.js";
import { buildPartnerships, isValidPlayerCount, partnerSeat } from "./seating.js";

describe("isValidPlayerCount", () => {
  it("accepts 4, 6, 8", () => {
    for (const n of VALID_PLAYER_COUNTS) expect(isValidPlayerCount(n)).toBe(true);
  });

  it("rejects odd counts and out-of-range counts", () => {
    for (const n of [1, 2, 3, 5, 7, 9, 10]) expect(isValidPlayerCount(n)).toBe(false);
  });
});

describe("partnerSeat", () => {
  it("pairs opposite seats for 4 players", () => {
    expect(partnerSeat(0, 4)).toBe(2);
    expect(partnerSeat(1, 4)).toBe(3);
    expect(partnerSeat(2, 4)).toBe(0);
    expect(partnerSeat(3, 4)).toBe(1);
  });

  it("pairs opposite seats for 6 and 8 players", () => {
    expect(partnerSeat(0, 6)).toBe(3);
    expect(partnerSeat(5, 6)).toBe(2);
    expect(partnerSeat(0, 8)).toBe(4);
    expect(partnerSeat(7, 8)).toBe(3);
  });

  it.each([4, 6, 8] as const)("never pairs adjacent seats for %i players", (seatCount) => {
    for (let seat = 0; seat < seatCount; seat++) {
      const partner = partnerSeat(seat, seatCount);
      const distance = Math.min(
        Math.abs(partner - seat),
        seatCount - Math.abs(partner - seat),
      );
      expect(distance).toBeGreaterThan(1);
    }
  });
});

describe("buildPartnerships", () => {
  it("builds seatCount/2 teams with correct seat pairs and empty starting state", () => {
    const seats = ["a", "b", "c", "d", "e", "f"];
    const partnerships = buildPartnerships(seats);
    expect(Object.keys(partnerships)).toHaveLength(3);
    expect(partnerships["team-0"]!.seats).toEqual([0, 3]);
    expect(partnerships["team-1"]!.seats).toEqual([1, 4]);
    expect(partnerships["team-2"]!.seats).toEqual([2, 5]);
    for (const p of Object.values(partnerships)) {
      expect(p.letters).toBe("");
      expect(p.signal).toBeNull();
    }
  });
});
