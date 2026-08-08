import type { ClientToServerEvents, ServerToClientEvents } from "@kent/engine";
import { io, type Socket } from "socket.io-client";

// Unset in production builds: the client is served by the same origin as the
// game server, so socket.io-client's no-argument default (connect to the page's
// own origin) is exactly right. Local dev sets this via .env.development since
// Vite (client) and the server run as two separate processes/ports there.
const SERVER_URL = import.meta.env.VITE_SERVER_URL;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
});
