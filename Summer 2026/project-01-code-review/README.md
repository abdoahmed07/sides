# Real-time Code Review Tool

A collaborative web app for inline code commenting with live updates. Paste or upload code, share the link, and leave comments on specific lines — comments appear instantly for everyone viewing the same snippet.

**Live demo:** [your-app.vercel.app](https://your-app.vercel.app) | **Backend:** deployed on Railway

## What it does

- Paste code or drag-and-drop a file — it gets stored with a unique shareable URL
- Syntax highlighting via highlight.js for 18+ languages
- Click any line to leave an inline comment
- Comments appear live for all viewers (no refresh needed) — powered by Socket.io
- Threaded replies in a collapsible sidebar
- Real-time "X people viewing" presence indicator
- JWT authentication — comments are attributed to your account

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Real-time | Socket.io |
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Auth | JWT + bcrypt |
| Deployment | Railway (backend + DB), Vercel (frontend) |

## Running locally

**Prerequisites:** Node.js 18+, PostgreSQL running locally

```bash
# 1. Set up the database
psql -c "CREATE DATABASE codereview_db"
psql -d codereview_db -f backend/src/db/schema.sql

# 2. Backend
cd backend
cp .env.example .env       # fill in DATABASE_URL and JWT_SECRET
npm install
npm run dev                # starts on :3000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                # starts on :5173, open http://localhost:5173
```

## Deployment

**Backend on Railway:**
1. Push backend to a GitHub repo
2. Connect Railway to that repo
3. Set env vars: `DATABASE_URL` (Railway gives you this for the PostgreSQL addon), `JWT_SECRET`, `FRONTEND_URL`

**Frontend on Vercel:**
1. Push frontend to its own GitHub repo
2. Import into Vercel
3. Set env var: `VITE_API_URL=https://your-backend.railway.app`

## Technical decisions I made

**Why Socket.io over SSE (Server-Sent Events):**
I needed bidirectional communication for the presence feature — the server needs to know when users join/leave rooms, not just push data to them. SSE is one-directional. Socket.io also handles reconnection automatically which is important for a real-time app.

**Why JWT in memory instead of localStorage:**
Storing JWTs in localStorage makes XSS attacks more dangerous — any malicious script on the page can read it. Storing in React state means the token dies on refresh, but for a portfolio/tool app that's an acceptable trade-off. In production I'd use httpOnly cookies.

**Why nanoid for share IDs instead of database integer IDs:**
Integer IDs in URLs are enumerable — someone can just increment the number and scrape all snippets. An 8-character nanoid (21^8 combinations) makes guessing practically impossible.

**Why PostgreSQL over SQLite:**
I wanted to learn real SQL properly — joins, indexes, constraints. SQLite is fine for local dev but Railway makes PostgreSQL trivially easy to deploy, so there's no reason not to use the real thing.

**Why Railway + Vercel instead of one platform:**
Vercel's CDN is significantly faster for static assets (the React build). Railway handles long-lived WebSocket connections better than serverless functions, which have a timeout limit that would kill Socket.io connections.
