# What I learned deploying my first app to production

Three things broke when I deployed my code review tool to Railway + Vercel. Here's exactly
what they were and how I fixed them.

---

My app worked perfectly locally. Backend on port 3000, frontend on port 5173, everything
talking to each other fine. Then I deployed and nothing worked. This is apparently a rite of
passage.

## Problem 1: CORS

The browser was blocking requests from my Vercel frontend to my Railway backend with:

```
Access to fetch at 'https://my-backend.railway.app/api/auth/login'
from origin 'https://my-frontend.vercel.app' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

CORS (Cross-Origin Resource Sharing) is the browser's security mechanism that prevents a page
on `vercel.app` from making requests to `railway.app` unless the server explicitly allows it.
Locally I was using Vite's proxy, which avoided the issue entirely — but in production there's
no proxy.

The fix was two lines in my backend:

```javascript
const cors = require("cors");

app.use(cors({
  origin: process.env.FRONTEND_URL,  // "https://my-frontend.vercel.app"
  methods: ["GET", "POST", "DELETE"],
}));
```

And for Socket.io:

```javascript
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});
```

I also had to set `FRONTEND_URL` as an environment variable on Railway.

## Problem 2: environment variables not loading

After fixing CORS, the database connection broke. The error was:

```
Error: password authentication failed for user "undefined"
```

My database URL was being read as `undefined`. I'd set `DATABASE_URL` in a `.env` file locally,
but Railway uses its own environment variable system — you set them in the Railway dashboard,
not in a file. The `.env` file is not uploaded to Railway (and shouldn't be — it contains secrets).

I'd already added `DATABASE_URL` in the Railway dashboard, but the app was still failing.
The reason: Railway injects the PostgreSQL connection string automatically when you add a
PostgreSQL addon, but it uses the variable name `DATABASE_URL` and the format is a bit different
from what I expected — it includes `?sslmode=require` at the end.

My `pg` Pool config needed to handle SSL:

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});
```

Without `{ rejectUnauthorized: false }`, Node.js rejects Railway's self-signed SSL certificate.

## Problem 3: Socket.io connections failing silently

Even after fixing the above, real-time comments weren't working. Connections were being made
(I could see them in the Railway logs) but then immediately dropping.

The issue: Socket.io's WebSocket connections were being killed by Railway's request timeout.
By default, Railway terminates connections that are inactive for 60 seconds. Socket.io sends
a ping every 25 seconds by default, but something about Railway's load balancer was interfering.

I fixed it by lowering the ping interval to ensure keepalives happened more frequently:

```javascript
const io = new Server(server, {
  pingInterval: 10000,  // ping every 10 seconds instead of 25
  pingTimeout: 5000,
  cors: { /* ... */ },
});
```

After that, WebSocket connections stayed alive reliably.

## What I'd do differently next time

Start with the production environment variables from day one. I'd add a `.env.production`
file to my mental checklist and think through every place an environment variable is used
before deploying.

Also: set up logging early. Half my debugging time was spent reading Railway logs and trying
to figure out what was happening. A proper logger like `winston` that structures output as JSON
makes this much easier.

Next post: my experience contributing to socket.io as a second-year student.
