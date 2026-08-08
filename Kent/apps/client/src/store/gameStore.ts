import type { AckResponse, ClientGameAction, EngineErrorCode, RedactedGameState, SignalIconId } from "@kent/engine";
import { create } from "zustand";
import { socket } from "../lib/socket";

const SESSION_KEY = "kent:session";

interface StoredSession {
  roomCode: string;
  playerId: string;
  token: string;
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession | null): void {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export type ConnectionStatus = "connecting" | "connected" | "offline";
export type ActionError = { code: EngineErrorCode | "UNKNOWN"; message: string };

type RoomAck = AckResponse<{ playerId: string; token: string; roomCode: string }>;

interface GameStoreState {
  status: ConnectionStatus;
  session: StoredSession | null;
  gameState: RedactedGameState | null;
  lastError: ActionError | null;
  busy: boolean;

  createRoom: (hostName: string, seatCount: number) => Promise<void>;
  joinRoom: (roomCode: string, name: string) => Promise<void>;
  leaveRoom: () => void;
  clearError: () => void;

  dispatch: (action: ClientGameAction) => Promise<AckResponse>;
  joinSeat: (seat: number) => Promise<AckResponse>;
  leaveSeat: () => Promise<AckResponse>;
  setReady: (ready: boolean) => Promise<AckResponse>;
  startMatch: () => Promise<AckResponse>;
  setTeamSignal: (icon: SignalIconId) => Promise<AckResponse>;
  drawCard: (packetId: string) => Promise<AckResponse>;
  discardCard: (cardId: string) => Promise<AckResponse>;
  tapSignal: (icon: SignalIconId) => Promise<AckResponse>;
  callKent: () => Promise<AckResponse>;
  callCounterKent: () => Promise<AckResponse>;
}

function applyRoomResult(res: RoomAck): StoredSession | undefined {
  if (!res.ok) return undefined;
  return { roomCode: res.roomCode, playerId: res.playerId, token: res.token };
}

export const useGameStore = create<GameStoreState>((set, get) => {
  socket.on("connect", () => {
    set({ status: "connected" });
    const session = get().session;
    if (session) {
      socket.emit("room:rejoin", { roomCode: session.roomCode, token: session.token }, (res) => {
        if (!res.ok) {
          saveSession(null);
          set({ session: null });
        }
      });
    }
  });
  socket.on("disconnect", () => set({ status: "offline" }));
  socket.on("state:update", (state) => set({ gameState: state }));

  async function dispatch(action: ClientGameAction): Promise<AckResponse> {
    set({ lastError: null });
    const res = await new Promise<AckResponse>((resolve) => socket.emit("game:action", action, resolve));
    if (!res.ok) set({ lastError: res.error });
    return res;
  }

  return {
    status: socket.connected ? "connected" : "connecting",
    session: loadSession(),
    gameState: null,
    lastError: null,
    busy: false,

    async createRoom(hostName, seatCount) {
      set({ busy: true, lastError: null });
      const res = await new Promise<RoomAck>((resolve) => socket.emit("room:create", { hostName, seatCount }, resolve));
      set({ busy: false });
      const session = applyRoomResult(res);
      if (session) {
        saveSession(session);
        set({ session });
      } else if (!res.ok) {
        set({ lastError: res.error });
      }
    },

    async joinRoom(roomCode, name) {
      set({ busy: true, lastError: null });
      const res = await new Promise<RoomAck>((resolve) => socket.emit("room:join", { roomCode, name }, resolve));
      set({ busy: false });
      const session = applyRoomResult(res);
      if (session) {
        saveSession(session);
        set({ session });
      } else if (!res.ok) {
        set({ lastError: res.error });
      }
    },

    leaveRoom() {
      saveSession(null);
      set({ session: null, gameState: null });
    },

    clearError() {
      set({ lastError: null });
    },

    dispatch,
    joinSeat: (seat) => dispatch({ type: "JOIN_SEAT", seat }),
    leaveSeat: () => dispatch({ type: "LEAVE_SEAT" }),
    setReady: (ready) => dispatch({ type: "SET_READY", ready }),
    startMatch: () => dispatch({ type: "START_MATCH" }),
    setTeamSignal: (icon) => dispatch({ type: "SET_TEAM_SIGNAL", icon }),
    drawCard: (packetId) => dispatch({ type: "DRAW_CARD", packetId }),
    discardCard: (cardId) => dispatch({ type: "DISCARD_CARD", cardId }),
    tapSignal: (icon) => dispatch({ type: "TAP_SIGNAL", icon }),
    callKent: () => dispatch({ type: "CALL_KENT" }),
    callCounterKent: () => dispatch({ type: "CALL_COUNTER_KENT" }),
  };
});
