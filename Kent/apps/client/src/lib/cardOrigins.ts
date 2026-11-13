import type { GameState } from "@kent/engine";

/** `from` names a `data-anchor` element on the table: "stock" or "player:<id>". */
export interface CardOrigin {
  from: string;
  delay: number;
}
export type CardOrigins = Record<string, CardOrigin>;

/**
 * Works out where each card that just appeared on screen came from, so it can fly in from there:
 * a new deal or a new round comes off the stock; a card a bot swapped in comes from that bot.
 * Cards you move yourself don't need an origin: they glide from your hand via a shared layout id.
 */
export function cardOriginsFor(prev: GameState | null, next: GameState, me: string, current: CardOrigins): CardOrigins {
  if (next.phase !== "playing") return current;

  const newHand = !prev || prev.phase !== "playing" || next.handNumber !== prev.handNumber;
  if (newHand) {
    const origins: CardOrigins = {};
    next.center.forEach((card, i) => (origins[card.id] = { from: "stock", delay: i * 0.07 }));
    (next.hands[me] ?? []).forEach((card, i) => (origins[card.id] = { from: "stock", delay: 0.35 + i * 0.09 }));
    return origins;
  }

  const prevIds = new Set(prev.center.map((c) => c.id));
  const added = next.center.map((card, slot) => ({ card, slot })).filter(({ card }) => !prevIds.has(card.id));
  if (added.length === 0) return current;

  const origins = { ...current };
  if (next.stock.length < prev.stock.length) {
    added.forEach(({ card, slot }) => (origins[card.id] = { from: "stock", delay: 0.15 + slot * 0.08 }));
    return origins;
  }
  for (const { card, slot } of added) {
    const taken = prev.center[slot];
    const swapper = Object.keys(next.hands).find((id) => next.hands[id]?.some((c) => c.id === taken?.id));
    if (swapper && swapper !== me) origins[card.id] = { from: `player:${swapper}`, delay: 0 };
  }
  return origins;
}
