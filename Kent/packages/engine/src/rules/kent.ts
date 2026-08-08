import { EngineError } from "../errors.js";
import { generateId } from "../id.js";
import { SIGNAL_ACTIVE_WINDOW_MS, type GameState, type SignalIconId } from "../types.js";
import { isFourOfAKind } from "./fourOfAKind.js";
import { allOtherPartnershipIds, finishHand } from "./scoring.js";

function requirePlayer(state: GameState, playerId: string) {
  const player = state.players[playerId];
  if (!player) throw new EngineError("UNKNOWN_PLAYER", `Unknown player ${playerId}`);
  return player;
}

/**
 * Tap one of the 4 gesture icons. Any of the 4 can be tapped at any time by
 * any player, on or off their turn — the real signal and the 3 decoys are
 * indistinguishable to everyone except the tapper's own partner.
 */
export function tapSignal(state: GameState, playerId: string, icon: SignalIconId, now: number): GameState {
  if (state.phase !== "playing") {
    throw new EngineError("WRONG_PHASE", "Signals can only be tapped during play");
  }
  requirePlayer(state, playerId);
  return {
    ...state,
    signals: [...state.signals, { id: generateId("sig"), playerId, icon, atMs: now }],
  };
}

/**
 * The partner claims their teammate has four-of-a-kind. Correctness hinges
 * purely on whether the teammate actually holds it right now — the caller is
 * presumed to have recognized their own team's real signal already.
 *
 * - Confirmed correct: the signaling partnership wins the hand outright. No
 *   one else stepped in to contest it, so — same as the classic 2-team game —
 *   every other partnership takes the letter.
 * - Wrong (partner doesn't actually hold four-of-a-kind): the caller's own
 *   partnership takes the letter instead, symmetric with a bad Counter Kent.
 */
export function callKent(state: GameState, callerId: string, now: number): GameState {
  if (state.phase !== "playing") {
    throw new EngineError("WRONG_PHASE", "Kent can only be called during play");
  }
  const caller = requirePlayer(state, callerId);
  if (!caller.partnershipId) throw new EngineError("PLAYER_NOT_SEATED", "Caller has no partnership");
  const partnership = state.partnerships[caller.partnershipId]!;
  const partnerId = partnership.seats
    .map((seat) => state.seats[seat])
    .find((pid) => pid && pid !== callerId);

  const partnerHand = partnerId ? state.hands[partnerId] : undefined;
  const correct = !!partnerId && isFourOfAKind(partnerHand);

  if (correct && partnerId) {
    return finishHand(
      state,
      {
        type: "kent_confirmed",
        atMs: now,
        callerPlayerId: callerId,
        signalerPlayerId: partnerId,
        winningPartnershipId: partnership.id,
        losingPartnershipIds: allOtherPartnershipIds(state, partnership.id),
        revealedCards: partnerHand ?? [],
      },
      allOtherPartnershipIds(state, partnership.id),
    );
  }

  return finishHand(
    state,
    { type: "kent_wrong", atMs: now, callerPlayerId: callerId, losingPartnershipIds: [partnership.id] },
    [partnership.id],
  );
}

/**
 * An opposing player claims to have caught a real signal being actively
 * sent. This is a global claim, not an accusation of one specific player —
 * it is correct if ANY player outside the caller's own partnership currently
 * holds four-of-a-kind AND tapped their partnership's real (non-decoy)
 * signal within the last SIGNAL_ACTIVE_WINDOW_MS. A decoy tap never counts,
 * even by a player who genuinely holds four-of-a-kind — bluffs are not "a
 * signal genuinely being actively sent".
 */
export function callCounterKent(state: GameState, callerId: string, now: number): GameState {
  if (state.phase !== "playing") {
    throw new EngineError("WRONG_PHASE", "Counter Kent can only be called during play");
  }
  const caller = requirePlayer(state, callerId);
  if (!caller.partnershipId) throw new EngineError("PLAYER_NOT_SEATED", "Caller has no partnership");
  const callerPartnershipId = caller.partnershipId;

  const culprit = Object.values(state.players).find((player) => {
    if (!player.partnershipId || player.partnershipId === callerPartnershipId) return false;
    if (!isFourOfAKind(state.hands[player.id])) return false;
    const partnership = state.partnerships[player.partnershipId];
    if (!partnership?.signal) return false;
    return state.signals.some(
      (tap) =>
        tap.playerId === player.id &&
        tap.icon === partnership.signal &&
        now - tap.atMs <= SIGNAL_ACTIVE_WINDOW_MS &&
        now - tap.atMs >= 0,
    );
  });

  if (culprit) {
    const culpritPartnershipId = culprit.partnershipId!;
    return finishHand(
      state,
      {
        type: "counter_kent_correct",
        atMs: now,
        callerPlayerId: callerId,
        culpritPlayerId: culprit.id,
        losingPartnershipIds: [culpritPartnershipId],
        revealedCards: state.hands[culprit.id] ?? [],
      },
      [culpritPartnershipId],
    );
  }

  return finishHand(
    state,
    { type: "counter_kent_wrong", atMs: now, callerPlayerId: callerId, losingPartnershipIds: [callerPartnershipId] },
    [callerPartnershipId],
  );
}
