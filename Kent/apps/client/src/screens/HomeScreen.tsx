import { BOT_DIFFICULTIES, type BotDifficulty, type PlayerCount } from "@kent/engine";
import type { FormEvent } from "react";
import { useState } from "react";
import { useGameStore } from "../store/gameStore";

const SEAT_OPTIONS = [4, 6, 8] as const;
const DIFFICULTY_HINT: Record<BotDifficulty, string> = {
  easy: "Slow, careless bots that sometimes miss their partner's signal.",
  medium: "Bots that play sensibly and bluff now and then.",
  hard: "Quick bots that bluff, hide their signals and watch you closely.",
};
const STORED_DIFFICULTY = "kent:difficulty";

function loadDifficulty(): BotDifficulty {
  try {
    const saved = localStorage.getItem(STORED_DIFFICULTY);
    return (BOT_DIFFICULTIES as readonly string[]).includes(saved ?? "") ? (saved as BotDifficulty) : "medium";
  } catch {
    return "medium";
  }
}

export function HomeScreen() {
  const [name, setName] = useState("");
  const [seatCount, setSeatCount] = useState<PlayerCount>(4);
  const [difficulty, setDifficulty] = useState<BotDifficulty>(loadDifficulty);
  const startGame = useGameStore((s) => s.startGame);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      localStorage.setItem(STORED_DIFFICULTY, difficulty);
    } catch {
      // Private browsing etc.: just don't remember the choice.
    }
    startGame(name, seatCount, difficulty);
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <h1 className="font-display text-6xl font-extrabold text-gold-300 drop-shadow-lg">Kent</h1>
      <p className="mt-2 text-cream-400">Signal your partner. Bluff everyone else.</p>

      <form
        onSubmit={handleSubmit}
        className="mt-10 flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-cream-500/10 bg-felt-800/80 p-6 shadow-pop backdrop-blur"
      >
        <label className="flex flex-col gap-1 text-sm text-cream-300">
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Player"
            className="rounded-lg border border-cream-500/20 bg-felt-900 px-3 py-2 text-cream-100 outline-none focus:border-gold-400"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm text-cream-300">
          Players at the table
          <div className="flex gap-2">
            {SEAT_OPTIONS.map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setSeatCount(n)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                  seatCount === n ? "border-gold-400 bg-gold-400/15 text-gold-300" : "border-cream-500/20 text-cream-400"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-cream-500">You + {seatCount - 1} bots. Your partner is the bot sitting across from you.</p>
        </div>

        <div className="flex flex-col gap-1 text-sm text-cream-300">
          Bots
          <div className="flex gap-2">
            {BOT_DIFFICULTIES.map((level) => (
              <button
                type="button"
                key={level}
                onClick={() => setDifficulty(level)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold capitalize transition-colors ${
                  difficulty === level ? "border-gold-400 bg-gold-400/15 text-gold-300" : "border-cream-500/20 text-cream-400"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          <p className="text-xs text-cream-500">{DIFFICULTY_HINT[difficulty]}</p>
        </div>

        <button
          type="submit"
          className="mt-2 rounded-lg bg-gold-400 py-2.5 font-display font-bold text-felt-950 transition-transform hover:scale-[1.02]"
        >
          Play
        </button>
      </form>
    </div>
  );
}
