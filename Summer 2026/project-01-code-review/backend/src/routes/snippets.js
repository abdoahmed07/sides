// Snippet routes — create, fetch, and list snippets
// A snippet is a piece of code with a unique shareable URL

const express = require("express");
const { nanoid } = require("nanoid"); // generates short unique IDs like "V1StGXR8_Z5jdHi6"
const db = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/snippets — create a new snippet (must be logged in)
router.post("/", requireAuth, async (req, res) => {
  const { code, language = "plaintext", title } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ error: "Code cannot be empty" });
  }

  if (code.length > 500_000) {
    return res.status(400).json({ error: "Code is too long (max 500,000 characters)" });
  }

  try {
    // nanoid gives me a random 8-char URL-safe string
    // The chance of collision is astronomically low but I handle it just in case
    let shareId;
    let attempts = 0;
    while (true) {
      shareId = nanoid(8);
      const existing = await db.query("SELECT id FROM snippets WHERE share_id = $1", [shareId]);
      if (existing.rows.length === 0) break;
      if (++attempts > 5) throw new Error("Could not generate unique share ID");
    }

    const result = await db.query(
      `INSERT INTO snippets (share_id, title, code, language, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, share_id, title, language, created_at`,
      [shareId, title?.trim() || null, code, language, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create snippet error:", err);
    res.status(500).json({ error: "Failed to create snippet" });
  }
});

// GET /api/snippets/:shareId — fetch a single snippet with all its comments
// Anyone with the link can view it (optionalAuth so we know who's logged in)
router.get("/:shareId", optionalAuth, async (req, res) => {
  const { shareId } = req.params;

  try {
    const snippetResult = await db.query(
      `SELECT s.id, s.share_id, s.title, s.code, s.language, s.created_at,
              u.name AS author_name
       FROM snippets s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.share_id = $1`,
      [shareId]
    );

    if (snippetResult.rows.length === 0) {
      return res.status(404).json({ error: "Snippet not found" });
    }

    // Fetch all comments for this snippet in one query, ordered by line then time
    const commentsResult = await db.query(
      `SELECT c.id, c.line_number, c.body, c.parent_id, c.created_at,
              u.name AS author_name, u.id AS user_id
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.snippet_id = $1
       ORDER BY c.line_number ASC, c.created_at ASC`,
      [snippetResult.rows[0].id]
    );

    res.json({
      snippet: snippetResult.rows[0],
      comments: commentsResult.rows,
    });
  } catch (err) {
    console.error("Fetch snippet error:", err);
    res.status(500).json({ error: "Failed to fetch snippet" });
  }
});

// GET /api/snippets — get the logged-in user's snippets (for the homepage)
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.id, s.share_id, s.title, s.language, s.created_at,
              COUNT(c.id) AS comment_count,
              -- grab first line of code as a preview title if no title set
              SPLIT_PART(s.code, E'\n', 1) AS code_preview
       FROM snippets s
       LEFT JOIN comments c ON c.snippet_id = s.id
       WHERE s.user_id = $1
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT 20`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("List snippets error:", err);
    res.status(500).json({ error: "Failed to fetch snippets" });
  }
});

module.exports = router;
