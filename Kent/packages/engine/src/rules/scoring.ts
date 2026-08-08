import { KENT_WORD, type GameState, type HandOutcome } from "../types.js";

/** Awards the next letter of K-E-N-T to each losing partnership. */
export function applyLetters(state: GameState, losingPartnershipIds: string[]): GameState {
  if (losingPartnershipIds.length === 0) return state;

  const partnerships = { ...state.partnerships };
  for (const id of losingPartnershipIds) {
    const partnership = partnerships[id];
    if (!partnership || partnership.letters.length >= KENT_WORD.length) continue;
    const nextLetter = KENT_WORD[partnership.letters.length];
    partnerships[id] = { ...partnership, letters: partnership.letters + nextLetter };
  }
  return { ...state, partnerships };
}

export function findMatchLoser(state: GameState): string | null {
  const loser = Object.values(state.partnerships).find((p) => p.letters.length >= KENT_WORD.length);
  return loser ? loser.id : null;
}

export function allOtherPartnershipIds(state: GameState, excludePartnershipId: string): string[] {
  return Object.keys(state.partnerships).filter((id) => id !== excludePartnershipId);
}

function resetReadiness(players: GameState["players"]): GameState["players"] {
  const result: GameState["players"] = {};
  for (const [id, p] of Object.entries(players)) {
    result[id] = { ...p, ready: false };
  }
  return result;
}

/**
 * Shared hand-ending path for every way a hand can conclude (Kent, Counter
 * Kent, or a Real Deal): award letters, check whether the match is now over,
 * rotate the dealer, clear ready flags for the next ready-up, and reset the
 * in-progress turn state.
 */
export function finishHand(state: GameState, outcome: HandOutcome, losingPartnershipIds: string[]): GameState {
  const next = applyLetters(state, losingPartnershipIds);
  const loserId = findMatchLoser(next);
  return {
    ...next,
    phase: loserId ? "match_over" : "between_hands",
    lastHandResult: outcome,
    matchLoserPartnershipId: loserId,
    turnPlayerId: null,
    awaitingDiscardBy: null,
    dealerSeat: (state.dealerSeat + 1) % state.seats.length,
    players: resetReadiness(next.players),
  };
}
