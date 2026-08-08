import { SIGNAL_ICONS, type SignalIconId } from "@kent/engine";
import { useEffect, useRef, useState } from "react";
import { PlayingCard } from "../components/Card";
import { DiscardPile } from "../components/DiscardPile";
import { PlayerAvatar, type PlayerAvatarFlash } from "../components/PlayerAvatar";
import { ScoreTrack } from "../components/ScoreTrack";
import { SeatCircle } from "../components/SeatCircle";
import { SignalButtons } from "../components/SignalButtons";
import { StockPile } from "../components/StockPile";
import { useGameStore } from "../store/gameStore";

const ICON_EMOJI = Object.fromEntries(SIGNAL_ICONS.map((s) => [s.id, s.emoji])) as Record<SignalIconId, string>;
const FLASH_DURATION_MS = 900;

export function TableScreen() {
  const { gameState, session, swapCard, declareDone, tapSignal, callKent, callCounterKent } = useGameStore();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<Record<string, PlayerAvatarFlash>>({});
  const seenSignalCount = useRef(0);

  const signals = gameState?.signals;

  useEffect(() => {
    if (!signals || signals.length <= seenSignalCount.current) {
      seenSignalCount.current = signals?.length ?? 0;
      return;
    }
    const newTaps = signals.slice(seenSignalCount.current);
    seenSignalCount.current = signals.length;

    const nonces = new Map(newTaps.map((tap) => [tap.playerId, tap.atMs + Math.random()]));
    setFlashes((prev) => {
      const next = { ...prev };
      for (const tap of newTaps) {
        next[tap.playerId] = { icon: ICON_EMOJI[tap.icon], nonce: nonces.get(tap.playerId)! };
      }
      return next;
    });

    const timers = newTaps.map((tap) =>
      window.setTimeout(() => {
        setFlashes((prev) => {
          if (prev[tap.playerId]?.nonce !== nonces.get(tap.playerId)) return prev;
          const next = { ...prev };
          delete next[tap.playerId];
          return next;
        });
      }, FLASH_DURATION_MS),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [signals]);

  useEffect(() => {
    setSelectedCardId(null);
  }, [gameState?.handNumber]);

  if (!gameState || !session) return null;

  const you = gameState.players[session.playerId];
  const yourSeat = you?.seat ?? 0;
  const youAreDone = gameState.doneStatus[session.playerId] ?? false;
  const recentTaps = gameState.signals.slice(-6).reverse();

  async function handleCenterTap(slot: number) {
    if (!selectedCardId || youAreDone) return;
    const cardId = selectedCardId;
    setSelectedCardId(null);
    await swapCard(cardId, slot);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:gap-8">
      <div className="flex flex-col items-center gap-2 lg:flex-1">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {Object.entries(gameState.partnerships).map(([teamId, team]) => (
            <ScoreTrack key={teamId} teamId={teamId} letters={team.letters} />
          ))}
        </div>

        <SeatCircle
          seatCount={gameState.seats.length}
          anchorSeat={yourSeat}
          radiusPct={40}
          maxWidthPx={300}
          renderSeat={(seat) => {
            const playerId = gameState.seats[seat];
            if (!playerId || playerId === session.playerId) return null;
            const player = gameState.players[playerId];
            if (!player) return null;
            return (
              <PlayerAvatar
                name={player.name}
                teamId={player.partnershipId ?? "team-0"}
                connected={player.connected}
                done={gameState.doneStatus[playerId] ?? false}
                flash={flashes[playerId] ?? null}
              />
            );
          }}
        />

        <div className="flex flex-col items-center gap-2">
          <p className="text-xs tracking-wide text-cream-500 uppercase">Center — up for grabs</p>
          <div className="flex items-center gap-2">
            {gameState.center.map((card, slot) => (
              <PlayingCard
                key={slot}
                card={card}
                size="md"
                onClick={selectedCardId && !youAreDone ? () => void handleCenterTap(slot) : undefined}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <StockPile count={gameState.stockCount} />
            <DiscardPile count={gameState.discardCount} />
          </div>
        </div>

        <p className="text-center text-sm text-cream-300">
          {youAreDone
            ? "You're done swapping — waiting for everyone else."
            : selectedCardId
              ? "Tap a center card to swap for it."
              : "Tap a card in your hand, then tap a center card to swap."}
        </p>

        {recentTaps.length > 0 && (
          <div className="no-scrollbar flex w-full max-w-md items-center gap-2 overflow-x-auto rounded-lg bg-felt-900/60 px-3 py-2 text-xs text-cream-400">
            <span className="shrink-0 tracking-wide text-cream-500 uppercase">Signals</span>
            {recentTaps.map((tap) => (
              <span key={tap.id} className="shrink-0 rounded-full bg-felt-800 px-2 py-1">
                {ICON_EMOJI[tap.icon]} {gameState.players[tap.playerId]?.name ?? "?"}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 pt-1 lg:flex-1">
        <div className="flex justify-center gap-2">
          {gameState.yourHand.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              selected={selectedCardId === card.id}
              onClick={youAreDone ? undefined : () => setSelectedCardId((id) => (id === card.id ? null : card.id))}
              size="lg"
            />
          ))}
        </div>

        <button
          type="button"
          disabled={youAreDone}
          onClick={() => void declareDone()}
          className={`rounded-lg px-6 py-2 font-display font-bold transition-colors ${
            youAreDone ? "bg-success/20 text-success ring-1 ring-success" : "bg-felt-800 text-cream-200 hover:bg-felt-700"
          } disabled:cursor-default`}
        >
          {youAreDone ? "Done ✓" : "I'm done swapping"}
        </button>

        <SignalButtons onTap={(icon) => void tapSignal(icon)} />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void callKent()}
            className="rounded-full bg-success px-6 py-2.5 font-display font-extrabold tracking-wide text-felt-950 shadow-pop"
          >
            KENT!
          </button>
          <button
            type="button"
            onClick={() => void callCounterKent()}
            className="rounded-full bg-danger px-6 py-2.5 font-display font-extrabold tracking-wide text-felt-950 shadow-pop"
          >
            COUNTER KENT!
          </button>
        </div>
      </div>
    </div>
  );
}
