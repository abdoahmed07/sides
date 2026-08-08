import { PlayerAvatar } from "../components/PlayerAvatar";
import { SeatCircle } from "../components/SeatCircle";
import { useGameStore } from "../store/gameStore";

export function LobbyScreen() {
  const { gameState, session, joinSeat, leaveSeat, setReady, startMatch, lastError, leaveRoom } = useGameStore();
  if (!gameState || !session) return null;

  const you = gameState.players[session.playerId];
  const isHost = gameState.hostPlayerId === session.playerId;
  const seatCount = gameState.seatCount ?? gameState.seats.length;
  const allFilled = gameState.seats.every((s) => s !== null);
  const allReady = gameState.seats.every((s) => s && gameState.players[s]?.ready);
  const canStart = isHost && allFilled && allReady;
  const youAreSeated = typeof you?.seat === "number";

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center gap-6 px-4 py-8">
      <div className="text-center">
        <p className="text-xs tracking-widest text-cream-500 uppercase">Room code</p>
        <div className="flex items-center justify-center gap-2">
          <p className="font-display text-4xl font-extrabold tracking-[0.2em] text-gold-300">{gameState.roomCode}</p>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(gameState.roomCode)}
            className="rounded-md border border-cream-500/20 px-2 py-1 text-xs text-cream-400 hover:border-gold-400"
          >
            Copy
          </button>
        </div>
        <p className="mt-1 text-sm text-cream-400">Share this code — partners always sit across the table, never side by side.</p>
      </div>

      <SeatCircle
        seatCount={seatCount}
        renderSeat={(seat) => {
          const playerId = gameState.seats[seat];
          const player = playerId ? gameState.players[playerId] : null;
          if (!player) {
            return (
              <button
                type="button"
                onClick={() => void joinSeat(seat)}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-cream-500/30 text-xs text-cream-500 hover:border-gold-400 hover:text-gold-300"
              >
                Sit
              </button>
            );
          }
          return (
            <button
              type="button"
              onClick={() => player.id === session.playerId && void leaveSeat()}
              title={player.id === session.playerId ? "Leave this seat" : undefined}
            >
              <PlayerAvatar
                name={player.name}
                teamId={player.partnershipId ?? "team-0"}
                isYou={player.id === session.playerId}
                connected={player.connected}
                ready={player.ready}
              />
            </button>
          );
        }}
      />

      {lastError && <p className="text-sm text-danger">{lastError.message}</p>}

      <div className="flex flex-col items-center gap-3">
        {youAreSeated ? (
          <button
            type="button"
            onClick={() => void setReady(!you!.ready)}
            className={`rounded-lg px-6 py-2.5 font-display font-bold transition-colors ${
              you!.ready ? "bg-success/20 text-success ring-1 ring-success" : "bg-gold-400 text-felt-950"
            }`}
          >
            {you!.ready ? "Ready ✓" : "I'm ready"}
          </button>
        ) : (
          <p className="text-sm text-cream-400">Pick an open seat to join in.</p>
        )}

        {isHost ? (
          <button
            type="button"
            onClick={() => void startMatch()}
            disabled={!canStart}
            className="rounded-lg border border-gold-400/60 px-6 py-2 text-sm font-semibold text-gold-300 disabled:opacity-30"
          >
            Start match
          </button>
        ) : (
          <p className="text-xs text-cream-500">Waiting for the host to start…</p>
        )}

        <button type="button" onClick={leaveRoom} className="text-xs text-cream-500 underline underline-offset-2">
          Leave room
        </button>
      </div>
    </div>
  );
}
