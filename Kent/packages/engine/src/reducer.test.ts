import { describe, expect, it } from "vitest";
import { EngineError } from "./errors.js";
import { addPlayer, applyAction, createGameState, setConnected } from "./reducer.js";
import type { GameState } from "./types.js";

function fourPlayerLobby(): { state: GameState; ids: string[] } {
  const ids = ["p0", "p1", "p2", "p3"];
  let state = createGameState({ roomCode: "ABCD", hostPlayerId: "p0", hostName: "Host", seatCount: 4, now: 0 });
  for (const id of ids.slice(1)) {
    state = addPlayer(state, id, id);
  }
  ids.forEach((id, seat) => {
    state = applyAction(state, { type: "JOIN_SEAT", playerId: id, seat }, 0);
  });
  return { state, ids };
}

describe("room + seating lifecycle", () => {
  it("creates a room with the host already present, unseated", () => {
    const state = createGameState({ roomCode: "ABCD", hostPlayerId: "p0", hostName: "Host", seatCount: 4, now: 0 });
    expect(state.phase).toBe("lobby");
    expect(state.players.p0).toMatchObject({ name: "Host", seat: null });
    expect(state.seats).toEqual([null, null, null, null]);
  });

  it("rejects joining a full room", () => {
    let state = createGameState({ roomCode: "ABCD", hostPlayerId: "p0", hostName: "Host", seatCount: 4, now: 0 });
    for (const id of ["p1", "p2", "p3"]) state = addPlayer(state, id, id);
    expect(() => addPlayer(state, "p4", "Extra")).toThrow(EngineError);
  });

  it("assigns partnerships automatically from opposite seats as players sit down", () => {
    const { state } = fourPlayerLobby();
    expect(state.players.p0!.partnershipId).toBe("team-0");
    expect(state.players.p2!.partnershipId).toBe("team-0");
    expect(state.players.p1!.partnershipId).toBe("team-1");
    expect(state.players.p3!.partnershipId).toBe("team-1");
  });

  it("rejects taking an already-occupied seat", () => {
    const { state } = fourPlayerLobby();
    expect(() => applyAction(state, { type: "JOIN_SEAT", playerId: "p0", seat: 1 })).toThrow(/already taken/);
  });

  it("lets a player move to a different open seat", () => {
    let state = createGameState({ roomCode: "ABCD", hostPlayerId: "p0", hostName: "Host", seatCount: 4, now: 0 });
    state = applyAction(state, { type: "JOIN_SEAT", playerId: "p0", seat: 0 });
    state = applyAction(state, { type: "JOIN_SEAT", playerId: "p0", seat: 1 });
    expect(state.seats).toEqual([null, "p0", null, null]);
  });
});

describe("starting a match", () => {
  it("rejects starting unless the host does it, all seats are full, and everyone is ready", () => {
    const { state, ids } = fourPlayerLobby();
    expect(() => applyAction(state, { type: "START_MATCH", playerId: "p1" })).toThrow(/host/);
    expect(() => applyAction(state, { type: "START_MATCH", playerId: "p0" })).toThrow(/ready/);

    let readyState = state;
    for (const id of ids.slice(0, 3)) {
      readyState = applyAction(readyState, { type: "SET_READY", playerId: id, ready: true });
    }
    expect(() => applyAction(readyState, { type: "START_MATCH", playerId: "p0" })).toThrow(/ready/);
  });

  it("moves to between_hands once started, with signals unset", () => {
    const { state, ids } = fourPlayerLobby();
    let readyState = state;
    for (const id of ids) {
      readyState = applyAction(readyState, { type: "SET_READY", playerId: id, ready: true });
    }
    const started = applyAction(readyState, { type: "START_MATCH", playerId: "p0" });
    expect(started.phase).toBe("between_hands");
    for (const p of Object.values(started.partnerships)) expect(p.signal).toBeNull();
    for (const p of Object.values(started.players)) expect(p.ready).toBe(false);
  });
});

describe("between_hands -> playing", () => {
  function startedMatch(): GameState {
    const { state, ids } = fourPlayerLobby();
    let readyState = state;
    for (const id of ids) readyState = applyAction(readyState, { type: "SET_READY", playerId: id, ready: true });
    return applyAction(readyState, { type: "START_MATCH", playerId: "p0" });
  }

  it("rejects setting a signal outside between_hands", () => {
    const state = fourPlayerLobby().state;
    expect(() => applyAction(state, { type: "SET_TEAM_SIGNAL", playerId: "p0", icon: "palm" })).toThrow(EngineError);
  });

  it("auto-deals hand 1 once every team has a signal and every seat is ready", () => {
    let state = startedMatch();
    state = applyAction(state, { type: "SET_TEAM_SIGNAL", playerId: "p0", icon: "palm" });
    state = applyAction(state, { type: "SET_TEAM_SIGNAL", playerId: "p1", icon: "ok" });
    // Not dealt yet: nobody has readied up post-signal-selection.
    expect(state.phase).toBe("between_hands");

    for (const id of ["p0", "p1", "p2", "p3"]) {
      state = applyAction(state, { type: "SET_READY", playerId: id, ready: true });
    }

    expect(state.phase).toBe("playing");
    expect(state.handNumber).toBe(1);
    for (const id of ["p0", "p1", "p2", "p3"]) expect(state.hands[id]).toHaveLength(4);
    expect(state.center).toHaveLength(4);
    expect(state.stock).toHaveLength(52 - 16 - 4);
    expect(state.doneStatus).toEqual({});
  });

  it("does not deal while any team's signal is still unset even if everyone is ready", () => {
    let state = startedMatch();
    state = applyAction(state, { type: "SET_TEAM_SIGNAL", playerId: "p0", icon: "palm" });
    for (const id of ["p0", "p1", "p2", "p3"]) {
      state = applyAction(state, { type: "SET_READY", playerId: id, ready: true });
    }
    expect(state.phase).toBe("between_hands");
  });
});

describe("reconnection", () => {
  it("marks a player disconnected without freeing their seat, and reconnecting restores connected status", () => {
    const { state } = fourPlayerLobby();
    const disconnected = setConnected(state, "p1", false);
    expect(disconnected.players.p1!.connected).toBe(false);
    expect(disconnected.seats[1]).toBe("p1");

    const reconnected = setConnected(disconnected, "p1", true);
    expect(reconnected.players.p1!.connected).toBe(true);
    expect(reconnected.seats[1]).toBe("p1");
  });
});
