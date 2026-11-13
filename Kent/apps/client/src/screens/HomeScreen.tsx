import { BOT_DIFFICULTIES, type BotDifficulty, type Card, type PlayerCount } from "@kent/engine";
import { AnimatePresence, motion } from "framer-motion";
import type { FormEvent } from "react";
import { useState } from "react";
import { PlayingCard } from "../components/Card";
import { useGameStore } from "../store/gameStore";

const SEAT_OPTIONS = [4, 6, 8] as const;
const DIFFICULTY_HINT: Record<BotDifficulty, string> = {
  easy: "Slow, careless bots that sometimes miss their partner's signal.",
  medium: "Bots that play sensibly and bluff now and then.",
  hard: "Quick bots that bluff, hide their signals and watch you closely.",
};
const STORED_DIFFICULTY = "kent:difficulty";
const STORED_NAME = "kent:name";

const HERO: Card[] = (["spades", "hearts", "clubs", "diamonds"] as const).map((suit) => ({ id: `hero-${suit}`, rank: "K", suit }));

const RULES = [
  ["Pair up", "You and the player across from you are a team. Agree on a secret gesture before each hand."],
  ["Swap", "Trade cards with the four in the middle until you hold four of a kind, then say you're done."],
  ["Signal", "Got four of a kind? Tap your gesture without getting caught. Bluff with the others."],
  ["Call it", "Spot your partner's signal and hit KENT. Catch an opponent's and hit COUNTER KENT."],
] as const;

function load<T extends string>(key: string, allowed: readonly T[] | null, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return fallback;
    return !allowed || allowed.includes(saved as T) ? (saved as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing etc.: just don't remember the choice.
  }
}

function Segmented<T extends string | number>({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl border border-white/5 bg-felt-950/60 p-1">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={`relative flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
            value === opt ? "text-felt-950" : "text-cream-300 hover:text-cream-100"
          }`}
        >
          {value === opt && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-lg bg-gold-400"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 14px -6px rgba(240,199,102,0.8)" }}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
            />
          )}
          <span className="relative">{opt}</span>
        </button>
      ))}
    </div>
  );
}

export function HomeScreen() {
  const [name, setName] = useState(() => load<string>(STORED_NAME, null, ""));
  const [seatCount, setSeatCount] = useState<PlayerCount>(4);
  const [difficulty, setDifficulty] = useState<BotDifficulty>(() => load(STORED_DIFFICULTY, BOT_DIFFICULTIES, "medium"));
  const [showRules, setShowRules] = useState(false);
  const startGame = useGameStore((s) => s.startGame);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    save(STORED_DIFFICULTY, difficulty);
    save(STORED_NAME, name.trim());
    startGame(name, seatCount, difficulty);
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      {/* Hero: four Kings fanning out. */}
      <div className="relative mb-6 h-36 w-64" aria-hidden="true">
        {HERO.map((card, i) => {
          const off = i - 1.5;
          return (
            <motion.div
              key={card.id}
              className="absolute bottom-0 left-1/2"
              style={{ marginLeft: -38, transformOrigin: "50% 120%" }}
              initial={{ rotate: 0, y: 40, opacity: 0 }}
              animate={{ rotate: off * 11, x: off * 26, y: Math.abs(off) * 6, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.08, type: "spring", stiffness: 180, damping: 18 }}
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.25 }}
              >
                <PlayingCard card={card} size="lg" />
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="text-shimmer font-display text-7xl leading-none font-extrabold drop-shadow-lg"
      >
        Kent
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="mt-2 text-cream-300">
        Signal your partner. Bluff everyone else.
      </motion.p>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.45, ease: [0.22, 0.9, 0.3, 1] }}
        className="mt-8 flex w-full max-w-sm flex-col gap-5 rounded-3xl border border-white/5 bg-felt-800/70 p-6 shadow-pop backdrop-blur"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 30px 60px -25px rgba(0,0,0,0.9)" }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium text-cream-300">
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Player"
            autoComplete="nickname"
            className="rounded-xl border border-white/10 bg-felt-950/60 px-3.5 py-2.5 text-cream-100 transition-colors outline-none placeholder:text-cream-100/25 focus:border-gold-400/70"
          />
        </label>

        <div className="flex flex-col gap-1.5 text-sm font-medium text-cream-300">
          Players at the table
          <Segmented id="seats" options={SEAT_OPTIONS} value={seatCount} onChange={setSeatCount} />
          <p className="text-xs font-normal text-cream-100/45">You + {seatCount - 1} bots. Your partner sits across from you.</p>
        </div>

        <div className="flex flex-col gap-1.5 text-sm font-medium text-cream-300">
          Bots
          <Segmented id="difficulty" options={BOT_DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
          <AnimatePresence mode="wait">
            <motion.p
              key={difficulty}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="text-xs font-normal text-cream-100/45"
            >
              {DIFFICULTY_HINT[difficulty]}
            </motion.p>
          </AnimatePresence>
        </div>

        <motion.button
          type="submit"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97, y: 2 }}
          className="mt-1 rounded-2xl bg-gold-400 py-3 font-display text-lg font-extrabold text-felt-950"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 4px 0 #a87b26, 0 14px 30px -10px rgba(240,199,102,0.7)" }}
        >
          Play
        </motion.button>
      </motion.form>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-5 w-full max-w-sm">
        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          aria-expanded={showRules}
          className="mx-auto flex items-center gap-1.5 text-sm font-medium text-cream-300 hover:text-gold-300"
        >
          How to play
          <motion.svg animate={{ rotate: showRules ? 180 : 0 }} viewBox="0 0 256 256" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
          </motion.svg>
        </button>
        <AnimatePresence initial={false}>
          {showRules && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 0.9, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-white/5 bg-felt-900/50 p-4">
                <ol className="flex flex-col gap-3">
                {RULES.map(([title, text], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-400/15 font-display text-xs font-bold text-gold-300">
                      {i + 1}
                    </span>
                    <p className="text-sm text-cream-300">
                      <span className="font-semibold text-cream-100">{title}. </span>
                      {text}
                    </p>
                  </li>
                ))}
                </ol>
                <p className="text-xs text-cream-100/45">Each time your team loses a hand you get a letter. Spell K-E-N-T and you lose the match.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
