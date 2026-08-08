import {
  EngineError,
  redactStateFor,
  type ClientGameAction,
  type ClientToServerEvents,
  type EngineErrorCode,
  type GameAction,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketSessionData,
} from "@kent/engine";
import type { Server, Socket } from "socket.io";
import type { Room } from "../rooms/room.js";
import type { RoomManager } from "../rooms/roomManager.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketSessionData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketSessionData>;

function toAckError(err: unknown): { code: EngineErrorCode | "UNKNOWN"; message: string } {
  if (err instanceof EngineError) return { code: err.code, message: err.message };
  console.error("Unexpected error handling socket event:", err);
  return { code: "UNKNOWN", message: "Something went wrong" };
}

function broadcastState(io: AppServer, room: Room): void {
  for (const session of room.sessions()) {
    if (!session.socketId) continue;
    const view = redactStateFor(room.state, session.playerId);
    io.to(session.socketId).emit("state:update", view);
  }
}

function enterRoom(socket: AppSocket, roomCode: string, playerId: string): void {
  socket.data.roomCode = roomCode;
  socket.data.playerId = playerId;
  void socket.join(roomCode);
}

export function registerSocketHandlers(io: AppServer, roomManager: RoomManager): void {
  io.on("connection", (socket: AppSocket) => {
    socket.on("room:create", (payload, ack) => {
      try {
        const { room, playerId, token } = roomManager.createRoom(
          (payload.hostName ?? "").trim() || "Host",
          payload.seatCount,
          Date.now(),
        );
        roomManager.bindSocket(room, playerId, socket.id);
        enterRoom(socket, room.state.roomCode, playerId);
        broadcastState(io, room);
        ack({ ok: true, playerId, token, roomCode: room.state.roomCode });
      } catch (err) {
        ack({ ok: false, error: toAckError(err) });
      }
    });

    socket.on("room:join", (payload, ack) => {
      try {
        const { room, playerId, token } = roomManager.joinRoom(payload.roomCode, (payload.name ?? "").trim() || "Player");
        roomManager.bindSocket(room, playerId, socket.id);
        enterRoom(socket, room.state.roomCode, playerId);
        broadcastState(io, room);
        ack({ ok: true, playerId, token, roomCode: room.state.roomCode });
      } catch (err) {
        ack({ ok: false, error: toAckError(err) });
      }
    });

    socket.on("room:rejoin", (payload, ack) => {
      try {
        const { room, playerId } = roomManager.rejoin(payload.roomCode, payload.token);
        roomManager.bindSocket(room, playerId, socket.id);
        enterRoom(socket, room.state.roomCode, playerId);
        broadcastState(io, room);
        ack({ ok: true, playerId });
      } catch (err) {
        ack({ ok: false, error: toAckError(err) });
      }
    });

    socket.on("game:action", (action: ClientGameAction, ack) => {
      const { roomCode, playerId } = socket.data;
      if (!roomCode || !playerId) {
        ack({ ok: false, error: { code: "UNKNOWN_PLAYER", message: "You are not in a room" } });
        return;
      }
      const room = roomManager.getRoom(roomCode);
      if (!room) {
        ack({ ok: false, error: { code: "ROOM_NOT_FOUND", message: "This room no longer exists" } });
        return;
      }
      try {
        // The server injects playerId from the authenticated socket session —
        // the wire payload never carries one, so a client cannot act as anyone else.
        const fullAction = { ...action, playerId } as GameAction;
        roomManager.dispatch(room, fullAction, Date.now());
        broadcastState(io, room);
        ack({ ok: true });
      } catch (err) {
        ack({ ok: false, error: toAckError(err) });
      }
    });

    socket.on("disconnect", () => {
      const { roomCode, playerId } = socket.data;
      if (!roomCode || !playerId) return;
      const room = roomManager.getRoom(roomCode);
      if (!room) return;
      roomManager.markDisconnected(room, playerId);
      broadcastState(io, room);
    });
  });
}
