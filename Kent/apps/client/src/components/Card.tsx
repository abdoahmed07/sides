import type { Card as CardData, Suit } from "@kent/engine";
import { motion } from "framer-motion";

const SUIT_SYMBOL: Record<Suit, string> = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
const SUIT_COLOR: Record<Suit, string> = {
  clubs: "text-felt-900",
  spades: "text-felt-900",
  diamonds: "text-rose-600",
  hearts: "text-rose-600",
};

const SIZES = {
  sm: { w: "w-10", h: "h-14", rank: "text-xs", suit: "text-lg" },
  md: { w: "w-16", h: "h-[92px]", rank: "text-sm", suit: "text-3xl" },
  lg: { w: "w-20", h: "h-28", rank: "text-base", suit: "text-4xl" },
} as const;

export interface CardProps {
  card?: CardData;
  faceDown?: boolean;
  size?: keyof typeof SIZES;
  selected?: boolean;
  onClick?: () => void;
  layoutId?: string;
}

export function PlayingCard({ card, faceDown, size = "md", selected, onClick, layoutId }: CardProps) {
  const dims = SIZES[size];
  const showBack = faceDown || !card;

  return (
    <motion.button
      type="button"
      layoutId={layoutId}
      onClick={onClick}
      disabled={!onClick}
      whileHover={onClick ? { y: -8 } : undefined}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      animate={selected ? { y: -14 } : { y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`${dims.w} ${dims.h} shrink-0 rounded-lg border ${
        selected ? "border-gold-400 ring-2 ring-gold-400" : "border-black/20"
      } shadow-card ${onClick ? "cursor-pointer" : "cursor-default"} select-none`}
      style={{ perspective: 600 }}
    >
      {showBack ? (
        <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-felt-600 via-felt-700 to-felt-900">
          <span className="font-display text-gold-400/70" style={{ fontSize: size === "sm" ? 12 : 18 }}>
            K
          </span>
        </div>
      ) : (
        <div className={`flex h-full w-full flex-col justify-between rounded-lg bg-cream-100 p-1 ${SUIT_COLOR[card!.suit]}`}>
          <span className={`${dims.rank} font-bold leading-none`}>{card!.rank}</span>
          <span className={`${dims.suit} self-center leading-none`}>{SUIT_SYMBOL[card!.suit]}</span>
          <span className={`${dims.rank} self-end rotate-180 font-bold leading-none`}>{card!.rank}</span>
        </div>
      )}
    </motion.button>
  );
}
