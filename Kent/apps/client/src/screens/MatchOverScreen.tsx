import { ScoreTrack } from "../components/ScoreTrack";
import { teamMemberNames } from "../lib/format";
import { teamPalette } from "../lib/teamColors";
import { useGameStore } from "../store/gameStore";

export function MatchOverScreen() {
  const { gameState, quit } = useGameStore();
  if (!gameState) return null;

  const loserId = gameState.matchLoserPartnershipId;
  const loserPalette = loserId ? teamPalette(loserId) : null;

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-6 px-4 py-8 text-center">
      <h2 className="font-display text-3xl font-extrabold text-gold-300">Match over</h2>
      {loserId && loserPalette && (
        <p className="text-lg text-cream-100">
          <span className={`font-bold ${loserPalette.text}`}>{teamMemberNames(gameState, loserId)}</span> spelled K-E-N-T and loses the
          match. Everyone else wins!
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        {Object.entries(gameState.partnerships).map(([teamId, team]) => (
          <ScoreTrack key={teamId} teamId={teamId} letters={team.letters} label={teamMemberNames(gameState, teamId)} />
        ))}
      </div>

      <button
        type="button"
        onClick={quit}
        className="mt-4 rounded-lg bg-gold-400 px-6 py-2.5 font-display font-bold text-felt-950 transition-transform hover:scale-[1.02]"
      >
        Back to home
      </button>
    </div>
  );
}
