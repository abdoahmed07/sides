import type { Card, Rank } from "../cards.js";
import { SIGNAL_ACTIVE_WINDOW_MS, SIGNAL_ICONS, type GameAction, type GameState, type SignalIconId } from "../types.js";
import { isFourOfAKind } from "./fourOfAKind.js";

/** How eager bots are, per decision tick. Lower = slower, more human-paced. */
const ODDS = {
  swap: 0.5,
  declareDone: 0.4,
  tapWhenHolding: 0.4,
  tapRealSignal: 0.7,
  noticePartnerSignal: 0.45,
  counterOnRepeatedTell: 0.12,
  counterOnAnyTap: 0.02,
};

/** A bot reads a player as "tipping their hand" if they tap the same icon this often within this window. */
const TELL_WINDOW_MS = 6000;
const TELL_REPEATS = 2;

function partnerOf(state: GameState, playerId: string): string | null {
  const teamId = state.players[playerId]?.partnershipId;
  const team = teamId ? state.partnerships[teamId] : undefined;
  if (!team) return null;
  return team.seats.map((s) => state.seats[s]).find((pid) => pid && pid !== playerId) ?? null;
}

function rankCounts(hand: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  return counts;
}

/**
 * Best 1-for-1 trade with the center: take the center card whose rank
 * builds the biggest group in hand, giving up a card from the smallest
 * other group. Only worth it if the group gained ends up bigger than the
 * group broken up — otherwise there's no swap that gets closer to
 * four-of-a-kind.
 */
export function bestSwap(hand: Card[], center: Card[]): { handCardId: string; centerSlot: number } | null {
  const counts = rankCounts(hand);
  let best: { handCardId: string; centerSlot: number; gain: number } | null = null;

  for (const [centerSlot, centerCard] of center.entries()) {
    const have = counts.get(centerCard.rank) ?? 0;
    if (have === 0) continue;
    const giveUp = hand
      .filter((c) => c.rank !== centerCard.rank)
      .sort((a, b) => (counts.get(a.rank) ?? 0) - (counts.get(b.rank) ?? 0))[0];
    if (!giveUp) continue;
    const gain = have + 1 - (counts.get(giveUp.rank) ?? 0);
    if (gain > 0 && (!best || gain > best.gain)) best = { handCardId: giveUp.id, centerSlot, gain };
  }

  return best ? { handCardId: best.handCardId, centerSlot: best.centerSlot } : null;
}

function recentTaps(state: GameState, now: number, windowMs: number) {
  return state.signals.filter((t) => now - t.atMs <= windowMs && now - t.atMs >= 0);
}

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)]!;
}

/**
 * One decision for one bot, or null to wait. Bots only use what a real
 * player in their seat could know: their own hand, the public table, and
 * their own team's real signal.
 */
export function chooseBotAction(
  state: GameState,
  botId: string,
  isBot: (playerId: string) => boolean,
  now: number,
  rng: () => number = Math.random,
): GameAction | null {
  const bot = state.players[botId];
  const teamId = bot?.partnershipId;
  const team = teamId ? state.partnerships[teamId] : undefined;
  if (!bot || !team) return null;
  const partnerId = partnerOf(state, botId);

  if (state.phase === "between_hands") {
    // A human on the team picks the signal (they need to know it); all-bot teams pick their own.
    if (!team.signal && partnerId && isBot(partnerId)) {
      return { type: "SET_TEAM_SIGNAL", playerId: botId, icon: pick(SIGNAL_ICONS, rng).id };
    }
    if (!bot.ready) return { type: "SET_READY", playerId: botId, ready: true };
    return null;
  }

  if (state.phase !== "playing") return null;

  const window = recentTaps(state, now, SIGNAL_ACTIVE_WINDOW_MS);

  // 1. Partner sent our real signal — call it.
  if (partnerId && team.signal) {
    const partnerSignaled = window.some((t) => t.playerId === partnerId && t.icon === team.signal);
    if (partnerSignaled && rng() < ODDS.noticePartnerSignal) return { type: "CALL_KENT", playerId: botId };
  }

  const hand = state.hands[botId] ?? [];
  const holding = isFourOfAKind(hand);

  // 2. Holding four-of-a-kind: signal (mostly the real one, sometimes a decoy) and stop swapping.
  if (holding && team.signal) {
    if (rng() < ODDS.tapWhenHolding) {
      const decoys = SIGNAL_ICONS.map((s) => s.id).filter((id) => id !== team.signal);
      const icon: SignalIconId = rng() < ODDS.tapRealSignal ? team.signal : pick(decoys, rng);
      return { type: "TAP_SIGNAL", playerId: botId, icon };
    }
    if (!state.doneStatus[botId] && rng() < ODDS.declareDone) return { type: "DECLARE_DONE", playerId: botId };
    return null;
  }

  // 3. Watch opponents: someone tapping the same gesture over and over is probably the real one.
  const opponentTaps = recentTaps(state, now, TELL_WINDOW_MS).filter(
    (t) => state.players[t.playerId]?.partnershipId !== teamId,
  );
  const tells = new Map<string, number>();
  for (const t of opponentTaps) tells.set(`${t.playerId}:${t.icon}`, (tells.get(`${t.playerId}:${t.icon}`) ?? 0) + 1);
  const sawTell = [...tells.values()].some((n) => n >= TELL_REPEATS);
  const sawAnyRecent = window.some((t) => state.players[t.playerId]?.partnershipId !== teamId);
  if ((sawTell && rng() < ODDS.counterOnRepeatedTell) || (sawAnyRecent && rng() < ODDS.counterOnAnyTap)) {
    return { type: "CALL_COUNTER_KENT", playerId: botId };
  }

  // 4. Build toward four-of-a-kind, or pass the round.
  if (state.doneStatus[botId]) return null;
  const swap = bestSwap(hand, state.center);
  if (swap) return rng() < ODDS.swap ? { type: "SWAP_CARD", playerId: botId, ...swap } : null;
  return rng() < ODDS.declareDone ? { type: "DECLARE_DONE", playerId: botId } : null;
}
