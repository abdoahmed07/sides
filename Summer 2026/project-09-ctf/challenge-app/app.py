"""
CTF Challenge App — "Can you log in without knowing the password?"

This is an intentionally vulnerable Flask app for a SQL injection CTF challenge.
The vulnerability is in the login route — it uses string concatenation instead of
parameterized queries.

Deploy on Railway. Register it on CTFd with the flag below.

⚠️  DO NOT use this code as a template for a real application.
    The vulnerability is intentional for educational purposes.
"""

import sqlite3
import os
from flask import Flask, request, render_template_string, g

app = Flask(__name__)

DATABASE = "ctf_challenge.db"
FLAG     = "picoCTF{sql_1nj3ct10n_m4st3r_7734}"


def get_db():
    """Get the database connection for the current request context."""
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Create tables and seed the database."""
    db = sqlite3.connect(DATABASE)
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS secrets (
            id   INTEGER PRIMARY KEY,
            flag TEXT NOT NULL
        )
    """)

    # Seed users
    db.execute("DELETE FROM users")
    db.execute("INSERT INTO users (username, password) VALUES (?, ?)", ("admin", "s3cr3t_p4ssw0rd_y0u_d0nt_kn0w"))
    db.execute("INSERT INTO users (username, password) VALUES (?, ?)", ("alice", "hunter2"))
    db.execute("INSERT INTO users (username, password) VALUES (?, ?)", ("bob",   "password123"))

    # The flag is stored in a separate table — players need to extract it via injection
    db.execute("DELETE FROM secrets")
    db.execute("INSERT INTO secrets (flag) VALUES (?)", (FLAG,))

    db.commit()
    db.close()
    print("Database initialized.")


# ---- HTML templates ----

LOGIN_PAGE = """
<!DOCTYPE html>
<html>
<head>
  <title>Super Secure Login</title>
  <style>
    body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; display: flex;
           align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .box { background: #16213e; padding: 2rem; border-radius: 8px; width: 320px; }
    h1 { color: #0f3460; margin: 0 0 1.5rem; }
    label { display: block; color: #aaa; font-size: 0.85rem; margin-bottom: 0.3rem; }
    input { width: 100%; padding: 0.5rem; background: #0f3460; border: 1px solid #444;
            color: white; border-radius: 4px; margin-bottom: 1rem; box-sizing: border-box; }
    button { width: 100%; padding: 0.6rem; background: #e94560; border: none; color: white;
             border-radius: 4px; cursor: pointer; font-size: 1rem; }
    .hint { color: #888; font-size: 0.75rem; margin-top: 1rem; }
    .error { color: #e94560; margin-bottom: 1rem; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="box">
    <h1>🔐 Login</h1>
    {% if error %}
    <div class="error">{{ error }}</div>
    {% endif %}
    <form method="POST">
      <label>Username</label>
      <input type="text" name="username" placeholder="Enter username">
      <label>Password</label>
      <input type="password" name="password" placeholder="Enter password">
      <button type="submit">Sign in</button>
    </form>
    <div class="hint">Hint: the login is very secure. Or is it?</div>
  </div>
</body>
</html>
"""

SUCCESS_PAGE = """
<!DOCTYPE html>
<html>
<head>
  <title>You're in!</title>
  <style>
    body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; display: flex;
           align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .box { background: #16213e; padding: 2rem; border-radius: 8px; max-width: 500px; text-align: center; }
    h1 { color: #4ecca3; }
    .flag { background: #0f3460; padding: 1rem; border-radius: 4px; font-size: 0.9rem;
            word-break: break-all; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="box">
    <h1>✅ Logged in as {{ username }}</h1>
    <p>You bypassed the login. Here's what you found:</p>
    <div class="flag">{{ flag }}</div>
  </div>
</body>
</html>
"""


@app.route("/", methods=["GET", "POST"])
def login():
    error = None

    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")

        # ⚠️ INTENTIONALLY VULNERABLE — do not write real code like this
        # The username is concatenated directly into the SQL query.
        # Try: username = ' OR '1'='1' --
        #       username = ' UNION SELECT flag FROM secrets --
        query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"

        try:
            db = get_db()
            result = db.execute(query).fetchone()

            if result:
                # Get the flag from the secrets table
                flag_row = db.execute("SELECT flag FROM secrets LIMIT 1").fetchone()
                flag = flag_row["flag"] if flag_row else "No flag found"

                return render_template_string(
                    SUCCESS_PAGE,
                    username=result["username"],
                    flag=flag
                )
            else:
                error = "Invalid username or password."
        except sqlite3.OperationalError as e:
            # Show the SQL error — intentional, helps players understand the structure
            error = f"Database error: {e}"

    return render_template_string(LOGIN_PAGE, error=error)


if __name__ == "__main__":
    if not os.path.exists(DATABASE):
        init_db()
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
