# Project 09 — Security: CTF Challenges

Solved 10 CTF challenges across 5 security categories on PicoCTF, documented each one,
then built and hosted an original SQL injection challenge.

## CTF Writeups

| # | Challenge | Category | Points |
|---|-----------|----------|--------|
| 1 | [Insp3ct0r](ctf-writeups/01-insp3ct0r.md) | Web | 50 |
| 2 | [where are the robots](ctf-writeups/02-where-are-the-robots.md) | Web | 100 |
| 3 | [SQL Direct](ctf-writeups/03-sql-direct.md) | Web | 200 |
| 4 | [Caesar Cipher 1](ctf-writeups/04-caesar-cipher.md) | Crypto | 100 |
| 5 | [13 (ROT13)](ctf-writeups/05-rot13.md) | Crypto | 100 |
| 6 | [vault-door-1](ctf-writeups/06-vault-door-1.md) | Reverse Eng. | 100 |
| 7 | [asm1](ctf-writeups/07-asm1.md) | Reverse Eng. | 200 |
| 8 | [buffer overflow 0](ctf-writeups/08-buffer-overflow-0.md) | Binary Exp. | 100 |
| 9 | [buffer overflow 1](ctf-writeups/09-buffer-overflow-1.md) | Binary Exp. | 200 |
| 10 | [MacroHard WeakEdge](ctf-writeups/10-macrohard-weakedge.md) | Forensics | 300 |

## My CTF Challenge

**Title:** "Can you log in without knowing the password?"

**Hosted at:** [your-app.railway.app](https://your-app.railway.app)

**CTFd competition:** [your-ctfd.ctfd.io](https://your-ctfd.ctfd.io) (public)

A Flask web app with an intentional SQL injection vulnerability. Players must bypass the login
and extract the flag from the database without knowing any credentials.

```bash
# Run locally
cd challenge-app
pip install flask
python app.py
# Open http://localhost:5001
```

**Solution hint:** The login validates credentials with a raw SQL query. The username field
is not sanitized.

**Solution (don't read until you've tried):**
Username: `' OR '1'='1' --` with any password. The `--` comments out the password check,
and `OR '1'='1'` makes the condition always true.

## What I can explain in an interview

- **SQL injection:** How parameterized queries prevent it, why string concatenation is dangerous
- **Buffer overflows:** Stack layout, return address overwriting, NX bit and ASLR defenses
- **Basic cryptography:** Difference between encoding and encryption, why keyspace matters
- **File forensics:** What Office documents actually contain, how to find hidden data
- **CTF methodology:** Reconnaissance first (robots.txt, view source), then try common vulnerabilities
