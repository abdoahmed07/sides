// Auth routes: register and login
// I'm keeping this simple — email + password, bcrypt for hashing, JWT for sessions
// No refresh tokens for now, the JWT expires in 7 days which is fine for a portfolio app

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Email, password, and name are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    // bcrypt's cost factor 10 is the standard — high enough to be slow to brute-force,
    // fast enough that login doesn't feel sluggish
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name",
      [email.toLowerCase().trim(), passwordHash, name.trim()]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    // PostgreSQL error code 23505 = unique constraint violation = email already taken
    if (err.code === "23505") {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    console.error("Register error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const result = await db.query(
      "SELECT id, email, name, password_hash FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];

    // I check the hash even if no user was found (with a dummy comparison) to prevent
    // timing attacks that would let someone enumerate valid emails
    if (!user) {
      await bcrypt.compare(password, "$2b$10$invalidhashtopreventtimingattack");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
