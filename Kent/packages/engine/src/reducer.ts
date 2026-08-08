import { EngineError } from "./errors.js";
import { dealNewHand } from "./rules/dealing.js";
import { callCounterKent, callKent, tapSignal } from "./rules/kent.js";
import { declareDone, swapCard } from "./rules/swapping.js";
import { buildPartnerships } from "./seating.js";
import type { GameAction, GameState, PlayerCount, SignalIconId } from "./types.js";

export function createGameState(params: {
  roomCode: string;
  hostPlayerId: string;
  hostName: string;
  seatCount: PlayerCount;
  now: number;
}): GameState {
  return {
    roomCode: params.roomCode,
    phase: "lobby",
    seatCount: params.seatCount,
    hostPlayerId: params.hostPlayerId,
    seats: new Array(params.seatCount).fill(null),
    players: {
      [params.hostPlayerId]: {
        id: params.hostPlayerId,
        name: params.hostName,
        seat: null,
        partnershipId: null,
        connected: true,
        ready: false,
      },
    },
    partnerships: {},
    dealerSeat: 0,
    handNumber: 0,
    hands: {},
    stock: [],
    center: [],
    discardPile: [],
    doneStatus: {},
    signals: [],
    lastHandResult: null,
    matchLoserPartnershipId: null,
    createdAtMs: params.now,
  };
}

export function addPlayer(state: GameState, playerId: string, name: string): GameState {
  if (state.phase !== "lobby") {
    throw new EngineError("WRONG_PHASE", "Cannot join a room after the match has started");
  }
  if (state.players[playerId]) return state;
  if (state.seatCount && Object.keys(state.players).length >= state.seatCount) {
    throw new EngineError("ROOM_FULL", "This room is already full");
  }
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { id: playerId, name, seat: null, partnershipId: null, connected: true, ready: false },
    },
  };
}

export function setConnected(state: GameState, playerId: string, connected: boolean): GameState {
  const player = state.players[playerId];
  if (!player) return state;
  return { ...state, players: { ...state.players, [playerId]: { ...player, connected } } };
}

function syncPartnerships(state: GameState): GameState {
  if (!state.seatCount) return state;
  const half = state.seatCount / 2;
  const partnerships = { ...state.partnerships };
  for (let i = 0; i < half; i++) {
    const id = `team-${i}`;
    partnerships[id] = partnerships[id] ?? { id, seats: [i, i + half], letters: "", signal: null };
  }

  const players = { ...state.players };
  for (const p of Object.values(players)) {
    players[p.id] = { ...p, seat: null, partnershipId: null };
  }
  state.seats.forEach((playerId, seat) => {
    if (!playerId) return;
    const player = players[playerId];
    if (!player) return;
    players[playerId] = { ...player, seat, partnershipId: `team-${seat % half}` };
  });

  return { ...state, partnerships, players };
}

function joinSeat(state: GameState, playerId: string, seat: number): GameState {
  if (state.phase !== "lobby") throw new EngineError("WRONG_PHASE", "Seats can only change in the lobby");
  if (!state.players[playerId]) throw new EngineError("UNKNOWN_PLAYER", `Unknown player ${playerId}`);
  if (!state.seatCount || seat < 0 || seat >= state.seatCount) {
    throw new EngineError("SEAT_NOT_FOUND", `Seat ${seat} does not exist`);
  }
  const occupant = state.seats[seat];
  if (occupant && occupant !== playerId) {
    throw new EngineError("SEAT_TAKEN", `Seat ${seat} is already taken`);
  }
  const seats = state.seats.map((pid, i) => {
    if (i === seat) return playerId;
    return pid === playerId ? null : pid;
  });
  return syncPartnerships({ ...state, seats });
}

function leaveSeat(state: GameState, playerId: string): GameState {
  if (state.phase !== "lobby") throw new EngineError("WRONG_PHASE", "Seats can only change in the lobby");
  const seats = state.seats.map((pid) => (pid === playerId ? null : pid));
  return syncPartnerships({ ...state, seats });
}

function setReady(state: GameState, playerId: string, ready: boolean): GameState {
  const player = state.players[playerId];
  if (!player) throw new EngineError("UNKNOWN_PLAYER", `Unknown player ${playerId}`);
  if (state.phase !== "lobby" && state.phase !== "between_hands") {
    throw new EngineError("WRONG_PHASE", "This is not a ready-up phase");
  }
  const next = { ...state, players: { ...state.players, [playerId]: { ...player, ready } } };
  return maybeDealNextHand(next);
}

