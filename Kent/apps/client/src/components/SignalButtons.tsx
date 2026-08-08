import { SIGNAL_ICONS, type SignalIconId } from "@kent/engine";
import { motion } from "framer-motion";

export interface SignalButtonsProps {
  onTap: (icon: SignalIconId) => void;
  disabled?: boolean;
  selectedIcon?: SignalIconId | null;
  mode?: "play" | "pick";
}

export function SignalButtons({ onTap, disabled, selectedIcon, mode = "play" }: SignalButtonsProps) {
  return (
    <div className="flex gap-3">
      {SIGNAL_ICONS.map((s) => (
        <motion.button
          key={s.id}
          type="button"
          disabled={disabled}
          onClick={() => onTap(s.id)}
          whileTap={{ scale: 0.82 }}
          whileHover={disabled ? undefined : { scale: 1.08 }}
          className={`flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 text-2xl shadow-pop transition-colors ${
            mode === "pick" && selectedIcon === s.id
              ? "border-gold-400 bg-gold-400/20"
              : "border-cream-500/20 bg-felt-800/80 hover:border-gold-400/60"
          } ${disabled ? "opacity-40" : ""}`}
        >
          <span>{s.emoji}</span>
          {mode === "pick" && <span className="text-[9px] font-medium tracking-wide text-cream-400 uppercase">{s.label}</span>}
        </motion.button>
      ))}
    </div>
  );
}
