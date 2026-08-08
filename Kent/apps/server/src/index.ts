import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketSessionData,
} from "@kent/engine";
import express from "express";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { RoomManager } from "./rooms/roomManager.js";
import { registerSocketHandlers } from "./socket/handlers.js";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173").split(",").map((s) => s.trim());

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// In production this is a single deployed service: this server also serves the
// built client, so the browser and the WebSocket connection share one origin
// and there's nothing separate to host or point DNS at. In local dev the
// client build doesn't exist (Vite's own dev server handles the client
// instead), so this is skipped entirely.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/socket.io")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketSessionData>(httpServer, {
  cors: { origin: CLIENT_ORIGINS },
});

const roomManager = new RoomManager();
registerSocketHandlers(io, roomManager);

httpServer.listen(PORT, () => {
  console.log(`Kent server listening on :${PORT}`);
});
