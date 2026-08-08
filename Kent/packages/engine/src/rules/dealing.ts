import { createDeck, shuffle, type Card } from "../cards.js";
import { generateId } from "../id.js";
import type { Packet } from "../types.js";

export interface DealResult {
  hands: Record<string, Card[]>;
  packets: Packet[];
}

/**
 * Deals 4 cards to each seated player (in seat order) and splits the
 * remainder into face-down 4-card packets. Only called for 4/6/8 player
 * tables, so 52 - 4*N is always divisible by 4 (36, 28, or 20 cards / 9, 7,
 * or 5 packets) — no leftover-card case to handle.
 */
export function dealNewHand(playerIdsInSeatOrder: string[], rng?: () => number): DealResult {
  const deck = shuffle(createDeck(), rng);
  const hands: Record<string, Card[]> = {};
  let idx = 0;
  for (const playerId of playerIdsInSeatOrder) {
    hands[playerId] = deck.slice(idx, idx + 4);
    idx += 4;
  }

  const remaining = deck.slice(idx);
  const packets: Packet[] = [];
  for (let i = 0; i < remaining.length; i += 4) {
    packets.push({ id: generateId("packet"), cards: remaining.slice(i, i + 4) });
  }

  return { hands, packets };
}
