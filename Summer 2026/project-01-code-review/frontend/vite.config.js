import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API and socket requests to the backend during local dev
    // This avoids CORS issues when running both servers locally
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true, // WebSocket proxying — needed for Socket.io
      },
    },
  },
});
