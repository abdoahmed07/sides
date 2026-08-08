import type { EngineErrorCode } from "./errors.js";
import type { RedactedGameState } from "./redact.js";
import type { GameAction } from "./types.js";

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/**
 * What the client sends over the wire — every `GameAction` minus `playerId`.
 * The server always injects `playerId` itself from the authenticated socket
 * session; a client can never claim to act as another player.
 */
export type ClientGameAction = DistributiveOmit<GameAction, "playerId">;

export type AckResponse<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: { code: EngineErrorCode | "UNKNOWN"; message: string } };

export interface ClientToServerEvents {
  "room:create": (
    payload: { hostName: string; seatCount: number },
    ack: (res: AckResponse<{ playerId: string; token: string; roomCode: string }>) => void,
  ) => void;
  "room:join": (
    payload: { roomCode: string; name: string },
    ack: (res: AckResponse<{ playerId: string; token: string; roomCode: string }>) => void,
  ) => void;
  "room:rejoin": (
    payload: { roomCode: string; token: string },
    ack: (res: AckResponse<{ playerId: string }>) => void,
  ) => void;
  "game:action": (action: ClientGameAction, ack: (res: AckResponse) => void) => void;
}

export interface ServerToClientEvents {
  "state:update": (state: RedactedGameState) => void;
}

export type InterServerEvents = Record<string, never>;

export interface SocketSessionData {
  roomCode?: string;
  playerId?: string;
}
