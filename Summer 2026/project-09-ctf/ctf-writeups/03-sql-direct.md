# PicoCTF — SQL Direct (Web Exploitation)

**Category:** Web Exploitation
**Points:** 200

## What the challenge was

A login form with username and password fields. The backend presumably runs a SQL query like:
```sql
SELECT * FROM users WHERE username = '<input>' AND password = '<input>'
```

## Background reading

I read the OWASP SQL Injection guide before attempting this. The key insight: if user input is concatenated directly into a SQL query string rather than passed as a parameterized value, an attacker can inject SQL syntax to change the query's logic.

## The attack

I entered as the username:
```
' OR '1'='1
```

And anything for the password. The resulting query became:
```sql
SELECT * FROM users WHERE username = '' OR '1'='1' AND password = 'anything'
```

Since `'1'='1'` is always true, the WHERE clause is always satisfied, and the query returns the first user in the database (usually admin). The app logged me in and showed the flag.

## Why parameterized queries prevent this

With a parameterized query:
```python
cursor.execute("SELECT * FROM users WHERE username = %s AND password = %s", (username, password))
```

The database treats the `%s` values as data, not as SQL syntax. No matter what's in `username`, it can't change the structure of the query. The `'` character is just a literal apostrophe in the data, not a SQL string delimiter.

## What I learned

SQL injection is one of the most common critical vulnerabilities and also one of the most preventable. Every language and framework has a way to write parameterized queries. There's no good reason to concatenate user input into SQL strings. When I built my own challenge app I made sure the non-vulnerable paths used parameterized queries and only the intentional challenge path was vulnerable.
