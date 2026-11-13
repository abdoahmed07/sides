import { isBotId, type GameState } from "@kent/engine";
import { THROWABLES, type ReactionInput, type StickerId, type ThrowId } from "./reactions";

/** A reaction a bot wants to make, `delayMs` from now. */
export interface PlannedReaction {
  from: string;
  reaction: ReactionInput;
  delayMs: number;
}

const pick = <T,>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)]!;
const bots = (state: GameState) => Object.keys(state.players).filter(isBotId);

/** Bots react when a hand ends: the losers moan, the winners gloat, a bad call gets clowned. */
export function banterForHandEnd(prev: GameState, next: GameState, rng = Math.random): PlannedReaction[] {
  const result = next.lastHandResult;
  if (prev.phase !== "playing" || next.phase === "playing" || !result) return [];
  const planned: PlannedReaction[] = [];
  const say = (from: string, item: StickerId) =>
    planned.push({ from, reaction: { kind: "say", item }, delayMs: 1700 + planned.length * 700 + rng() * 500 });

  if (result.type === "real_deal") {
    if (rng() < 0.5) say(pick(bots(next), rng), "over");
    return planned;
  }
  const badCall = result.type === "kent_wrong" || result.type === "counter_kent_wrong";
  for (const id of bots(next)) {
    if (planned.length >= 2 || rng() > 0.4) continue;
    const lost = result.losingPartnershipIds.includes(next.players[id]?.partnershipId ?? "");
    if (badCall && !lost) say(id, "clown");
    else if (lost) say(id, pick(["why", "dead", "over", "rematch"] as const, rng));
    else say(id, pick(["cooking", "brain", "watching"] as const, rng));
  }
  return planned;
}

/** Every so often, a bot that is done swapping hurries along a player who isn't. */
export function idleBanter(state: GameState, me: string, rng = Math.random): PlannedReaction | null {
  if (state.phase !== "playing" || state.doneStatus[me] || rng() > 0.03) return null;
  const waiting = bots(state).filter((id) => state.doneStatus[id]);
  if (waiting.length === 0) return null;
  return { from: pick(waiting, rng), reaction: { kind: "say", item: pick(["hurry", "hurry", "watching", "sus"] as const, rng) }, delayMs: 0 };
}

/** You hit a bot with something. Most of the time it hits back. */
export function retaliate(victim: string, item: ThrowId, attacker: string, rng = Math.random): PlannedReaction | null {
  const roll = rng();
  if (roll < 0.6) {
    const back: ThrowId = rng() < 0.5 ? item : pick(THROWABLES, rng).id;
    return { from: victim, reaction: { kind: "throw", item: back, to: attacker }, delayMs: 900 + rng() * 900 };
  }
  if (roll < 0.9) {
    const line: StickerId = item === "rose" || item === "money" ? "brain" : pick(["sus", "why", "rematch", "dead"] as const, rng);
    return { from: victim, reaction: { kind: "say", item: line }, delayMs: 700 + rng() * 600 };
  }
  return null;
}

/** Sometimes a bot answers your sticker. */
export function replyTo(item: StickerId, state: GameState, rng = Math.random): PlannedReaction | null {
  if (rng() > 0.35) return null;
  const replies: Partial<Record<StickerId, StickerId[]>> = {
    hurry: ["hurry", "brain"],
    sus: ["watching", "clown"],
    clown: ["clown", "dead"],
    cooking: ["sus", "watching"],
    dead: ["dead"],
    rematch: ["cooking"],
  };
  const options = replies[item] ?? ["watching", "dead", "sus"];
  return { from: pick(bots(state), rng), reaction: { kind: "say", item: pick(options, rng) }, delayMs: 900 + rng() * 900 };
}
