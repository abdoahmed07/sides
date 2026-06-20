# JWT authentication explained by someone who was confused by it

I'm going to explain JWTs the way I wish someone had explained them to me — without assuming
you already know what "stateless authentication" means or why it matters.

---

## What problem does a JWT solve?

When a user logs in, the server needs to remember who they are for future requests. The naive
approach is to store a session ID in a database: the user logs in, the server creates a record
in a `sessions` table, and gives the user a cookie with that session ID. On each request, the
server looks up the ID in the database to find out who's making the request.

This works but it has a cost: every single request requires a database lookup just to identify
the user.

A JWT (JSON Web Token) solves this differently: instead of giving the user an opaque ID that
maps to a database row, the server gives them a token that *contains* the user's information,
cryptographically signed so you can verify it's real without looking anything up.

## What's inside a JWT

A JWT looks like this:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NDIsImVtYWlsIjoibW9lekBleGFtcGxlLmNvbSIsIm5hbWUiOiJNb2V6IiwiaWF0IjoxNzAzMDAwMDAwLCJleHAiOjE3MDM2MDQ4MDB9.xK8z2mP3nQr1vW9oLjEtYuBfHsDcMeNpAiGkRsTvZl4
```

It's three base64-encoded parts separated by dots:

**Part 1 — Header:** `{"alg": "HS256", "typ": "JWT"}` — tells you the signing algorithm used.

**Part 2 — Payload:** `{"id": 42, "email": "moez@example.com", "name": "Moez", "iat": 1703000000, "exp": 1703604800}` — the actual data. `iat` is "issued at", `exp` is when it expires.

**Part 3 — Signature:** the first two parts hashed with a secret key. This is what makes the token tamper-proof.

## How the signature works

When my backend creates a JWT, it computes:

```
HMAC-SHA256(base64(header) + "." + base64(payload), JWT_SECRET)
```

When the backend receives a JWT on a later request, it recomputes that hash from the header
and payload, and checks if it matches the signature. If someone changed the payload (e.g.,
changed their user ID to someone else's), the signature won't match and the token is rejected.

The secret key — `JWT_SECRET` in my `.env` file — never leaves the server. Without it, you
can't forge a valid signature.

In code, this is what happens:

```javascript
// Creating a token on login
const token = jwt.sign(
  { id: user.id, email: user.email, name: user.name },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

// Verifying a token on a protected route
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// decoded = { id: 42, email: "...", name: "...", iat: ..., exp: ... }
```

`jwt.verify` throws if the signature is wrong or the token is expired. I wrap it in a
try/catch and return a 401 if it fails.

## Why I don't store the token in localStorage

I store the JWT in React component state instead of `localStorage`. Here's why: `localStorage`
is readable by any JavaScript running on the page. If my app has an XSS vulnerability — any
place where untrusted input gets rendered as HTML — an attacker could inject a script that reads
the token from `localStorage` and sends it to their server. Game over.

State in a React component isn't accessible from outside the React tree, so it's safer. The
trade-off is that the user gets logged out when they refresh the page. For a portfolio app
that's fine. In a real production app, the correct solution is httpOnly cookies, which are
completely inaccessible to JavaScript.

## What I'm working on next

I deployed the app to Railway and Vercel this week. I'll write about what broke in production
next time — and there was a lot that broke.
