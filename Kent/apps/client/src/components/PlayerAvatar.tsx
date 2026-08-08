import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";
import { teamPalette } from "../lib/teamColors";

export interface PlayerAvatarFlash {
  icon: string;
  nonce: number;
}

export interface PlayerAvatarProps {
  name: string;
  teamId: string;
  isYou?: boolean;
  connected: boolean;
  /** Ready-up (lobby / between hands) or declared done (mid-hand) — same "settled" visual either way. */
  ready?: boolean;
  done?: boolean;
  flash?: PlayerAvatarFlash | null;
}

export function PlayerAvatar({ name, teamId, isYou, connected, ready, done, flash }: PlayerAvatarProps) {
  const palette = teamPalette(teamId);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const avatarStyle: CSSProperties = { opacity: connected ? 1 : 0.45, ["--flash-color" as string]: palette.hex };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${palette.border} ${palette.bgSoft} font-display text-lg font-bold ${palette.text} ${
            done ? "opacity-60" : ""
          } ${flash ? "animate-signal-flash" : ""}`}
          style={avatarStyle}
        >
          {initial}
        </div>
        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash.nonce}
              initial={{ scale: 0.4, opacity: 0, y: 0 }}
              animate={{ scale: 1.15, opacity: 1, y: -10 }}
              exit={{ opacity: 0, y: -26 }}
              transition={{ duration: 0.55 }}
              className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 text-2xl drop-shadow-lg"
            >
              {flash.icon}
            </motion.div>
          )}
        </AnimatePresence>
        {!connected ? (
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-felt-900 bg-danger" title="Disconnected" />
        ) : ready || done ? (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-felt-900 bg-success text-[9px] text-felt-950"
            title={done ? "Done swapping" : "Ready"}
          >
            ✓
          </span>
        ) : null}
      </div>
      <span className={`max-w-[5.5rem] truncate text-xs font-medium ${isYou ? "text-gold-300" : "text-cream-300"}`}>
        {name}
        {isYou ? " (you)" : ""}
      </span>
    </div>
  );
}
