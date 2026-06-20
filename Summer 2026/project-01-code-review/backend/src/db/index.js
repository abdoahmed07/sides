// Database connection using the `pg` package
// I use a connection pool so multiple requests don't block each other
// Pool automatically manages connections — I don't have to open/close manually

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // When running locally without SSL, this prevents the "self-signed cert" error
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Test the connection on startup so I know immediately if something's wrong
pool.connect((err, client, release) => {
  if (err) {
    console.error("Failed to connect to database:", err.message);
  } else {
    console.log("Connected to PostgreSQL");
    release();
  }
});

// I export just the query function so routes never touch the pool directly
// This way I can swap the DB layer later without touching route files
module.exports = {
  query: (text, params) => pool.query(text, params),
};