function startMatch(state: GameState, playerId: string): GameState {
  if (state.phase !== "lobby") throw new EngineError("WRONG_PHASE", "Match already started");
  if (playerId !== state.hostPlayerId) throw new EngineError("NOT_HOST", "Only the host can start the match");
  if (!state.seatCount) throw new EngineError("INVALID_PLAYER_COUNT", "No table size set for this room");
  const seatedCount = state.seats.filter((s) => s !== null).length;
  if (seatedCount !== state.seatCount) {
    throw new EngineError("NOT_ENOUGH_PLAYERS", `All ${state.seatCount} seats must be filled to start`);
  }
  const notReady = state.seats.some((pid) => pid && !state.players[pid]?.ready);
  if (notReady) throw new EngineError("NOT_ALL_READY", "All players must be ready to start");

  const partnerships = buildPartnerships(state.seats);
  const players = { ...state.players };
  for (const p of Object.values(players)) {
    players[p.id] = { ...p, ready: false };
  }
  return {
    ...state,
    phase: "between_hands",
    partnerships,
    players,
    dealerSeat: 0,
    handNumber: 0,
    lastHandResult: null,
  };
}

function setTeamSignal(state: GameState, playerId: string, icon: SignalIconId): GameState {
  if (state.phase !== "between_hands") {
    throw new EngineError("SIGNAL_LOCKED_DURING_HAND", "The team signal can only change between hands");
  }
  const player = state.players[playerId];
  const partnership = player?.partnershipId ? state.partnerships[player.partnershipId] : undefined;
  if (!player?.partnershipId || !partnership) {
    throw new EngineError("PLAYER_NOT_SEATED", "Player has no partnership");
  }
  const next = {
    ...state,
    partnerships: { ...state.partnerships, [partnership.id]: { ...partnership, signal: icon } },
  };
  return maybeDealNextHand(next);
}

/**
 * Once every partnership has chosen a signal and every seated player is
 * ready, the next hand deals automatically — no extra "start hand" click
 * needed each round. Runs after SET_READY; signal selection alone can't
 * complete the gate since readiness is reset at the start of every
 * between_hands phase.
 */
function maybeDealNextHand(state: GameState): GameState {
  if (state.phase !== "between_hands") return state;
  const allSignaled = Object.values(state.partnerships).every((p) => p.signal !== null);
  const allReady = state.seats.every((pid) => pid && state.players[pid]?.ready);
  if (!allSignaled || !allReady) return state;

  const seatCount = state.seats.length;
  const dealOrder: string[] = [];
  for (let i = 0; i < seatCount; i++) {
    const seat = (state.dealerSeat + 1 + i) % seatCount;
    const pid = state.seats[seat];
    if (pid) dealOrder.push(pid);
  }
  const { hands, center, stock } = dealNewHand(dealOrder);

  return {
    ...state,
    phase: "playing",
    handNumber: state.handNumber + 1,
    hands,
    center,
    stock,
    discardPile: [],
    doneStatus: {},
    signals: [],
    lastHandResult: null,
  };
}

export function applyAction(state: GameState, action: GameAction, now: number = Date.now()): GameState {
  switch (action.type) {
    case "JOIN_SEAT":
      return joinSeat(state, action.playerId, action.seat);
    case "LEAVE_SEAT":
      return leaveSeat(state, action.playerId);
    case "SET_READY":
      return setReady(state, action.playerId, action.ready);
    case "START_MATCH":
      return startMatch(state, action.playerId);
    case "SET_TEAM_SIGNAL":
      return setTeamSignal(state, action.playerId, action.icon);
    case "SWAP_CARD":
      return swapCard(state, action.playerId, action.handCardId, action.centerSlot);
    case "DECLARE_DONE":
      return declareDone(state, action.playerId, now);
    case "TAP_SIGNAL":
      return tapSignal(state, action.playerId, action.icon, now);
    case "CALL_KENT":
      return callKent(state, action.playerId, now);
    case "CALL_COUNTER_KENT":
      return callCounterKent(state, action.playerId, now);
    default: {
      const exhaustive: never = action;
      throw new EngineError("WRONG_PHASE", `Unhandled action: ${JSON.stringify(exhaustive)}`);
    }
  }
}
