import type { RedactedGameState, SignalIconId } from "@kent/engine";
import { useState } from "react";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { ScoreTrack } from "../components/ScoreTrack";
import { SignalButtons } from "../components/SignalButtons";
import { teamMemberNames } from "../lib/format";
import { useGameStore } from "../store/gameStore";

function describeOutcome(gameState: RedactedGameState): { headline: string; detail: string } | null {
  const result = gameState.lastHandResult;
  if (!result) return null;
  switch (result.type) {
    case "kent_confirmed": {
      const winners = teamMemberNames(gameState, result.winningPartnershipId);
      return { headline: `KENT! ${winners} spotted the signal.`, detail: "Nobody stepped in to block it — everyone else takes a letter." };
    }
    case "kent_wrong": {
      const caller = gameState.players[result.callerPlayerId]?.name ?? "Someone";
      return {
        headline: `${caller} called KENT too soon.`,
        detail: "Their partner didn't actually have four of a kind — their team takes the letter.",
      };
    }
    case "counter_kent_correct": {
      const caller = gameState.players[result.callerPlayerId]?.name ?? "Someone";
      const culprit = gameState.players[result.culpritPlayerId]?.name ?? "someone";
      return { headline: `COUNTER KENT! ${caller} caught ${culprit} red-handed.`, detail: "The signaling team takes the letter." };
    }
    case "counter_kent_wrong": {
      const caller = gameState.players[result.callerPlayerId]?.name ?? "Someone";
      return { headline: `${caller} called COUNTER KENT — but no real signal was active.`, detail: "Their team takes the letter for the bad call." };
    }
    case "real_deal":
      return { headline: "Real Deal — the stock ran dry.", detail: "No one scores this hand. Redealing." };
  }
}

export function BetweenHandsScreen() {
  const { gameState, session, setTeamSignal, setReady } = useGameStore();
  const [pending, setPending] = useState<SignalIconId | null>(null);
  if (!gameState || !session) return null;

  const you = gameState.players[session.playerId];
  const yourTeamId = you?.partnershipId ?? null;
  const yourTeam = yourTeamId ? gameState.partnerships[yourTeamId] : null;
  const outcome = describeOutcome(gameState);

  async function pickSignal(icon: SignalIconId) {
    setPending(icon);
    await setTeamSignal(icon);
    setPending(null);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col items-center gap-6 px-4 py-8">
      <h2 className="font-display text-2xl font-bold text-gold-300">
        {gameState.handNumber === 0 ? "Get ready" : `Hand ${gameState.handNumber} complete`}
      </h2>

      {outcome && (
        <div className="w-full rounded-xl border border-cream-500/15 bg-felt-800/70 p-4 text-center">
          <p className="font-semibold text-cream-100">{outcome.headline}</p>
          <p className="mt-1 text-sm text-cream-400">{outcome.detail}</p>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        {Object.entries(gameState.partnerships).map(([teamId, team]) => (
          <ScoreTrack key={teamId} teamId={teamId} letters={team.letters} label={teamMemberNames(gameState, teamId)} />
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-x-5 gap-y-3">
        {gameState.seats.map((playerId, seat) => {
          if (!playerId) return null;
          const player = gameState.players[playerId];
          if (!player) return null;
          return (
            <PlayerAvatar
              key={seat}
              name={player.name}
              teamId={player.partnershipId ?? "team-0"}
              isYou={player.id === session.playerId}
              connected={player.connected}
              ready={player.ready}
            />
          );
        })}
      </div>

      {yourTeam && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-cream-300">
            Pick your team's secret signal with <span className="font-semibold text-gold-300">{teamMemberNames(gameState, yourTeamId!)}</span>
          </p>
          <SignalButtons mode="pick" selectedIcon={pending ?? yourTeam.signal} onTap={(icon) => void pickSignal(icon)} />
          <p className="text-xs text-cream-500">{yourTeam.signal ? "Locked in — tap another to change it." : "Choose before you're ready."}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void setReady(!you?.ready)}
        className={`rounded-lg px-6 py-2.5 font-display font-bold transition-colors ${
          you?.ready ? "bg-success/20 text-success ring-1 ring-success" : "bg-gold-400 text-felt-950"
        }`}
      >
        {you?.ready ? "Ready ✓" : "Ready for next hand"}
      </button>
    </div>
  );
}
