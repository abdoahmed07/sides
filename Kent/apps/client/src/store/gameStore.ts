import {
  type BotDifficulty,
  EngineError,
  HUMAN_ID,
  applyAction,
  chooseBotAction,
  createSoloMatch,
  isBotId,
  redactStateFor,
  type EngineErrorCode,
  type GameAction,
  type GameState,
  type PlayerCount,
  type RedactedGameState,
  type SignalIconId,
} from "@kent/engine";
import { create } from "zustand";
import { playSoundsFor } from "../lib/gameSounds";
import { cardOriginsFor, type CardOrigins } from "../lib/cardOrigins";
import { banterForHandEnd, idleBanter, replyTo, retaliate, type PlannedReaction } from "../lib/banter";
import { FLIGHT_MS, type Reaction, type ReactionInput } from "../lib/reactions";
import { sounds } from "../lib/sound";

/** How often bots get a chance to act. Each bot acts at most once per tick, and only some of the time. */
const BOT_TICK_MS = 700;

export type ActionError = { code: EngineErrorCode | "UNKNOWN"; message: string };
type HumanAction = GameAction extends infer A ? (A extends { playerId: string } ? Omit<A, "playerId"> : never) : never;

interface GameStoreState {
  /** Full game state — lives only in this browser. Screens read the redacted `gameState` view instead. */
  fullState: GameState | null;
  gameState: RedactedGameState | null;
  session: { playerId: string } | null;
  lastError: ActionError | null;
  /** Where newly visible cards should fly in from (the stock, or the bot who just put them down). */
  cardOrigins: CardOrigins;
  /** Stickers and thrown items currently on screen. */
  reactions: Reaction[];
  /** When each player was last hit by something thrown (drives the wobble). */
  hits: Record<string, number>;
  react: (reaction: ReactionInput) => void;

  difficulty: BotDifficulty;
  startGame: (name: string, seatCount: PlayerCount, difficulty: BotDifficulty) => void;
  quit: () => void;
  clearError: () => void;

  setReady: (ready: boolean) => void;
  setTeamSignal: (icon: SignalIconId) => void;
  swapCard: (handCardId: string, centerSlot: number) => void;
  declareDone: () => void;
  tapSignal: (icon: SignalIconId) => void;
  callKent: () => void;
  callCounterKent: () => void;
}

function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export const useGameStore = create<GameStoreState>((set, get) => {
  let botTimer: number | null = null;
  let reactionId = 0;
  let lastBotReactionAt = 0;
  let lastHumanReactionAt = 0;
  const pending = new Set<number>();

  function later(fn: () => void, ms: number) {
    const t = window.setTimeout(() => {
      pending.delete(t);
      fn();
    }, ms);
    pending.add(t);
  }

  function emit(from: string, input: ReactionInput) {
    const reaction: Reaction = { ...input, id: ++reactionId, from, atMs: Date.now() };
    set({ reactions: [...get().reactions.slice(-11), reaction] });
    later(() => set({ reactions: get().reactions.filter((r) => r.id !== reaction.id) }), 3200);
    if (reaction.kind === "say") {
      sounds.sticker();
      return;
    }
    sounds.whoosh();
    const { to, item } = reaction;
    later(() => {
      sounds.impact(item);
      set({ hits: { ...get().hits, [to]: Date.now() } });
    }, FLIGHT_MS);
  }

  function schedule(plan: PlannedReaction | null) {
    if (!plan) return;
    later(() => {
      if (!get().fullState) return;
      lastBotReactionAt = Date.now();
      emit(plan.from, plan.reaction);
    }, plan.delayMs);
  }

  function commit(next: GameState) {
    const prev = get().fullState;
    playSoundsFor(prev, next, HUMAN_ID);
    if (prev) banterForHandEnd(prev, next).forEach(schedule);
    set({
      fullState: next,
      gameState: redactStateFor(next, HUMAN_ID),
      cardOrigins: cardOriginsFor(prev, next, HUMAN_ID, get().cardOrigins),
    });
  }

  function botTick() {
    const start = get().fullState;
    if (!start || start.phase === "match_over") return;
    const now = Date.now();
    let state: GameState = start;
    for (const id of shuffled(Object.keys(state.players).filter(isBotId))) {
      const action = chooseBotAction(state, id, isBotId, now, Math.random, get().difficulty);
      if (!action) continue;
      const phaseBefore: GameState["phase"] = state.phase;
      try {
        state = applyAction(state, action, now);
      } catch {
        // A bot's move can go stale between deciding and applying (e.g. the round turned over) — just skip it.
        continue;
      }
      if (state.phase !== phaseBefore) break; // a hand just ended or dealt — let the table settle first
    }
    if (state !== start) commit(state);
    if (now - lastBotReactionAt > 8000) schedule(idleBanter(get().fullState ?? state, HUMAN_ID));
  }

  function act(action: HumanAction) {
    const state = get().fullState;
    if (!state) return;
    try {
      commit(applyAction(state, { ...action, playerId: HUMAN_ID } as GameAction, Date.now()));
      set({ lastError: null });
    } catch (err) {
      set({
        lastError:
          err instanceof EngineError ? { code: err.code, message: err.message } : { code: "UNKNOWN", message: "Something went wrong" },
      });
    }
  }

  return {
    fullState: null,
    gameState: null,
    session: null,
    lastError: null,
    cardOrigins: {},
    reactions: [],
    hits: {},

    react(reaction) {
      const state = get().fullState;
      const now = Date.now();
      if (!state || now - lastHumanReactionAt < 500) return;
      lastHumanReactionAt = now;
      emit(HUMAN_ID, reaction);
      if (reaction.kind === "throw" && isBotId(reaction.to)) schedule(retaliate(reaction.to, reaction.item, HUMAN_ID));
      else if (reaction.kind === "say") schedule(replyTo(reaction.item, state));
    },

    difficulty: "medium",

    startGame(name, seatCount, difficulty) {
      commit(createSoloMatch(name.trim() || "Player", seatCount));
      set({ session: { playerId: HUMAN_ID }, lastError: null, difficulty });
      if (botTimer === null) botTimer = window.setInterval(botTick, BOT_TICK_MS);
    },

    quit() {
      if (botTimer !== null) window.clearInterval(botTimer);
      botTimer = null;
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
      set({ fullState: null, gameState: null, session: null, lastError: null, cardOrigins: {}, reactions: [], hits: {} });
    },

    clearError: () => set({ lastError: null }),

    setReady: (ready) => act({ type: "SET_READY", ready }),
    setTeamSignal: (icon) => act({ type: "SET_TEAM_SIGNAL", icon }),
    swapCard: (handCardId, centerSlot) => act({ type: "SWAP_CARD", handCardId, centerSlot }),
    declareDone: () => act({ type: "DECLARE_DONE" }),
    tapSignal: (icon) => act({ type: "TAP_SIGNAL", icon }),
    callKent: () => act({ type: "CALL_KENT" }),
    callCounterKent: () => act({ type: "CALL_COUNTER_KENT" }),
  };
});
