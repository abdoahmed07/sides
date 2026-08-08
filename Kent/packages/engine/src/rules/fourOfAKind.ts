import type { Card } from "../cards.js";

export function isFourOfAKind(cards: Card[] | undefined): boolean {
  if (!cards || cards.length !== 4) return false;
  const rank = cards[0]?.rank;
  return rank !== undefined && cards.every((c) => c.rank === rank);
}
