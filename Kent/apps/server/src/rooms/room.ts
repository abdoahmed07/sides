import { randomUUID } from "node:crypto";
import type { GameState } from "@kent/engine";

export interface PlayerSession {
  playerId: string;
  token: string;
  socketId: string | null;
}

/** One live room: the authoritative GameState plus per-player connection bookkeeping. */
export class Room {
  state: GameState;
  private sessionsByPlayer = new Map<string, PlayerSession>();
  private playerByToken = new Map<string, string>();

  constructor(state: GameState) {
    this.state = state;
  }

  registerSession(playerId: string, socketId: string | null): PlayerSession {
    const token = randomUUID();
    const session: PlayerSession = { playerId, token, socketId };
    this.sessionsByPlayer.set(playerId, session);
    this.playerByToken.set(token, playerId);
    return session;
  }

  playerIdForToken(token: string): string | undefined {
    return this.playerByToken.get(token);
  }

  bindSocket(playerId: string, socketId: string): void {
    const session = this.sessionsByPlayer.get(playerId);
    if (session) session.socketId = socketId;
  }

  clearSocket(playerId: string): void {
    const session = this.sessionsByPlayer.get(playerId);
    if (session) session.socketId = null;
  }

  sessions(): PlayerSession[] {
    return [...this.sessionsByPlayer.values()];
  }

  isEmpty(): boolean {
    return this.sessionsByPlayer.size === 0;
  }
}
