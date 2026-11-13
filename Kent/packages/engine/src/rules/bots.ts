import type { Card, Rank } from "../cards.js";
import { SIGNAL_ACTIVE_WINDOW_MS, SIGNAL_ICONS, type GameAction, type GameState, type SignalIconId } from "../types.js";
import { isFourOfAKind } from "./fourOfAKind.js";

export const BOT_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

/**
 * How a bot plays at each level. Every chance is "per decision tick" (the client gives each bot
 * a tick a few times a second), so lower numbers mean slower, more hesitant play.
 */
interface BotProfile {
  /** Chance to make a good swap when one exists. */
  swap: number;
  /** Chance a swap is a careless random one instead of the best one. */
  sloppySwap: number;
  /** Chance to pass the round when no swap helps (or after getting four of a kind). */
  declareDone: number;
  /** Holding four of a kind: chance to tap a gesture this tick... */
  tapWhenHolding: number;
  /** ...and how often that tap is the real signal rather than a decoy. */
  tapRealSignal: number;
  /** Holding: wait this long between real-signal taps, so they don't form an obvious pattern. */
  realSignalCooldownMs: number;
  /** Chance to spot the partner's real signal and call KENT. */
  noticePartnerSignal: number;
  /** Chance to call COUNTER KENT on an opponent who keeps tapping the same gesture. */
  counterOnTell: number;
  /** Chance to call COUNTER KENT on any opponent tap at all (a wild guess). */
  counterOnAnyTap: number;
  /** How many times an opponent must tap the same gesture (within a few seconds) to look suspicious. */
  tellRepeats: number;
  /** Only suspect opponents who've also stopped swapping (people holding four of a kind usually do). */
  tellNeedsDone: boolean;
  /** Not holding: chance to tap a fake gesture while idle, to keep opponents guessing. */
  bluff: number;
}

export const BOT_PROFILES: Record<BotDifficulty, BotProfile> = {
  easy: {
    swap: 0.3, sloppySwap: 0.35, declareDone: 0.3,
    tapWhenHolding: 0.5, tapRealSignal: 0.9, realSignalCooldownMs: 0,
    noticePartnerSignal: 0.15, counterOnTell: 0.02, counterOnAnyTap: 0.002, tellRepeats: 2, tellNeedsDone: false,
    bluff: 0.01,
  },
  medium: {
    swap: 0.4, sloppySwap: 0.1, declareDone: 0.4,
    tapWhenHolding: 0.4, tapRealSignal: 0.7, realSignalCooldownMs: 1500,
    noticePartnerSignal: 0.3, counterOnTell: 0.06, counterOnAnyTap: 0, tellRepeats: 3, tellNeedsDone: false,
    bluff: 0.03,
  },
  hard: {
    swap: 0.85, sloppySwap: 0, declareDone: 0.6,
    tapWhenHolding: 0.6, tapRealSignal: 0.7, realSignalCooldownMs: 2000,
    noticePartnerSignal: 0.85, counterOnTell: 0.3, counterOnAnyTap: 0, tellRepeats: 2, tellNeedsDone: true,
    bluff: 0.05,
  },
};

/** Window in which repeated taps of the same gesture by one player count as a "tell". */
const TELL_WINDOW_MS = 6000;

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
  difficulty: BotDifficulty = "medium",
): GameAction | null {
  const odds = BOT_PROFILES[difficulty];
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

  if (state.phase !== "playing" || !team.signal) return null;

  const window = recentTaps(state, now, SIGNAL_ACTIVE_WINDOW_MS);
  const decoys = SIGNAL_ICONS.map((s) => s.id).filter((id) => id !== team.signal);

  // 1. Partner sent our real signal: call it.
  if (partnerId) {
    const partnerSignaled = window.some((t) => t.playerId === partnerId && t.icon === team.signal);
    if (partnerSignaled && rng() < odds.noticePartnerSignal) return { type: "CALL_KENT", playerId: botId };
  }

  const hand = state.hands[botId] ?? [];

  // 2. Holding four of a kind: signal, mixing in decoys, and stop swapping.
  if (isFourOfAKind(hand)) {
    if (rng() < odds.tapWhenHolding) {
      const lastRealAt = Math.max(-Infinity, ...state.signals.filter((t) => t.playerId === botId && t.icon === team.signal).map((t) => t.atMs));
      const cooledDown = now - lastRealAt >= odds.realSignalCooldownMs;
      const icon: SignalIconId = cooledDown && rng() < odds.tapRealSignal ? team.signal : pick(decoys, rng);
      return { type: "TAP_SIGNAL", playerId: botId, icon };
    }
    if (!state.doneStatus[botId] && rng() < odds.declareDone) return { type: "DECLARE_DONE", playerId: botId };
    return null;
  }

  // 3. Watch opponents: someone tapping the same gesture over and over is probably sending it for real.
  const opponentTaps = recentTaps(state, now, TELL_WINDOW_MS).filter(
    (t) => state.players[t.playerId]?.partnershipId !== teamId &&
      (!odds.tellNeedsDone || state.doneStatus[t.playerId]),
  );
  const tells = new Map<string, number>();
  for (const t of opponentTaps) tells.set(`${t.playerId}:${t.icon}`, (tells.get(`${t.playerId}:${t.icon}`) ?? 0) + 1);
  const sawTell = [...tells.values()].some((n) => n >= odds.tellRepeats);
  const sawAnyRecent = window.some((t) => state.players[t.playerId]?.partnershipId !== teamId);
  if ((sawTell && rng() < odds.counterOnTell) || (sawAnyRecent && rng() < odds.counterOnAnyTap)) {
    return { type: "CALL_COUNTER_KENT", playerId: botId };
  }

  // 4. Build toward four of a kind, or pass the round.
  if (!state.doneStatus[botId]) {
    const swap = bestSwap(hand, state.center);
    if (swap && rng() < odds.swap) {
      if (rng() < odds.sloppySwap) {
        const handCard = pick(hand, rng);
        return { type: "SWAP_CARD", playerId: botId, handCardId: handCard.id, centerSlot: Math.floor(rng() * state.center.length) };
      }
      return { type: "SWAP_CARD", playerId: botId, ...swap };
    }
    if (!swap && rng() < odds.declareDone) return { type: "DECLARE_DONE", playerId: botId };
  }

  // 5. Nothing to do right now: maybe tap a fake gesture so opponents can't read anything into taps.
  if (rng() < odds.bluff) return { type: "TAP_SIGNAL", playerId: botId, icon: pick(decoys, rng) };
  return null;
}
