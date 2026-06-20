-- Run this once to set up the database from scratch
-- psql -d codereview_db -f schema.sql

-- I'm using UUIDs for public-facing IDs (like snippet share URLs) but
-- keeping integer primary keys internally for performance on joins

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- language stores the detected/chosen language so highlight.js knows how to color it
-- share_id is the random 8-char string that goes in the URL (e.g. /review/abc12345)
CREATE TABLE IF NOT EXISTS snippets (
  id          SERIAL PRIMARY KEY,
  share_id    TEXT UNIQUE NOT NULL,
  title       TEXT,
  code        TEXT NOT NULL,
  language    TEXT NOT NULL DEFAULT 'plaintext',
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- parent_id is NULL for top-level comments, or points to another comment for replies
CREATE TABLE IF NOT EXISTS comments (
  id          SERIAL PRIMARY KEY,
  snippet_id  INTEGER REFERENCES snippets(id) ON DELETE CASCADE NOT NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  line_number INTEGER NOT NULL,
  body        TEXT NOT NULL,
  parent_id   INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index on snippet_id so fetching all comments for a snippet is fast
CREATE INDEX IF NOT EXISTS idx_comments_snippet_id ON comments(snippet_id);
CREATE INDEX IF NOT EXISTS idx_snippets_share_id ON snippets(share_id);
CREATE INDEX IF NOT EXISTS idx_snippets_user_id ON snippets(user_id);
