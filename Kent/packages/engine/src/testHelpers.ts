import type { Card, Rank } from "./cards.js";
import { buildPartnerships } from "./seating.js";
import type { GameState, PlayerCount, SignalIconId } from "./types.js";

/** Builds a minimal `playing`-phase state for N players with hand-crafted hands, for rule-logic unit tests. */
export function basePlayingState(seatCount: PlayerCount, handsOverride: Record<string, Card[]> = {}): GameState {
  const playerIds = Array.from({ length: seatCount }, (_, i) => `p${i}`);
  const seats: (string | null)[] = playerIds.slice();
  const partnerships = buildPartnerships(seats);
  const half = seatCount / 2;

  const players: GameState["players"] = {};
  playerIds.forEach((pid, seat) => {
    players[pid] = {
      id: pid,
      name: pid,
      seat,
      partnershipId: `team-${seat % half}`,
      connected: true,
      ready: false,
    };
  });

  const hands: Record<string, Card[]> = {};
  for (const pid of playerIds) {
    hands[pid] = handsOverride[pid] ?? [];
  }

  return {
    roomCode: "TEST",
    phase: "playing",
    seatCount,
    hostPlayerId: playerIds[0]!,
    seats,
    players,
    partnerships,
    dealerSeat: 0,
    handNumber: 1,
    hands,
    stock: [
      { id: "8-clubs", rank: "8", suit: "clubs" },
      { id: "8-diamonds", rank: "8", suit: "diamonds" },
      { id: "8-hearts", rank: "8", suit: "hearts" },
    ],
    center: [
      { id: "3-clubs", rank: "3", suit: "clubs" },
      { id: "4-diamonds", rank: "4", suit: "diamonds" },
      { id: "6-hearts", rank: "6", suit: "hearts" },
      { id: "7-spades", rank: "7", suit: "spades" },
    ],
    discardPile: [],
    doneStatus: {},
    signals: [],
    lastHandResult: null,
    matchLoserPartnershipId: null,
    createdAtMs: 0,
  };
}

export function withSignal(state: GameState, teamId: string, icon: SignalIconId): GameState {
  const p = state.partnerships[teamId];
  if (!p) return state;
  return { ...state, partnerships: { ...state.partnerships, [teamId]: { ...p, signal: icon } } };
}

export function fourOfAKindHand(rank: Rank = "A"): Card[] {
  return [
    { id: `${rank}-clubs`, rank, suit: "clubs" },
    { id: `${rank}-diamonds`, rank, suit: "diamonds" },
    { id: `${rank}-hearts`, rank, suit: "hearts" },
    { id: `${rank}-spades`, rank, suit: "spades" },
  ];
}

export function mixedHand(): Card[] {
  return [
    { id: "2-clubs", rank: "2", suit: "clubs" },
    { id: "5-diamonds", rank: "5", suit: "diamonds" },
    { id: "9-hearts", rank: "9", suit: "hearts" },
    { id: "K-spades", rank: "K", suit: "spades" },
  ];
}
