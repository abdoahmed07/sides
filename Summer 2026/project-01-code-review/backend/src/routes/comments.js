// Comment routes — post a comment on a line, fetch comments for a snippet
// After saving, we emit a Socket.io event so other viewers see it instantly

const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// I need access to the io instance for real-time emissions
// It gets attached to the app in index.js so I can pull it from req.app
function getIo(req) {
  return req.app.get("io");
}

// POST /api/comments — post a new comment on a specific line
router.post("/", requireAuth, async (req, res) => {
  const { snippet_id, snippet_share_id, line_number, body, parent_id } = req.body;

  if (!line_number || !body?.trim()) {
    return res.status(400).json({ error: "Line number and body are required" });
  }

  if (body.length > 10_000) {
    return res.status(400).json({ error: "Comment too long" });
  }

  try {
    // I accept either the internal ID or the public share_id from the client
    let snippetId = snippet_id;
    if (!snippetId && snippet_share_id) {
      const found = await db.query("SELECT id FROM snippets WHERE share_id = $1", [snippet_share_id]);
      if (found.rows.length === 0) return res.status(404).json({ error: "Snippet not found" });
      snippetId = found.rows[0].id;
    }

    const result = await db.query(
      `INSERT INTO comments (snippet_id, user_id, line_number, body, parent_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, snippet_id, line_number, body, parent_id, created_at`,
      [snippetId, req.user.id, line_number, body.trim(), parent_id || null]
    );

    const comment = result.rows[0];

    // Attach the author name so the frontend can display it right away
    const newComment = {
      ...comment,
      author_name: req.user.name,
      user_id: req.user.id,
    };

    // Emit to everyone viewing this snippet's room so they see the comment instantly
    // The room name is just the snippet's share_id (see sockets/handlers.js)
    if (snippet_share_id) {
      const io = getIo(req);
      io.to(`snippet:${snippet_share_id}`).emit("new_comment", newComment);
    }

    res.status(201).json(newComment);
  } catch (err) {
    console.error("Post comment error:", err);
    res.status(500).json({ error: "Failed to post comment" });
  }
});

// DELETE /api/comments/:id — delete your own comment
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      "DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found or not yours" });
    }

    res.json({ deleted: true });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

module.exports = router;
