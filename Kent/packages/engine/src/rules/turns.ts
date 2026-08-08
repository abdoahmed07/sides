import { EngineError } from "../errors.js";
import type { GameState } from "../types.js";
import { finishHand } from "./scoring.js";

export function seatOrderPlayerIds(state: GameState): string[] {
  return state.seats.filter((pid): pid is string => pid !== null);
}

function nextSeatIndex(seat: number, seatCount: number): number {
  return (seat + 1) % seatCount;
}

/**
 * Turn passes clockwise by seat. Seats are locked once a match starts, so
 * every seat stays occupied for the whole match even if that player
 * disconnects — a dropped player's turn simply waits for them to reconnect
 * rather than being auto-played or skipped.
 */
export function advanceTurn(state: GameState): GameState {
  const currentSeat = state.turnPlayerId ? state.players[state.turnPlayerId]?.seat : null;
  if (currentSeat === null || currentSeat === undefined) return state;
  const nextSeat = nextSeatIndex(currentSeat, state.seats.length);
  const nextPlayerId = state.seats[nextSeat] ?? null;
  return { ...state, turnPlayerId: nextPlayerId };
}

/** Blind draw: the top card of the chosen packet, sight-unseen, same as drawing from a mini stock pile. */
export function drawCard(state: GameState, playerId: string, packetId: string): GameState {
  if (state.phase !== "playing") throw new EngineError("WRONG_PHASE", "Cannot draw outside of play");
  if (state.turnPlayerId !== playerId) throw new EngineError("NOT_YOUR_TURN", "It is not your turn to draw");
  if (state.awaitingDiscardBy) {
    throw new EngineError("MUST_DISCARD_FIRST", "Finish discarding before drawing again");
  }
  const packet = state.packets.find((p) => p.id === packetId);
  if (!packet) throw new EngineError("PACKET_NOT_FOUND", `No packet ${packetId}`);
  const drawn = packet.cards[0];
  if (!drawn) throw new EngineError("PACKET_EMPTY", "That packet has no cards left");

  const hand = state.hands[playerId] ?? [];
  return {
    ...state,
    packets: state.packets.map((p) => (p.id === packetId ? { ...p, cards: p.cards.slice(1) } : p)),
    hands: { ...state.hands, [playerId]: [...hand, drawn] },
    awaitingDiscardBy: playerId,
  };
}

/**
 * Discards face-down into the shared discard pile (permanently out of play),
 * then either ends the hand as a Real Deal — if that was the last card in
 * the stock and no one called Kent or Counter Kent first — or passes the
 * turn.
 */
export function discardCard(state: GameState, playerId: string, cardId: string, now: number): GameState {
  if (state.phase !== "playing") throw new EngineError("WRONG_PHASE", "Cannot discard outside of play");
  if (state.awaitingDiscardBy !== playerId) {
    throw new EngineError("NOT_YOUR_TURN", "You must draw before you can discard");
  }
  const hand = state.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) throw new EngineError("CARD_NOT_IN_HAND", `Card ${cardId} is not in hand`);

  const next: GameState = {
    ...state,
    hands: { ...state.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
    discardPile: [...state.discardPile, card],
    awaitingDiscardBy: null,
  };

  const stockRemaining = next.packets.reduce((sum, p) => sum + p.cards.length, 0);
  if (stockRemaining === 0) {
    return finishHand(next, { type: "real_deal", atMs: now }, []);
  }
  return advanceTurn(next);
}
