import type { GameState } from "@kent/engine";
import { sounds } from "./sound";

/**
 * Plays the sounds for whatever changed between two game states, from `me`'s point of view.
 * Driven by state changes rather than button handlers, so bots' moves are heard too.
 */
export function playSoundsFor(prev: GameState | null, next: GameState, me: string): void {
  if (!prev) return;
  const myTeam = next.players[me]?.partnershipId;

  if (next.handNumber > prev.handNumber && next.phase === "playing") {
    sounds.deal();
    return;
  }

  // A hand just ended.
  if (prev.phase === "playing" && next.phase !== "playing") {
    const result = next.lastHandResult;
    if (!result) return;
    if (result.type !== "real_deal") sounds.call();
    const outcome = () => {
      if (next.phase === "match_over") return sounds.matchOver(next.matchLoserPartnershipId !== myTeam);
      if (result.type === "real_deal") return sounds.neutral();
      return result.losingPartnershipIds.includes(myTeam ?? "") ? sounds.lose() : sounds.win();
    };
    window.setTimeout(outcome, result.type === "real_deal" ? 0 : 260);
    return;
  }

  if (next.phase !== "playing") return;

  for (const tap of next.signals.slice(prev.signals.length)) sounds.signal(tap.icon, tap.playerId === me);

  if (next.stock.length < prev.stock.length) {
    sounds.newRound();
  } else if (next.center.some((card, i) => card.id !== prev.center[i]?.id)) {
    const mine = (next.hands[me] ?? []).some((card, i) => card.id !== prev.hands[me]?.[i]?.id);
    if (mine) sounds.swap();
    else sounds.swapOther();
  }

  if (next.doneStatus[me] && !prev.doneStatus[me]) sounds.done();
}
