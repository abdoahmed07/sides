import { KENT_WORD } from "@kent/engine";
import { teamPalette } from "../lib/teamColors";

export function ScoreTrack({ teamId, letters, label }: { teamId: string; letters: string; label?: string }) {
  const palette = teamPalette(teamId);
  return (
    <div className="flex items-center gap-2">
      {label && <span className={`text-xs font-semibold ${palette.text}`}>{label}</span>}
      <div className="flex gap-1">
        {KENT_WORD.split("").map((letter, i) => {
          const earned = i < letters.length;
          return (
            <span
              key={letter}
              className={`flex h-6 w-6 items-center justify-center rounded-md font-display text-sm font-bold ${
                earned ? `${palette.bgSoft} ${palette.text} ring-1 ${palette.ring}` : "bg-felt-800 text-cream-500/30"
              }`}
            >
              {letter}
            </span>
          );
        })}
      </div>
    </div>
  );
}
