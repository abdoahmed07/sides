import { createDeck, shuffle, type Card } from "../cards.js";
import { CENTER_SIZE } from "../types.js";

export interface DealResult {
  hands: Record<string, Card[]>;
  center: Card[];
  stock: Card[];
}

/**
 * Deals 4 cards to each seated player (in seat order), CENTER_SIZE cards
 * face-up to the shared center, and the remainder becomes the hidden stock
 * that refills the center as players swap.
 */
export function dealNewHand(playerIdsInSeatOrder: string[], rng?: () => number): DealResult {
  const deck = shuffle(createDeck(), rng);
  const hands: Record<string, Card[]> = {};
  let idx = 0;
  for (const playerId of playerIdsInSeatOrder) {
    hands[playerId] = deck.slice(idx, idx + 4);
    idx += 4;
  }

  const center = deck.slice(idx, idx + CENTER_SIZE);
  idx += CENTER_SIZE;
  const stock = deck.slice(idx);

  return { hands, center, stock };
}
