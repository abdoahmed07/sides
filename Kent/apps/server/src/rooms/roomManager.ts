import {
  EngineError,
  addPlayer,
  applyAction,
  createGameState,
  isValidPlayerCount,
  setConnected,
  type GameAction,
  type PlayerCount,
} from "@kent/engine";
import { randomUUID } from "node:crypto";
import { Room } from "./room.js";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L — avoids ambiguous chars when read aloud or typed

function generateRoomCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(hostName: string, seatCount: number, now: number): { room: Room; playerId: string; token: string } {
    if (!isValidPlayerCount(seatCount)) {
      throw new EngineError("INVALID_PLAYER_COUNT", "Table size must be 4, 6, or 8 players");
    }
    let roomCode = generateRoomCode();
    while (this.rooms.has(roomCode)) roomCode = generateRoomCode();

    const hostPlayerId = randomUUID();
    const state = createGameState({
      roomCode,
      hostPlayerId,
      hostName,
      seatCount: seatCount as PlayerCount,
      now,
    });
    const room = new Room(state);
    const session = room.registerSession(hostPlayerId, null);
    this.rooms.set(roomCode, room);
    return { room, playerId: hostPlayerId, token: session.token };
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.trim().toUpperCase());
  }

  joinRoom(roomCode: string, name: string): { room: Room; playerId: string; token: string } {
    const room = this.getRoom(roomCode);
    if (!room) throw new EngineError("ROOM_NOT_FOUND", `No room found for code ${roomCode}`);

    const playerId = randomUUID();
    room.state = addPlayer(room.state, playerId, name);
    const session = room.registerSession(playerId, null);
    return { room, playerId, token: session.token };
  }

  rejoin(roomCode: string, token: string): { room: Room; playerId: string } {
    const room = this.getRoom(roomCode);
    if (!room) throw new EngineError("ROOM_NOT_FOUND", `No room found for code ${roomCode}`);
    const playerId = room.playerIdForToken(token);
    if (!playerId || !room.state.players[playerId]) {
      throw new EngineError("UNKNOWN_PLAYER", "That reconnect token is not recognized");
    }
    return { room, playerId };
  }

  bindSocket(room: Room, playerId: string, socketId: string): void {
    room.bindSocket(playerId, socketId);
    room.state = setConnected(room.state, playerId, true);
  }

  markDisconnected(room: Room, playerId: string): void {
    room.clearSocket(playerId);
    room.state = setConnected(room.state, playerId, false);
  }

  dispatch(room: Room, action: GameAction, now: number): void {
    room.state = applyAction(room.state, action, now);
  }
}
