import type { HandOutcome, RedactedGameState } from "@kent/engine";
import { teamMemberNames } from "./format";

export type OutcomeTone = "good" | "bad" | "neutral";

/** The big word stamped on screen when a hand ends. */
export function outcomeStamp(result: HandOutcome): string {
  switch (result.type) {
    case "kent_confirmed":
    case "kent_wrong":
      return "KENT!";
    case "counter_kent_correct":
    case "counter_kent_wrong":
      return "COUNTER KENT!";
    case "real_deal":
      return "REAL DEAL";
  }
}

/** Whether the hand went well for `me`'s team. */
export function outcomeTone(state: RedactedGameState, result: HandOutcome, me: string): OutcomeTone {
  if (result.type === "real_deal") return "neutral";
  const myTeam = state.players[me]?.partnershipId ?? "";
  return result.losingPartnershipIds.includes(myTeam) ? "bad" : "good";
}

export function describeOutcome(state: RedactedGameState, result: HandOutcome, me: string): { headline: string; detail: string } {
  const name = (id: string) => (id === me ? "You" : (state.players[id]?.name ?? "Someone"));
  const object = (id: string) => (id === me ? "you" : (state.players[id]?.name ?? "someone"));
  switch (result.type) {
    case "kent_confirmed":
      return {
        headline: `${teamMemberNames(state, result.winningPartnershipId)} pulled it off.`,
        detail: `${name(result.callerPlayerId)} read the signal from ${object(result.signalerPlayerId)} and called KENT. Every other team takes a letter.`,
      };
    case "kent_wrong":
      return {
        headline: `${name(result.callerPlayerId)} called KENT too soon.`,
        detail:
          result.callerPlayerId === me
            ? "Your partner didn't have four of a kind, so your team takes the letter."
            : "Their partner didn't have four of a kind, so their team takes the letter.",
      };
    case "counter_kent_correct":
      return {
        headline: `${name(result.callerPlayerId)} caught ${object(result.culpritPlayerId)} signalling.`,
        detail: "Caught red-handed: the signalling team takes the letter.",
      };
    case "counter_kent_wrong":
      return {
        headline: `${name(result.callerPlayerId)} called COUNTER KENT on a bluff.`,
        detail: `No real signal was being sent, so ${result.callerPlayerId === me ? "your" : "their"} team takes the letter.`,
      };
    case "real_deal":
      return { headline: "The stock ran dry.", detail: "Nobody scores this hand. Fresh cards coming up." };
  }
}
