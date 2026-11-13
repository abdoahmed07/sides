import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { outcomeStamp, outcomeTone, type OutcomeTone } from "../lib/outcome";
import { useGameStore } from "../store/gameStore";

const TONE_COLOR: Record<OutcomeTone, string> = { good: "#4ade80", bad: "#f2555f", neutral: "#f0c766" };

/** Slams the call ("KENT!", "COUNTER KENT!", "REAL DEAL") across the screen the moment a hand ends. */
export function CallBanner() {
  const result = useGameStore((s) => s.gameState?.lastHandResult ?? null);
  const gameState = useGameStore((s) => s.gameState);
  const me = useGameStore((s) => s.session?.playerId ?? "");
  const seen = useRef<number | null>(result?.atMs ?? null);
  const [shown, setShown] = useState<{ key: number; word: string; color: string; by: string } | null>(null);

  useEffect(() => {
    if (!result || !gameState || result.atMs === seen.current) return;
    seen.current = result.atMs;
    const caller = "callerPlayerId" in result ? result.callerPlayerId : null;
    const by = caller ? `${caller === me ? "You" : (gameState.players[caller]?.name ?? "Someone")} called it` : "";
    setShown({ key: result.atMs, word: outcomeStamp(result), color: TONE_COLOR[outcomeTone(gameState, result, me)], by });
  }, [result, gameState, me]);

  // Its own effect, so bot moves re-rendering the screen can't cancel the timer.
  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => setShown(null), 1500);
    return () => window.clearTimeout(t);
  }, [shown]);

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown.key}
          className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="assertive"
        >
          <div className="absolute inset-0 bg-felt-950/70 backdrop-blur-[2px]" />
          <motion.div
            className="relative font-display text-6xl font-extrabold tracking-tight sm:text-7xl"
            style={{ color: shown.color, textShadow: `0 0 40px ${shown.color}88, 0 6px 0 rgba(0,0,0,0.35)` }}
            initial={{ scale: 3, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: -6, opacity: 1, x: [0, -8, 7, -4, 2, 0] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 18, x: { delay: 0.18, duration: 0.35 } }}
          >
            {shown.word}
          </motion.div>
          {shown.by && (
            <motion.p
              className="relative mt-3 text-sm font-semibold tracking-wide text-cream-100/80"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {shown.by}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
