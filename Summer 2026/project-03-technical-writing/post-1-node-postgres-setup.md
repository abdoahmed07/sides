# How I set up a Node + PostgreSQL backend from scratch (no tutorial)

This post is about the exact steps I took to get a Node.js Express server talking to PostgreSQL
for the first time — including the thing that confused me for two hours that turned out to be
a one-line fix.

---

I've been building a real-time code review tool this summer. The backend needed to store code
snippets and comments in a real database. I'd used SQLite before for small scripts, but I
wanted to actually learn SQL properly, so I went with PostgreSQL.

## Setting up Express first

I ran `npm init` in my project folder and installed Express:

```bash
npm install express
```

I made a `src/index.js` file, wrote a basic server that returns `"hello world"` on port 3000,
and ran it with `node src/index.js`. That part took maybe 10 minutes.

Then I installed PostgreSQL locally with Homebrew (`brew install postgresql@15`), ran
`brew services start postgresql@15` to start it, and created a database:

```bash
createdb codereview_db
```

## Connecting with `pg`

The `pg` package is the standard Node.js PostgreSQL client. I installed it with:

```bash
npm install pg
```

Then wrote my first database query:

```javascript
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://localhost/codereview_db",
});

// Test it
pool.query("SELECT NOW()", (err, result) => {
  if (err) throw err;
  console.log("Connected:", result.rows[0]);
});
```

This printed the current timestamp. The connection worked.

## The thing that confused me

When I tried to create my first table, I kept getting `ERROR: role "postgres" does not exist`.

I spent two hours on this. It turns out macOS's Homebrew PostgreSQL doesn't create a `postgres`
superuser by default — it creates a user matching your macOS username. So when I tried to
connect as `postgres`, it failed.

The fix: I just needed to use my actual macOS username in the connection string, or create the
postgres user manually:

```bash
createuser -s postgres
```

After that, everything worked. This is the kind of thing no tutorial tells you because they
assume you're on Linux where the default setup is different.

## What the `pg` package actually does under the hood

When you call `pool.query(sql, params)`, the pool picks an available connection from its pool
(or opens a new one up to the max size, default 10), sends the query to PostgreSQL over TCP,
waits for the response, and returns it as a JavaScript object.

The parameterised query format — using `$1`, `$2` instead of string interpolation — sends the
values separately from the SQL text. PostgreSQL receives them as data, not as part of the query
string, which is why it prevents SQL injection. The `pg` package handles the encoding for you.

## What I'm building next

Next week I'm adding WebSockets for real-time comments using Socket.io. I'll write about that
in two weeks once I understand what I'm actually doing.
