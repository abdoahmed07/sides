import { VALID_PLAYER_COUNTS, type PlayerCount, type Partnership } from "./types.js";

export function isValidPlayerCount(n: number): n is PlayerCount {
  return (VALID_PLAYER_COUNTS as readonly number[]).includes(n);
}

/**
 * Partners always sit exactly opposite each other around the table (half the
 * seat count apart), so proximity never leaks a "cheat" — this holds for any
 * even seat count, not just 4.
 */
export function partnerSeat(seat: number, seatCount: number): number {
  return (seat + seatCount / 2) % seatCount;
}

export function buildPartnerships(seats: (string | null)[]): Record<string, Partnership> {
  const half = seats.length / 2;
  const partnerships: Record<string, Partnership> = {};
  for (let i = 0; i < half; i++) {
    const id = `team-${i}`;
    partnerships[id] = {
      id,
      seats: [i, i + half],
      letters: "",
      signal: null,
    };
  }
  return partnerships;
}

export function partnershipIdForSeat(seat: number, seatCount: number): string {
  const half = seatCount / 2;
  return `team-${seat % half}`;
}
