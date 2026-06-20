# Real-time Code Review Tool

A collaborative web app for inline code commenting with live updates. Paste or upload code, share the link, and leave comments on specific lines — comments appear instantly for everyone viewing the same snippet.

**Live demo:** [codereview-rho.vercel.app](https://codereview-rho.vercel.app) | **Backend:** [sides-production.up.railway.app](https://sides-production.up.railway.app)

## What it does

- Paste code or drag-and-drop a file — it gets stored with a unique shareable URL
- Syntax highlighting via highlight.js for 18+ languages
- Click any line to leave an inline comment
- Comments appear live for all viewers (no refresh needed) — powered by Socket.io
- Threaded replies in a collapsible sidebar
- Real-time "X people viewing" presence indicator
- JWT authentication — comments are attributed to your account
- Sign-in redirects back to the snippet you were viewing

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | PostgreSQL (Railway) |
| Real-time | Socket.io |
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Auth | JWT + bcryptjs |
| Deployment | Railway (backend + DB), Vercel (frontend) |

## Running locally

**Prerequisites:** Node.js 20+, a PostgreSQL database (Railway free tier works)

```bash
# 1. Backend
cd backend
npm install

# Create a .env file:
# DATABASE_URL=postgresql://...your railway or local postgres url...
# JWT_SECRET=any-random-string
# FRONTEND_URL=http://localhost:5174

# Apply the schema (one time)
psql $DATABASE_URL < src/db/schema.sql

# Start the server
npm run dev   # runs on :3000, loads .env automatically via --env-file
```

```bash
# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev   # Vite proxies /api to :3000, open http://localhost:5174
```

> Note: Vite may start on port 5174 instead of 5173 if that port is taken.
> Update `FRONTEND_URL` in your backend `.env` to match whichever port it picks.

## Deployment

**Backend (Railway):**
1. New service → GitHub repo → set root directory to `project-01-code-review/backend`
2. Variables: `DATABASE_URL` (reference your Railway Postgres), `JWT_SECRET`, `FRONTEND_URL=https://your-vercel-url.vercel.app`
3. Settings → Networking → Generate Domain → enter port `3000`

**Frontend (Vercel):**
```bash
cd frontend
npx vercel        # follow prompts, auto-detects Vite
npx vercel env add VITE_API_URL production
# enter: https://your-backend.up.railway.app
npx vercel --prod
```

After deploying both, update `FRONTEND_URL` in Railway to your Vercel URL — Railway redeploys automatically.

## Technical decisions I made

**Why Socket.io over SSE (Server-Sent Events):**
I needed bidirectional communication for the presence feature — the server needs to know when users join/leave rooms. SSE is one-directional. Socket.io also handles reconnection automatically which matters for a real-time app.

**Why JWT in memory instead of localStorage:**
Storing JWTs in localStorage makes XSS attacks more dangerous — any malicious script can read it. In React state the token dies on refresh, but for this kind of app that's an acceptable trade-off. In production I'd use httpOnly cookies.

**Why `crypto.randomBytes` for share IDs:**
I originally used nanoid but it's ESM-only in v4+ which breaks CommonJS require. Node's built-in `crypto.randomBytes(6).toString('base64url')` gives the same 8-char URL-safe random ID with no dependency needed.

**Why bcryptjs instead of bcrypt:**
`bcrypt` requires native compilation (node-gyp) which breaks across platforms and in CI. `bcryptjs` is pure JavaScript with the same API — slightly slower but completely portable.

**Why Railway + Vercel instead of one platform:**
Vercel's CDN is faster for static assets. Railway handles long-lived WebSocket connections better than serverless functions, which have timeouts that would kill Socket.io connections.

**Why relative API paths in the frontend:**
The frontend uses `fetch("/api/...")` with no hardcoded host. In dev, Vite's proxy forwards those to `:3000`. In production, `VITE_API_URL` is set to the Railway backend. This avoids CORS entirely in dev and makes the setup portable.
