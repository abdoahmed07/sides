import { motion } from "framer-motion";

export interface PacketPileProps {
  count: number;
  drawable: boolean;
  onDraw: () => void;
}

export function PacketPile({ count, drawable, onDraw }: PacketPileProps) {
  const stackDepth = Math.min(count, 4);

  return (
    <motion.button
      type="button"
      disabled={!drawable || count === 0}
      onClick={onDraw}
      whileHover={drawable && count > 0 ? { y: -4 } : undefined}
      whileTap={drawable && count > 0 ? { scale: 0.94 } : undefined}
      className="relative flex h-14 w-11 shrink-0 items-end justify-center"
    >
      {count === 0 ? (
        <div className="h-12 w-9 rounded-md border border-dashed border-cream-500/25" />
      ) : (
        Array.from({ length: stackDepth }).map((_, i) => (
          <div
            key={i}
            className={`absolute h-12 w-9 rounded-md border shadow-card ${
              drawable ? "border-gold-400/70 bg-gradient-to-br from-felt-600 to-felt-800" : "border-black/30 bg-gradient-to-br from-felt-700 to-felt-900"
            }`}
            style={{ bottom: i * 2, left: `calc(50% - 18px + ${i * 1.5}px)` }}
          />
        ))
      )}
      {count > 0 && (
        <span className="absolute -top-2 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-felt-950 px-1 text-[10px] font-bold text-cream-300 ring-1 ring-cream-500/30">
          {count}
        </span>
      )}
    </motion.button>
  );
}
