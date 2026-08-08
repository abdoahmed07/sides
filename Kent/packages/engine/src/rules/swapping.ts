import { EngineError } from "../errors.js";
import { CENTER_SIZE, type GameState } from "../types.js";
import { finishHand } from "./scoring.js";

/**
 * Any player who hasn't declared done for this round can swap one of their
 * hand cards for a face-up center card at any time — this isn't turn-based.
 * It's a pure 1-for-1 trade: the card they give up directly takes the
 * center slot they drew from. Nothing is discarded and the stock isn't
 * touched — cards only leave play in bulk, when a round ends (see
 * declareDone).
 */
export function swapCard(state: GameState, playerId: string, handCardId: string, centerSlot: number): GameState {
  if (state.phase !== "playing") throw new EngineError("WRONG_PHASE", "Cannot swap outside of play");
  if (state.doneStatus[playerId]) throw new EngineError("ALREADY_DONE", "You've already said done for this round");
  if (!Number.isInteger(centerSlot) || centerSlot < 0 || centerSlot >= state.center.length) {
    throw new EngineError("INVALID_CENTER_SLOT", `No center slot ${centerSlot}`);
  }
  const hand = state.hands[playerId] ?? [];
  const handCard = hand.find((c) => c.id === handCardId);
  if (!handCard) throw new EngineError("CARD_NOT_IN_HAND", `Card ${handCardId} is not in hand`);

  const centerCard = state.center[centerSlot]!;
  const center = [...state.center];
  center[centerSlot] = handCard;

  return {
    ...state,
    hands: { ...state.hands, [playerId]: hand.map((c) => (c.id === handCardId ? centerCard : c)) },
    center,
  };
}

/**
 * One-way per round: once declared, a player can't swap again until the
 * round turns over (they can still signal and call Kent / Counter Kent —
 * those are independent of swapping). Once every seated player has
 * declared done, the round ends: the current 4 center cards retire to the
 * discard pile and a fresh 4 are dealt from the stock, and every player's
 * done flag resets for the new round. If there aren't enough cards left in
 * the stock to refresh the center, the hand ends as a Real Deal instead.
 */
export function declareDone(state: GameState, playerId: string, now: number): GameState {
  if (state.phase !== "playing") throw new EngineError("WRONG_PHASE", "Cannot declare done outside of play");
  if (!state.players[playerId]) throw new EngineError("UNKNOWN_PLAYER", `Unknown player ${playerId}`);
  if (state.doneStatus[playerId]) throw new EngineError("ALREADY_DONE", "You've already said done for this round");

  const doneStatus = { ...state.doneStatus, [playerId]: true };
  const allDone = state.seats.every((pid) => !pid || doneStatus[pid]);
  if (!allDone) {
    return { ...state, doneStatus };
  }

  if (state.stock.length < CENTER_SIZE) {
    return finishHand({ ...state, doneStatus }, { type: "real_deal", atMs: now }, []);
  }

  return {
    ...state,
    center: state.stock.slice(0, CENTER_SIZE),
    stock: state.stock.slice(CENTER_SIZE),
    discardPile: [...state.discardPile, ...state.center],
    doneStatus: {},
  };
}
