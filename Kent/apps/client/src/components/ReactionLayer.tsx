import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { FLIGHT_MS, STICKER_BY_ID, THROW_BY_ID, type Reaction } from "../lib/reactions";
import { useGameStore } from "../store/gameStore";

type Point = { x: number; y: number; top: number; bottom: number };

/** Where a player is on screen right now (their avatar, or your hand). */
function anchorPoint(playerId: string): Point | null {
  const el = document.querySelector(`[data-anchor="player:${playerId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 28), top: r.top, bottom: r.bottom };
}

/** Draws every sticker and thrown item over the whole app, positioned at the players' seats. */
export function ReactionLayer() {
  const reactions = useGameStore((s) => s.reactions);
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-live="polite">
      <AnimatePresence>
        {reactions.map((r) => (r.kind === "say" ? <Sticker key={r.id} reaction={r} /> : <Throw key={r.id} reaction={r} />))}
      </AnimatePresence>
    </div>
  );
}

function Sticker({ reaction }: { reaction: Reaction & { kind: "say" } }) {
  const [at] = useState(() => anchorPoint(reaction.from));
  const name = useGameStore((s) => (reaction.from === s.session?.playerId ? "You" : (s.gameState?.players[reaction.from]?.name ?? "")));
  if (!at) return null;
  const sticker = STICKER_BY_ID[reaction.item];
  const tilt = ((reaction.id * 37) % 14) - 7;
  // Keep the sticker on screen even for players sitting at the very edge; for players near the
  // top of the screen it hangs below them instead of above.
  const left = Math.min(Math.max(at.x, 70), window.innerWidth - 70);
  const below = at.top < 100;

  return (
    <motion.div
      className="absolute"
      style={{ left, top: below ? at.bottom - 6 : at.top - 8 }}
      initial={{ opacity: 0, scale: 0.2, y: below ? -20 : 20, rotate: tilt * 3 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotate: tilt }}
      exit={{ opacity: 0, scale: 0.6, y: below ? 24 : -24 }}
      transition={{ type: "spring", stiffness: 520, damping: 17 }}
    >
      <div className={`-translate-x-1/2 ${below ? "" : "-translate-y-full"}`}>
        <div
          className="flex flex-col items-center rounded-2xl border-[3px] border-white bg-gradient-to-b from-[#fffaf0] to-[#f2ead6] px-3 pt-1 pb-1.5 text-felt-950"
          style={{ boxShadow: "0 10px 24px -8px rgba(0,0,0,0.7)" }}
          role="status"
        >
          <motion.span
            className="text-4xl leading-none"
            animate={{ scale: [1, 1.18, 1], rotate: [0, -8, 8, 0] }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            {sticker.emoji}
          </motion.span>
          <span className="mt-0.5 font-display text-sm leading-none font-extrabold whitespace-nowrap lowercase">{sticker.caption}</span>
        </div>
        {!below && <span className="mt-1 block text-center text-[10px] font-semibold text-cream-100/70">{name}</span>}
      </div>
    </motion.div>
  );
}

function Throw({ reaction }: { reaction: Reaction & { kind: "throw" } }) {
  const [path] = useState(() => {
    const from = anchorPoint(reaction.from);
    const to = anchorPoint(reaction.to);
    return from && to ? { from, to } : null;
  });
  if (!path) return null;
  const item = THROW_BY_ID[reaction.item];
  const { from, to } = path;
  const peak = Math.min(from.y, to.y) - 90 - Math.abs(from.x - to.x) * 0.15;
  const flight = FLIGHT_MS / 1000;

  return (
    <motion.div className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      {/* The item in flight: an arc with a spin. */}
      <motion.span
        className="absolute top-0 left-0 text-4xl leading-none"
        style={{ marginLeft: -18, marginTop: -18 }}
        initial={{ x: from.x, y: from.y, rotate: 0, scale: 0.6 }}
        animate={{
          x: [from.x, (from.x + to.x) / 2, to.x],
          y: [from.y, peak, to.y],
          rotate: [0, 360, 760],
          scale: [0.6, 1.25, 1],
          opacity: [1, 1, 1, 0],
        }}
        transition={{ duration: flight, ease: "easeIn", times: [0, 0.5, 1], opacity: { duration: flight + 0.05, times: [0, 0.5, 0.97, 1] } }}
      >
        {item.emoji}
      </motion.span>

      {/* The landing. */}
      <div className="absolute" style={{ left: to.x, top: to.y }}>
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: 70, height: 70, background: `radial-gradient(circle, ${item.color}cc 0%, ${item.color}55 45%, transparent 70%)` }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1.1], opacity: [0, 1, 0] }}
          transition={{ delay: flight, duration: 1.4, times: [0, 0.15, 1] }}
        />
        <motion.span
          className="absolute -translate-x-1/2 -translate-y-1/2 text-4xl"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.4, 1.2], opacity: [0, 1, 0], y: [0, 0, 18] }}
          transition={{ delay: flight, duration: 1.5, times: [0, 0.12, 1] }}
        >
          {item.emoji}
        </motion.span>
        {item.burst.map((bit, i) =>
          Array.from({ length: 3 }, (_, j) => {
            const angle = ((i * 3 + j) / 9) * Math.PI * 2 + reaction.id;
            const dist = 38 + ((i + j * 7 + reaction.id) % 4) * 9;
            const isEmoji = !bit.startsWith("#");
            return (
              <motion.span
                key={`${i}-${j}`}
                className={`absolute ${isEmoji ? "text-base" : "h-2.5 w-2.5 rounded-full"}`}
                style={isEmoji ? { marginLeft: -8, marginTop: -10 } : { background: bit, marginLeft: -5, marginTop: -5 }}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                animate={{ x: Math.cos(angle) * dist, y: [0, Math.sin(angle) * dist, Math.sin(angle) * dist + 26], opacity: [0, 1, 0], scale: 1 }}
                transition={{ delay: flight, duration: 0.9, ease: "easeOut" }}
              >
                {isEmoji ? bit : null}
              </motion.span>
            );
          }),
        )}
        <motion.span
          className="absolute -translate-x-1/2 font-display text-xl font-extrabold whitespace-nowrap"
          style={{ top: -58, color: item.color, textShadow: "0 2px 0 rgba(0,0,0,0.5)" }}
          initial={{ scale: 0, rotate: -12, opacity: 0 }}
          animate={{ scale: [0, 1.25, 1], rotate: -8, opacity: [0, 1, 1, 0] }}
          transition={{ delay: flight + 0.05, duration: 1.3, times: [0, 0.15, 0.7, 1] }}
        >
          {item.word}
        </motion.span>
      </div>
    </motion.div>
  );
}
