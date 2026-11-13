import type { Card as CardData, Suit } from "@kent/engine";
import { animate, motion, type TargetAndTransition } from "framer-motion";
import { useLayoutEffect, useRef } from "react";
import type { CardOrigin } from "../lib/cardOrigins";

const SUIT_SYMBOL: Record<Suit, string> = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
const RED: Record<Suit, boolean> = { clubs: false, spades: false, diamonds: true, hearts: true };

const SIZES = {
  sm: { w: 44, h: 62, index: 11, pip: 22, radius: 6 },
  md: { w: 64, h: 90, index: 14, pip: 32, radius: 8 },
  lg: { w: 76, h: 108, index: 16, pip: 40, radius: 9 },
} as const;
export type CardSize = keyof typeof SIZES;

export interface CardProps {
  card?: CardData;
  faceDown?: boolean;
  size?: CardSize;
  selected?: boolean;
  /** Pulses as a place you can drop the selected card. */
  target?: boolean;
  onClick?: () => void;
  layoutId?: string;
  /** Fly in from this table anchor (and flip face-up) when the card first appears. */
  origin?: CardOrigin;
  /** Resting pose, e.g. the tilt of a card in a fanned hand. */
  pose?: { rotate?: number; y?: number };
  label?: string;
}

export function PlayingCard({ card, faceDown, size = "md", selected, target, onClick, layoutId, origin, pose, label }: CardProps) {
  const dims = SIZES[size];
  const flyRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const showBack = faceDown || !card;
  // Captured once: the fly-in only ever plays when the card first mounts.
  const mountOrigin = useRef(origin);
  const mountFaceUp = useRef(!showBack);

  // Fly in from wherever the card came from, then turn face-up.
  useLayoutEffect(() => {
    const fly = flyRef.current;
    const flip = flipRef.current;
    const origin = mountOrigin.current;
    if (!origin || !fly || !flip) return;
    const anchor = document.querySelector(`[data-anchor="${origin.from}"]`);
    if (!anchor) {
      fly.style.opacity = "";
      return;
    }
    const a = anchor.getBoundingClientRect();
    const b = fly.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    const ease = [0.22, 0.9, 0.3, 1] as const;
    const fromStock = origin.from === "stock";
    animate(
      fly,
      { x: [dx, 0], y: [dy, 0], scale: [fromStock ? 0.6 : 0.4, 1], rotate: [fromStock ? -14 : 18, 0], opacity: [0, 1, 1] },
      { duration: 0.55, delay: origin.delay, ease },
    );
    if (mountFaceUp.current) animate(flip, { rotateY: [180, 180, 0] }, { duration: 0.75, delay: origin.delay, ease, times: [0, 0.45, 1] });
  }, []);

  const rest: TargetAndTransition = {
    y: selected ? -20 : (pose?.y ?? 0),
    rotate: selected ? 0 : (pose?.rotate ?? 0),
    scale: selected ? 1.06 : 1,
  };

  return (
    <div ref={flyRef} style={{ opacity: origin ? 0 : undefined, zIndex: selected ? 10 : undefined }} className="relative">
      <motion.button
        type="button"
        layoutId={layoutId}
        onClick={onClick}
        disabled={!onClick}
        aria-label={label ?? (card && !showBack ? `${card.rank} of ${card.suit}` : "Face-down card")}
        aria-pressed={onClick ? !!selected : undefined}
        initial={false}
        animate={rest}
        whileHover={onClick && !selected ? { y: (pose?.y ?? 0) - 8, rotate: (pose?.rotate ?? 0) * 0.5 } : undefined}
        whileTap={onClick ? { scale: 0.94 } : undefined}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        className={`relative block shrink-0 select-none ${onClick ? "cursor-pointer" : "cursor-default"} focus-visible:outline-none`}
        style={{ width: dims.w, height: dims.h, perspective: 700 }}
      >
        <div
          ref={flipRef}
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d", transform: showBack ? "rotateY(180deg)" : undefined }}
        >
          {!faceDown && <CardFace card={card} dims={dims} />}
          <CardBack dims={dims} />
        </div>

        {selected && (
          <motion.span
            layoutId="card-selection"
            className="pointer-events-none absolute -inset-[3px] rounded-[11px] ring-2 ring-gold-400"
            style={{ boxShadow: "0 0 24px 2px rgba(240,199,102,0.45)" }}
          />
        )}
        {target && (
          <span
            className="pointer-events-none absolute -inset-[3px] animate-target rounded-[11px] border-2 border-dashed border-gold-400/80"
            aria-hidden="true"
          />
        )}
      </motion.button>
    </div>
  );
}

type Dims = (typeof SIZES)[CardSize];

function CardFace({ card, dims }: { card?: CardData; dims: Dims }) {
  if (!card) return null;
  const red = RED[card.suit];
  const symbol = SUIT_SYMBOL[card.suit];
  const court = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const color = red ? "text-[#c8243a]" : "text-[#16201b]";

  const Index = ({ flipped }: { flipped?: boolean }) => (
    <span
      className={`absolute flex flex-col items-center leading-none font-bold ${flipped ? "right-1 bottom-1 rotate-180" : "top-1 left-1"}`}
      style={{ fontSize: dims.index, letterSpacing: card.rank === "10" ? "-0.08em" : undefined }}
    >
      <span>{card.rank}</span>
      <span style={{ fontSize: dims.index * 0.85, marginTop: 1 }}>{symbol}</span>
    </span>
  );

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${color}`}
      style={{
        borderRadius: dims.radius,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        background: "linear-gradient(160deg, #fffdf6 0%, #f4efe1 60%, #e9e2cf 100%)",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9), var(--shadow-card)",
      }}
    >
      <Index />
      <Index flipped />
      <div className="absolute inset-0 flex items-center justify-center">
        {court ? (
          <div
            className="flex flex-col items-center justify-center rounded-[4px] border border-current/25"
            style={{ width: dims.w * 0.52, height: dims.h * 0.56, background: red ? "rgba(200,36,58,0.06)" : "rgba(22,32,27,0.05)" }}
          >
            <span className="font-display leading-none font-extrabold" style={{ fontSize: dims.pip * 0.9 }}>
              {card.rank}
            </span>
            <span className="leading-none" style={{ fontSize: dims.pip * 0.42 }}>
              {symbol}
            </span>
          </div>
        ) : (
          <span className="leading-none" style={{ fontSize: dims.pip }}>
            {symbol}
          </span>
        )}
      </div>
    </div>
  );
}

function CardBack({ dims }: { dims: Dims }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        borderRadius: dims.radius,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
        background: "#14201b",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.4), var(--shadow-card)",
      }}
    >
      <div className="card-back-pattern absolute inset-[3px] flex items-center justify-center rounded-[5px] border border-gold-400/35">
        <span
          className="flex items-center justify-center rounded-full border border-gold-400/50 bg-felt-900 font-display font-extrabold text-gold-300"
          style={{ width: dims.w * 0.42, height: dims.w * 0.42, fontSize: dims.w * 0.24 }}
        >
          K
        </span>
      </div>
    </div>
  );
}
