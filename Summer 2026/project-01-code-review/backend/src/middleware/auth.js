// JWT auth middleware
// I attach this to any route that requires the user to be logged in
// On success it adds `req.user` so route handlers know who's making the request

const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  // JWTs come in the Authorization header as "Bearer <token>"
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // jwt.verify throws if the token is expired or the signature doesn't match
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Optional auth — routes that work for logged-out users but behave differently
// when logged in (e.g. showing "your" snippets) use this instead of requireAuth
function optionalAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    req.user = null; // Token invalid but we don't reject the request
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
