import { SIGNAL_ICONS, type SignalIconId } from "@kent/engine";
import { motion } from "framer-motion";

export interface SignalButtonsProps {
  onTap: (icon: SignalIconId) => void;
  disabled?: boolean;
  selectedIcon?: SignalIconId | null;
  mode?: "play" | "pick";
  /** Your team's signal: marked so you don't forget which one is real. */
  ownIcon?: SignalIconId | null;
}

export function SignalButtons({ onTap, disabled, selectedIcon, mode = "play", ownIcon }: SignalButtonsProps) {
  const pick = mode === "pick";
  return (
    <div className="flex gap-2.5">
      {SIGNAL_ICONS.map((s) => {
        const chosen = pick && selectedIcon === s.id;
        const ours = !pick && ownIcon === s.id;
        return (
          <motion.button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => onTap(s.id)}
            aria-label={pick ? `Choose ${s.label} as your team's signal` : `Tap ${s.label}${ours ? " (your team's signal)" : ""}`}
            aria-pressed={pick ? chosen : undefined}
            whileTap={{ scale: 0.8, rotate: -6 }}
            whileHover={disabled ? undefined : { y: -3 }}
            transition={{ type: "spring", stiffness: 600, damping: 18 }}
            className={`relative flex flex-col items-center justify-center gap-0.5 rounded-2xl border text-2xl transition-colors ${
              pick ? "h-[72px] w-[68px]" : "h-14 w-14"
            } ${
              chosen || ours
                ? "border-gold-400 bg-gold-400/15"
                : "border-white/10 bg-gradient-to-b from-felt-700 to-felt-800 hover:border-gold-400/50"
            } ${disabled ? "opacity-40" : ""}`}
            style={{ boxShadow: chosen ? "0 0 22px -4px rgba(240,199,102,0.6)" : "inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 14px -6px rgba(0,0,0,0.7)" }}
          >
            {chosen && (
              <motion.span
                layoutId="signal-choice"
                className="absolute inset-0 rounded-2xl ring-2 ring-gold-400"
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              />
            )}
            {ours && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold-400 px-1.5 py-px text-[8px] font-extrabold tracking-wider text-felt-950 uppercase">
                Ours
              </span>
            )}
            <span>{s.emoji}</span>
            {pick && <span className="text-[9px] font-semibold tracking-wider text-cream-300 uppercase">{s.label}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
