// Socket.io event handlers
// I keep all socket logic here so index.js stays clean
// Each snippet page is its own "room" — clients join/leave as they open/close tabs

// tracks who's in each room: { "snippet:abc123": Set of { userId, name } }
const roomPresence = new Map();

function registerSocketHandlers(io) {
  // Attach io to app so routes can emit events (see comments.js)
  // This is a bit of a hack but it's simple and it works for a project this size
  // In a bigger app I'd use a message bus like Redis pub/sub instead

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Client joins a snippet room when they open a snippet page
    socket.on("join_snippet", ({ shareId, user }) => {
      const room = `snippet:${shareId}`;
      socket.join(room);

      // Track presence for this room
      if (!roomPresence.has(room)) {
        roomPresence.set(room, new Map());
      }
      roomPresence.get(room).set(socket.id, {
        name: user?.name || "Anonymous",
        userId: user?.id || null,
      });

      // Tell everyone in the room (including the new joiner) how many people are viewing
      const viewers = [...roomPresence.get(room).values()];
      io.to(room).emit("presence_update", { count: viewers.length, viewers });

      socket.data.room = room; // remember which room this socket is in so we can clean up on disconnect
    });

    // Client leaves the snippet page (they navigated away)
    socket.on("leave_snippet", ({ shareId }) => {
      const room = `snippet:${shareId}`;
      handleLeave(socket, room, io);
    });

    // Clean up when the socket disconnects entirely (tab closed, network lost, etc.)
    socket.on("disconnect", () => {
      if (socket.data.room) {
        handleLeave(socket, socket.data.room, io);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

// Shared leave logic — removes from room and broadcasts updated presence count
function handleLeave(socket, room, io) {
  socket.leave(room);

  if (roomPresence.has(room)) {
    roomPresence.get(room).delete(socket.id);

    const viewers = [...roomPresence.get(room).values()];

    if (viewers.length === 0) {
      // No one left in the room, clean up memory
      roomPresence.delete(room);
    } else {
      io.to(room).emit("presence_update", { count: viewers.length, viewers });
    }
  }
}

module.exports = { registerSocketHandlers };
