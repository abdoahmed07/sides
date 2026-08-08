import type { Card } from "./cards.js";
import type {
  GameState,
  HandOutcome,
  Phase,
  Player,
  PlayerCount,
  SignalIconId,
  SignalTapEvent,
} from "./types.js";

export interface RedactedPartnership {
  id: string;
  seats: [number, number];
  letters: string;
  /** Only populated when the viewer is a member of this partnership. */
  signal: SignalIconId | null;
  /** True once a signal has been picked, visible to everyone (which icon stays private). */
  signalChosen: boolean;
}

export interface RedactedPacket {
  id: string;
  count: number;
}

/**
 * The view of GameState sent to one specific player: their own hand in
 * full, everyone else's hands as counts only, packets/discard as counts
 * only (blind draw means contents are never inspectable), and other teams'
 * real signals hidden — this is the server-authoritative boundary that
 * keeps clients from ever seeing hidden information over the wire.
 */
export interface RedactedGameState {
  roomCode: string;
  phase: Phase;
  seatCount: PlayerCount | null;
  hostPlayerId: string;
  seats: (string | null)[];
  players: Record<string, Player>;
  partnerships: Record<string, RedactedPartnership>;
  dealerSeat: number;
  handNumber: number;
  yourPlayerId: string;
  yourHand: Card[];
  handCounts: Record<string, number>;
  packets: RedactedPacket[];
  discardCount: number;
  turnPlayerId: string | null;
  awaitingDiscardBy: string | null;
  signals: SignalTapEvent[];
  lastHandResult: HandOutcome | null;
  matchLoserPartnershipId: string | null;
}

export function redactStateFor(state: GameState, viewerId: string): RedactedGameState {
  const viewer = state.players[viewerId];

  const partnerships: Record<string, RedactedPartnership> = {};
  for (const [id, p] of Object.entries(state.partnerships)) {
    const isOwnTeam = viewer?.partnershipId === id;
    partnerships[id] = {
      id: p.id,
      seats: p.seats,
      letters: p.letters,
      signal: isOwnTeam ? p.signal : null,
      signalChosen: p.signal !== null,
    };
  }

  const handCounts: Record<string, number> = {};
  for (const [playerId, cards] of Object.entries(state.hands)) {
    handCounts[playerId] = cards.length;
  }

  return {
    roomCode: state.roomCode,
    phase: state.phase,
    seatCount: state.seatCount,
    hostPlayerId: state.hostPlayerId,
    seats: state.seats,
    players: state.players,
    partnerships,
    dealerSeat: state.dealerSeat,
    handNumber: state.handNumber,
    yourPlayerId: viewerId,
    yourHand: state.hands[viewerId] ?? [],
    handCounts,
    packets: state.packets.map((p) => ({ id: p.id, count: p.cards.length })),
    discardCount: state.discardPile.length,
    turnPlayerId: state.turnPlayerId,
    awaitingDiscardBy: state.awaitingDiscardBy,
    signals: state.signals,
    lastHandResult: state.lastHandResult,
    matchLoserPartnershipId: state.matchLoserPartnershipId,
  };
}
