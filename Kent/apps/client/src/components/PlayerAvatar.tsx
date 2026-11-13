import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";
import { teamPalette } from "../lib/teamColors";
import { useShake } from "../lib/useShake";

export interface PlayerAvatarFlash {
  icon: string;
  nonce: number;
}

export interface PlayerAvatarProps {
  playerId?: string;
  name: string;
  teamId: string;
  isYou?: boolean;
  isPartner?: boolean;
  connected: boolean;
  /** Ready for the next hand (between hands). */
  ready?: boolean;
  /** Declared done swapping (mid-hand). */
  done?: boolean;
  flash?: PlayerAvatarFlash | null;
  compact?: boolean;
  /** Last time something thrown hit this player; each new value plays a wobble. */
  hitAt?: number;
  /** Set while you're aiming something: the avatar becomes a tap target. */
  onTarget?: () => void;
}

export function PlayerAvatar({ playerId, name, teamId, isYou, isPartner, connected, ready, done, flash, compact, hitAt, onTarget }: PlayerAvatarProps) {
  const palette = teamPalette(teamId);
  const shakeRef = useShake<HTMLDivElement>(hitAt);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const size = compact ? 44 : 54;
  const avatarStyle: CSSProperties = {
    width: size,
    height: size,
    opacity: connected ? 1 : 0.45,
    ["--flash-color" as string]: palette.hex,
    background: `radial-gradient(circle at 35% 30%, ${palette.hex}55, ${palette.hex}14 60%, #0d1512 100%)`,
    boxShadow: done ? undefined : `0 0 0 3px #0b1410, 0 0 18px -2px ${palette.hex}66`,
  };

  return (
    <div className="relative flex flex-col items-center gap-1" data-anchor={playerId ? `player:${playerId}` : undefined}>
      {onTarget && (
        <button
          type="button"
          onClick={onTarget}
          aria-label={`Throw at ${name}`}
          className="absolute -inset-2 z-20 cursor-crosshair rounded-2xl"
        >
          <span className="absolute top-0 left-1/2 h-[70px] w-[70px] -translate-x-1/2 animate-target rounded-full border-2 border-dashed border-danger" />
        </button>
      )}
      <div ref={shakeRef} className="relative">
        <motion.div
          animate={{ scale: done ? 0.92 : 1, filter: done ? "saturate(0.4) brightness(0.8)" : "saturate(1) brightness(1)" }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className={`flex items-center justify-center rounded-full border-2 ${palette.border} font-display font-bold ${palette.text} ${
            flash ? "animate-signal-flash" : ""
          }`}
          style={{ ...avatarStyle, fontSize: compact ? 16 : 20 }}
        >
          {initial}
        </motion.div>

        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash.nonce}
              initial={{ scale: 0.3, opacity: 0, y: 6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.6, opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2"
            >
              <div className="relative rounded-full bg-cream-100 px-2 py-0.5 text-xl shadow-pop">
                {flash.icon}
                <span className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-cream-100" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(ready || done) && connected && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 20 }}
              className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-felt-900 bg-success text-felt-950"
              title={done ? "Done swapping" : "Ready"}
            >
              <svg viewBox="0 0 256 256" width="11" height="11" fill="currentColor" aria-hidden="true">
                <path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z" />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
        {!connected && (
          <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-felt-900 bg-danger" title="Disconnected" />
        )}
      </div>
      <div className="flex flex-col items-center leading-tight">
        <span className={`max-w-[5.5rem] truncate text-xs font-semibold ${isYou ? "text-gold-300" : "text-cream-100/90"}`}>
          {name}
          {isYou ? " (you)" : ""}
        </span>
        {isPartner && <span className={`text-[9px] font-bold tracking-widest uppercase ${palette.text}`}>Partner</span>}
      </div>
    </div>
  );
}
