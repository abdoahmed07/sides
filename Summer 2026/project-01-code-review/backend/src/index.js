// Entry point — I wire up Express, Socket.io, and start the server here
// Everything comes together in this file, so I keep it clean and delegate
// actual route/socket logic to separate modules

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const snippetRoutes = require("./routes/snippets");
const commentRoutes = require("./routes/comments");
const authRoutes = require("./routes/auth");
const { registerSocketHandlers } = require("./sockets/handlers");

const app = express();
const server = http.createServer(app); // I need the raw http server so Socket.io can attach to it

// Allow requests from the frontend — in production I'll lock this down to the Vercel URL
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Standard middleware
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/snippets", snippetRoutes);
app.use("/api/comments", commentRoutes);

// Health check — Railway uses this to know the server is alive
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Attach io to app so routes can emit events via req.app.get("io")
app.set("io", io);

// Socket.io connection handling — I pass the io instance into a handler
// so I can keep all the socket logic in one place
registerSocketHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
