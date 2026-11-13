import { SIGNAL_ICONS, type SignalIconId } from "@kent/engine";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PlayingCard } from "../components/Card";
import { DiscardPile } from "../components/DiscardPile";
import { EmotePicker } from "../components/EmotePicker";
import { PlayerAvatar, type PlayerAvatarFlash } from "../components/PlayerAvatar";
import { ScoreTrack } from "../components/ScoreTrack";
import { SignalButtons } from "../components/SignalButtons";
import { StockPile } from "../components/StockPile";
import { THROW_BY_ID, type ThrowId } from "../lib/reactions";
import { useShake } from "../lib/useShake";
import { useGameStore } from "../store/gameStore";

const ICON_EMOJI = Object.fromEntries(SIGNAL_ICONS.map((s) => [s.id, s.emoji])) as Record<SignalIconId, string>;
const FLASH_DURATION_MS = 1100;

/**
 * Seats everyone except you along the far side of the table, in seating order, so your partner
 * always lands at the top (straight across) and opponents fan out to the left and right.
 */
function seatPosition(relSeat: number, seatCount: number): { left: string; top: string } {
  const t = (relSeat / seatCount) * Math.PI; // 0 = your left, π = your right
  const x = 50 - 44 * Math.cos(t);
  const y = 33 - 23 * Math.sin(t);
  return { left: `${x}%`, top: `${y}%` };
}

/** Tilt and lift for each card in a fanned hand. */
function fanPose(i: number, count: number) {
  const mid = (count - 1) / 2;
  const off = i - mid;
  return { rotate: off * 5, y: off * off * 3 };
}

