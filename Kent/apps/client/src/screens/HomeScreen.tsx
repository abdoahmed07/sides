import type { FormEvent } from "react";
import { useState } from "react";
import { useGameStore } from "../store/gameStore";

const SEAT_OPTIONS = [4, 6, 8] as const;

export function HomeScreen() {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [seatCount, setSeatCount] = useState<4 | 6 | 8>(4);
  const [roomCode, setRoomCode] = useState("");
  const { createRoom, joinRoom, busy, lastError, clearError, status } = useGameStore();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === "create") void createRoom(name.trim(), seatCount);
    else void joinRoom(roomCode.trim(), name.trim());
  }

  function switchMode(next: "create" | "join") {
    setMode(next);
    clearError();
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <h1 className="font-display text-6xl font-extrabold text-gold-300 drop-shadow-lg">Kent</h1>
      <p className="mt-2 text-cream-400">Signal your partner. Bluff everyone else.</p>

      <div className="mt-10 w-full max-w-sm rounded-2xl border border-cream-500/10 bg-felt-800/80 p-6 shadow-pop backdrop-blur">
        <div className="mb-5 flex rounded-xl bg-felt-900 p-1">
          <button
            type="button"
            onClick={() => switchMode("create")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === "create" ? "bg-gold-400 text-felt-950" : "text-cream-400"
            }`}
          >
            Create room
          </button>
          <button
            type="button"
            onClick={() => switchMode("join")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === "join" ? "bg-gold-400 text-felt-950" : "text-cream-400"
            }`}
          >
            Join room
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-cream-300">
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="Alex"
              className="rounded-lg border border-cream-500/20 bg-felt-900 px-3 py-2 text-cream-100 outline-none focus:border-gold-400"
              required
            />
          </label>

          {mode === "create" ? (
            <div className="flex flex-col gap-1 text-sm text-cream-300">
              Table size
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
            </div>
          ) : (
            <label className="flex flex-col gap-1 text-sm text-cream-300">
              Room code
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABCDE"
                className="rounded-lg border border-cream-500/20 bg-felt-900 px-3 py-2 tracking-[0.3em] text-cream-100 uppercase outline-none focus:border-gold-400"
                required
              />
            </label>
          )}

          {lastError && <p className="text-sm text-danger">{lastError.message}</p>}

          <button
            type="submit"
            disabled={busy || status !== "connected"}
            className="mt-2 rounded-lg bg-gold-400 py-2.5 font-display font-bold text-felt-950 transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {status !== "connected" ? "Connecting…" : busy ? "…" : mode === "create" ? "Create room" : "Join room"}
          </button>
        </form>
      </div>
    </div>
  );
}
