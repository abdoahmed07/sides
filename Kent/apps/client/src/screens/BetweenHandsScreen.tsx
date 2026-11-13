import { motion } from "framer-motion";
import { PlayingCard } from "../components/Card";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { ScoreTrack } from "../components/ScoreTrack";
import { SignalButtons } from "../components/SignalButtons";
import { teamMemberNames } from "../lib/format";
import { describeOutcome, outcomeTone } from "../lib/outcome";
import { useGameStore } from "../store/gameStore";

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4, ease: [0.22, 0.9, 0.3, 1] as const },
});

const TONE_STYLE = {
  good: { ring: "border-success/40", glow: "rgba(74,222,128,0.18)", tag: "text-success", label: "Good hand" },
  bad: { ring: "border-danger/40", glow: "rgba(242,85,95,0.16)", tag: "text-danger", label: "Ouch" },
  neutral: { ring: "border-gold-400/30", glow: "rgba(240,199,102,0.12)", tag: "text-gold-300", label: "No score" },
} as const;

export function BetweenHandsScreen() {
  const { gameState, session, setTeamSignal, setReady } = useGameStore();
  if (!gameState || !session) return null;

  const me = session.playerId;
  const you = gameState.players[me];
  const yourTeamId = you?.partnershipId ?? null;
  const yourTeam = yourTeamId ? gameState.partnerships[yourTeamId] : null;
  const result = gameState.lastHandResult;
  const outcome = result ? describeOutcome(gameState, result, me) : null;
  const tone = result ? TONE_STYLE[outcomeTone(gameState, result, me)] : null;
  const revealed = result && "revealedCards" in result ? result.revealedCards : [];
  const losers = result && result.type !== "real_deal" ? result.losingPartnershipIds : [];
  const partnerName = yourTeamId
    ? teamMemberNames(gameState, yourTeamId)
        .split(" & ")
        .find((n) => n !== you?.name)
    : null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center gap-6 px-4 pt-14 pb-10">
      <motion.div {...rise(0)} className="text-center">
        <p className="text-xs font-semibold tracking-[0.3em] text-cream-100/40 uppercase">
          {gameState.handNumber === 0 ? "Before the first deal" : `Hand ${gameState.handNumber}`}
        </p>
        <h2 className="mt-1 font-display text-3xl font-extrabold text-gold-300">
          {gameState.handNumber === 0 ? "Get ready" : "Hand over"}
        </h2>
      </motion.div>

      {outcome && tone && (
        <motion.div
          {...rise(0.1)}
          className={`w-full rounded-2xl border ${tone.ring} bg-felt-800/70 p-5 text-center`}
          style={{ boxShadow: `0 0 60px -10px ${tone.glow}, inset 0 1px 0 rgba(255,255,255,0.04)` }}
        >
          <p className={`text-[10px] font-bold tracking-[0.3em] uppercase ${tone.tag}`}>{tone.label}</p>
          <p className="mt-1 text-lg font-semibold text-cream-100">{outcome.headline}</p>
          <p className="mt-1 text-sm text-cream-300">{outcome.detail}</p>
          {revealed.length > 0 && (
            <div className="mt-4 flex justify-center gap-2">
              {revealed.map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ rotateY: 180, y: 10, opacity: 0 }}
                  animate={{ rotateY: 0, y: 0, opacity: 1 }}
                  transition={{ delay: 0.35 + i * 0.1, duration: 0.5, ease: [0.22, 0.9, 0.3, 1] }}
                  style={{ transformPerspective: 600 }}
                >
                  <PlayingCard card={card} size="sm" />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <motion.div {...rise(0.2)} className="flex w-full flex-col items-center gap-2.5 rounded-2xl border border-white/5 bg-felt-900/50 p-4">
        <p className="text-[10px] font-semibold tracking-[0.3em] text-cream-100/40 uppercase">Spell KENT and you lose</p>
        {Object.entries(gameState.partnerships).map(([teamId, team]) => (
          <div key={teamId} className="flex w-full max-w-xs items-center justify-between gap-3">
            <span className={`truncate text-sm ${teamId === yourTeamId ? "font-semibold text-gold-300" : "text-cream-300"}`}>
              {teamMemberNames(gameState, teamId)}
            </span>
            <ScoreTrack teamId={teamId} letters={team.letters} stampLatest={losers.includes(teamId)} />
          </div>
        ))}
      </motion.div>

      <motion.div {...rise(0.3)} className="flex flex-wrap justify-center gap-x-5 gap-y-3">
        {gameState.seats.map((playerId, seat) => {
          if (!playerId) return null;
          const player = gameState.players[playerId];
          if (!player) return null;
          return (
            <PlayerAvatar
              key={seat}
              playerId={player.id}
              name={player.name}
              teamId={player.partnershipId ?? "team-0"}
              isYou={player.id === me}
              isPartner={player.id !== me && player.partnershipId === yourTeamId}
              connected={player.connected}
              ready={player.ready}
              compact
            />
          );
        })}
      </motion.div>

      {yourTeam && (
        <motion.div {...rise(0.4)} className="flex flex-col items-center gap-3">
          <p className="text-center text-sm text-cream-300">
            Your secret signal with <span className="font-semibold text-gold-300">{partnerName ?? "your partner"}</span>
          </p>
          <SignalButtons mode="pick" selectedIcon={yourTeam.signal} onTap={(icon) => setTeamSignal(icon)} />
          <p className="text-xs text-cream-100/45">
            {yourTeam.signal ? "Locked in. Tap another to change it." : "Pick one before you're ready."}
          </p>
        </motion.div>
      )}

      <motion.button
        {...rise(0.5)}
        type="button"
        onClick={() => setReady(!you?.ready)}
        whileTap={{ scale: 0.95 }}
        className={`min-w-56 rounded-full px-8 py-3 font-display text-lg font-bold transition-colors ${
          you?.ready ? "bg-success/15 text-success ring-1 ring-success/60" : "bg-gold-400 text-felt-950 hover:bg-gold-300"
        }`}
        style={you?.ready ? undefined : { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 0 #a87b26, 0 12px 28px -10px rgba(240,199,102,0.7)" }}
      >
        {you?.ready ? "Ready, waiting…" : "Deal me in"}
      </motion.button>
    </div>
  );
}