export function TableScreen() {
  const { gameState, session, swapCard, declareDone, tapSignal, callKent, callCounterKent, cardOrigins, quit, react, hits } = useGameStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aiming, setAiming] = useState<ThrowId | null>(null);
  const handShakeRef = useShake<HTMLDivElement>(session ? hits[session.playerId] : undefined, 5);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<Record<string, PlayerAvatarFlash>>({});
  const [confirmLeave, setConfirmLeave] = useState(false);
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
      for (const tap of newTaps) next[tap.playerId] = { icon: ICON_EMOJI[tap.icon], nonce: nonces.get(tap.playerId)! };
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

  useEffect(() => {
    if (!confirmLeave) return;
    const t = window.setTimeout(() => setConfirmLeave(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmLeave]);

  if (!gameState || !session) return null;

  const me = session.playerId;
  const you = gameState.players[me];
  const yourSeat = you?.seat ?? 0;
  const seatCount = gameState.seats.length;
  const youAreDone = gameState.doneStatus[me] ?? false;
  const recentTaps = gameState.signals.slice(-5).reverse();
  const canSwap = !!selectedCardId && !youAreDone;
  const yourSignal = you?.partnershipId ? (gameState.partnerships[you.partnershipId]?.signal ?? null) : null;
  const othersDone = Object.entries(gameState.doneStatus).filter(([id, d]) => d && id !== me).length;

  function handleCenterTap(slot: number) {
    if (!selectedCardId || youAreDone) return;
    const cardId = selectedCardId;
    setSelectedCardId(null);
    swapCard(cardId, slot);
  }

  const hint = youAreDone
    ? `You're done. Waiting on ${seatCount - 1 - othersDone} more…`
    : selectedCardId
      ? "Now tap a center card to swap it in."
      : "Pick a card from your hand to swap.";

  return (
    <LayoutGroup>
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center gap-2 px-3 pt-3 pb-4">
        {/* Top bar: leave, hand number, scores. The sound toggle sits fixed in the right corner. */}
        <div className="flex w-full items-center gap-2 pr-12">
          <button
            type="button"
            onClick={() => (confirmLeave ? quit() : setConfirmLeave(true))}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
              confirmLeave ? "border-danger/60 bg-danger/15 text-danger" : "border-white/10 bg-felt-900/70 text-cream-300 hover:text-cream-100"
            }`}
          >
            <svg viewBox="0 0 256 256" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" />
            </svg>
            {confirmLeave ? "Leave game?" : "Leave"}
          </button>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {Object.entries(gameState.partnerships).map(([teamId, team]) => (
              <ScoreTrack key={teamId} teamId={teamId} letters={team.letters} compact />
            ))}
          </div>
        </div>

        {/* The table. */}
        <div className="relative mt-1 h-[322px] w-full max-w-[560px] sm:h-[370px]">
          <div className="table-felt absolute inset-x-[3%] top-[17%] bottom-[2%] rounded-[50%]" />

          {gameState.seats.map((playerId, seat) => {
            if (!playerId || playerId === me) return null;
            const player = gameState.players[playerId];
            if (!player) return null;
            const rel = (seat - yourSeat + seatCount) % seatCount;
            return (
              <div key={seat} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={seatPosition(rel, seatCount)}>
                <PlayerAvatar
                  playerId={playerId}
                  name={player.name}
                  teamId={player.partnershipId ?? "team-0"}
                  isPartner={player.partnershipId === you?.partnershipId}
                  connected={player.connected}
                  done={gameState.doneStatus[playerId] ?? false}
                  flash={flashes[playerId] ?? null}
                  compact={seatCount > 6}
                  hitAt={hits[playerId]}
                  onTarget={
                    aiming
                      ? () => {
                          react({ kind: "throw", item: aiming, to: playerId });
                          setAiming(null);
                        }
                      : undefined
                  }
                />
              </div>
            );
          })}

          <div className="absolute inset-x-0 top-[44%] flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              {gameState.center.map((card, slot) => (
                <PlayingCard
                  key={card.id}
                  layoutId={card.id}
                  card={card}
                  size="md"
                  origin={cardOrigins[card.id]}
                  target={canSwap}
                  onClick={canSwap ? () => handleCenterTap(slot) : undefined}
                  label={`Center card ${slot + 1}: ${card.rank} of ${card.suit}`}
                />
              ))}
            </div>
            <div className="flex items-end gap-5">
              <StockPile count={gameState.stockCount} />
              <DiscardPile count={gameState.discardCount} />
            </div>
          </div>
        </div>

        {/* Hint + recent signals. */}
        <div className="flex h-6 items-center">
          <AnimatePresence mode="wait">
            {aiming ? (
              <motion.p
                key="aiming"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm font-semibold text-danger"
              >
                Tap someone to throw {THROW_BY_ID[aiming].emoji}
                <button type="button" onClick={() => setAiming(null)} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-cream-100">
                  Cancel
                </button>
              </motion.p>
            ) : (
              <motion.p
                key={hint}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="text-center text-sm text-cream-300"
              >
                {hint}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="flex h-7 w-full max-w-md items-center justify-center gap-1.5 overflow-hidden">
          <AnimatePresence initial={false}>
            {recentTaps.map((tap) => (
              <motion.span
                key={tap.id}
                layout
                initial={{ opacity: 0, scale: 0.6, x: -12 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="shrink-0 rounded-full border border-white/5 bg-felt-900/70 px-2 py-0.5 text-xs whitespace-nowrap text-cream-300"
              >
                {ICON_EMOJI[tap.icon]} {tap.playerId === me ? "You" : (gameState.players[tap.playerId]?.name ?? "?")}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>

        {/* Your hand. */}
        <div
          ref={handShakeRef}
          data-anchor={`player:${me}`}
          className="flex justify-center gap-1.5 pt-3"
          style={{ minHeight: 124 }}
        >
          {gameState.yourHand.map((card, i) => (
            <PlayingCard
              key={card.id}
              layoutId={card.id}
              card={card}
              size="lg"
              origin={cardOrigins[card.id]}
              pose={fanPose(i, gameState.yourHand.length)}
              selected={selectedCardId === card.id}
              onClick={youAreDone ? undefined : () => setSelectedCardId((id) => (id === card.id ? null : card.id))}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            disabled={youAreDone}
            onClick={() => declareDone()}
            whileTap={youAreDone ? undefined : { scale: 0.95 }}
            className={`flex items-center gap-2 rounded-full px-6 py-2.5 font-display font-bold transition-colors ${
              youAreDone
                ? "bg-success/15 text-success ring-1 ring-success/60"
                : "border border-white/10 bg-felt-800 text-cream-100 hover:border-gold-400/40 hover:bg-felt-700"
            } disabled:cursor-default`}
          >
            {youAreDone ? "Done for this round" : "I'm done swapping"}
          </motion.button>
          <motion.button
            type="button"
            onClick={() => setPickerOpen(true)}
            whileTap={{ scale: 0.9, rotate: -10 }}
            whileHover={{ rotate: 8 }}
            aria-label="React: send a sticker or throw something"
            className="flex h-11 items-center gap-1.5 rounded-full border border-white/10 bg-felt-800 px-3.5 text-sm font-semibold text-cream-100 hover:border-gold-400/40"
          >
            <span className="text-lg leading-none">😜</span>
            React
          </motion.button>
        </div>

        <SignalButtons onTap={(icon) => tapSignal(icon)} ownIcon={yourSignal} />

        <div className="mt-1 flex w-full max-w-sm gap-3">
          <CallButton label="KENT!" tone="kent" onClick={() => callKent()} />
          <CallButton label="COUNTER KENT!" tone="counter" onClick={() => callCounterKent()} />
        </div>
      </div>
      <EmotePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSay={(item) => {
          setPickerOpen(false);
          react({ kind: "say", item });
        }}
        onAim={(item) => {
          setPickerOpen(false);
          setAiming(item);
        }}
      />
    </LayoutGroup>
  );
}

function CallButton({ label, tone, onClick }: { label: string; tone: "kent" | "counter"; onClick: () => void }) {
  const kent = tone === "kent";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.93, y: 2 }}
      transition={{ type: "spring", stiffness: 600, damping: 20 }}
      className={`flex-1 rounded-2xl py-3 font-display text-base font-extrabold tracking-wide text-felt-950 ${
        kent ? "bg-gradient-to-b from-[#7ef0a6] to-success" : "bg-gradient-to-b from-[#ff8a90] to-danger"
      }`}
      style={{
        boxShadow: kent
          ? "inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 0 #23964d, 0 10px 24px -8px rgba(74,222,128,0.6)"
          : "inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 0 #a92a33, 0 10px 24px -8px rgba(242,85,95,0.6)",
      }}
    >
      {label}
    </motion.button>
  );
}
