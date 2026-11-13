import { motion } from "framer-motion";
import { useMemo } from "react";
import { ScoreTrack } from "../components/ScoreTrack";
import { teamMemberNames } from "../lib/format";
import { teamPalette } from "../lib/teamColors";
import { useGameStore } from "../store/gameStore";

const CONFETTI_COLORS = ["#f0c766", "#f6d98a", "#4ade80", "#22d3ee", "#f472b6", "#f7f4ec"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.4 + Math.random() * 1.8,
        drift: (Math.random() - 0.5) * 160,
        spin: (Math.random() - 0.5) * 900,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.w, height: p.h, background: p.color }}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: p.drift, rotate: p.spin, opacity: [1, 1, 0] }}
          transition={{ delay: p.delay, duration: p.duration, ease: [0.3, 0.1, 0.6, 1] }}
        />
      ))}
    </div>
  );
}

export function MatchOverScreen() {
  const { gameState, session, quit, startGame, difficulty } = useGameStore();
  if (!gameState || !session) return null;

  const me = gameState.players[session.playerId];
  const loserId = gameState.matchLoserPartnershipId;
  const won = !!loserId && me?.partnershipId !== loserId;
  const loserPalette = loserId ? teamPalette(loserId) : null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      {won && <Confetti />}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xs font-semibold tracking-[0.3em] text-cream-100/40 uppercase"
      >
        Match over
      </motion.p>
      <motion.h2
        initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
        className={`font-display text-6xl leading-none font-extrabold ${won ? "text-shimmer" : "text-danger"}`}
      >
        {won ? "You win!" : "You lose"}
      </motion.h2>
      {loserId && loserPalette && (
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="text-cream-300">
          <span className={`font-bold ${loserPalette.text}`}>{teamMemberNames(gameState, loserId)}</span> spelled K-E-N-T.
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex w-full flex-col items-center gap-2.5 rounded-2xl border border-white/5 bg-felt-900/50 p-4"
      >
        {Object.entries(gameState.partnerships).map(([teamId, team]) => (
          <div key={teamId} className="flex w-full max-w-xs items-center justify-between gap-3">
            <span className={`truncate text-sm ${teamId === me?.partnershipId ? "font-semibold text-gold-300" : "text-cream-300"}`}>
              {teamMemberNames(gameState, teamId)}
            </span>
            <ScoreTrack teamId={teamId} letters={team.letters} />
          </div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="flex flex-col items-center gap-3">
        <motion.button
          type="button"
          onClick={() => startGame(me?.name ?? "Player", gameState.seatCount ?? 4, difficulty)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96, y: 2 }}
          className="min-w-56 rounded-full bg-gold-400 px-8 py-3 font-display text-lg font-bold text-felt-950"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 0 #a87b26, 0 12px 28px -10px rgba(240,199,102,0.7)" }}
        >
          Play again
        </motion.button>
        <button type="button" onClick={quit} className="text-sm font-medium text-cream-300 hover:text-cream-100">
          Back to home
        </button>
      </motion.div>
    </div>
  );
}
