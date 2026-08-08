import type { Card } from "./cards.js";

/** Only even table sizes divide into complete 2-player partnerships. */
export const VALID_PLAYER_COUNTS = [4, 6, 8] as const;
export type PlayerCount = (typeof VALID_PLAYER_COUNTS)[number];

export const SIGNAL_ICONS = [
  { id: "palm", emoji: "✋", label: "Palm" },
  { id: "ok", emoji: "👌", label: "OK" },
  { id: "peace", emoji: "✌️", label: "Peace" },
  { id: "crossed", emoji: "🤞", label: "Crossed" },
] as const;
export type SignalIconId = (typeof SIGNAL_ICONS)[number]["id"];

export const KENT_WORD = "KENT";

/** How long (ms) a tapped gesture counts as "actively being sent" for Counter Kent purposes. */
export const SIGNAL_ACTIVE_WINDOW_MS = 3000;

export type Phase = "lobby" | "between_hands" | "playing" | "match_over";

export interface Player {
  id: string;
  name: string;
  seat: number | null;
  partnershipId: string | null;
  connected: boolean;
  ready: boolean;
}

export interface Partnership {
  id: string;
  seats: [number, number];
  letters: string;
  signal: SignalIconId | null;
}

export interface Packet {
  id: string;
  /** Face-down; index 0 is the top (next card drawn). */
  cards: Card[];
}

export interface SignalTapEvent {
  id: string;
  playerId: string;
  icon: SignalIconId;
  atMs: number;
}

export type HandOutcome =
  | {
      type: "kent_confirmed";
      atMs: number;
      callerPlayerId: string;
      signalerPlayerId: string;
      winningPartnershipId: string;
      losingPartnershipIds: string[];
      revealedCards: Card[];
    }
  | {
      type: "kent_wrong";
      atMs: number;
      callerPlayerId: string;
      losingPartnershipIds: string[];
    }
  | {
      type: "counter_kent_correct";
      atMs: number;
      callerPlayerId: string;
      culpritPlayerId: string;
      losingPartnershipIds: string[];
      revealedCards: Card[];
    }
  | {
      type: "counter_kent_wrong";
      atMs: number;
      callerPlayerId: string;
      losingPartnershipIds: string[];
    }
  | {
      type: "real_deal";
      atMs: number;
    };

export interface GameState {
  roomCode: string;
  phase: Phase;
  seatCount: PlayerCount | null;
  hostPlayerId: string;
  seats: (string | null)[];
  players: Record<string, Player>;
  partnerships: Record<string, Partnership>;
  dealerSeat: number;
  handNumber: number;
  hands: Record<string, Card[]>;
  packets: Packet[];
  discardPile: Card[];
  turnPlayerId: string | null;
  awaitingDiscardBy: string | null;
  signals: SignalTapEvent[];
  lastHandResult: HandOutcome | null;
  matchLoserPartnershipId: string | null;
  createdAtMs: number;
}

export type GameAction =
  | { type: "JOIN_SEAT"; playerId: string; seat: number }
  | { type: "LEAVE_SEAT"; playerId: string }
  | { type: "SET_READY"; playerId: string; ready: boolean }
  | { type: "START_MATCH"; playerId: string }
  | { type: "SET_TEAM_SIGNAL"; playerId: string; icon: SignalIconId }
  | { type: "DRAW_CARD"; playerId: string; packetId: string }
  | { type: "DISCARD_CARD"; playerId: string; cardId: string }
  | { type: "TAP_SIGNAL"; playerId: string; icon: SignalIconId }
  | { type: "CALL_KENT"; playerId: string }
  | { type: "CALL_COUNTER_KENT"; playerId: string };
