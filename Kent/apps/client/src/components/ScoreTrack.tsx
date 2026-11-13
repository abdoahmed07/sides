import { KENT_WORD } from "@kent/engine";
import { motion } from "framer-motion";
import { teamPalette } from "../lib/teamColors";

export interface ScoreTrackProps {
  teamId: string;
  letters: string;
  label?: string;
  /** Stamp the team's newest letter in, for the hand where they just earned it. */
  stampLatest?: boolean;
  compact?: boolean;
}

export function ScoreTrack({ teamId, letters, label, stampLatest, compact }: ScoreTrackProps) {
  const palette = teamPalette(teamId);
  const box = compact ? "h-5 w-5 text-xs rounded" : "h-7 w-7 text-sm rounded-md";
  return (
    <div className="flex items-center gap-2">
      {label && <span className={`text-xs font-semibold ${palette.text}`}>{label}</span>}
      <div className="flex gap-1">
        {KENT_WORD.split("").map((letter, i) => {
          const earned = i < letters.length;
          const stamp = stampLatest && i === letters.length - 1;
          return (
            <motion.span
              key={`${letter}-${earned}`}
              initial={stamp ? { scale: 2.6, rotate: -18, opacity: 0 } : false}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={stamp ? { delay: 0.55, type: "spring", stiffness: 520, damping: 16 } : undefined}
              className={`flex items-center justify-center font-display font-bold ${box} ${
                earned ? `${palette.bgSoft} ${palette.text} ring-1 ${palette.ring}` : "bg-felt-950/60 text-cream-100/20 ring-1 ring-white/5"
              }`}
              style={earned ? { boxShadow: `0 0 12px -3px ${palette.hex}` } : undefined}
            >
              {letter}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
}
