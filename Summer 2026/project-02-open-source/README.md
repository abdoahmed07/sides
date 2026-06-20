# Project 02 — Open Source Contribution

## Overview

Contributed a bug fix to [socket.io](https://github.com/socketio/socket.io), the real-time
WebSocket library I used while building Project 01. By week 6 I knew the codebase well enough
from the user side to actually understand where the bug was.

## Files in this folder

- `CONTRIBUTION_LOG.md` — full writeup: what the bug was, steps I followed, PR description, feedback received
- `fix-branch/socket.patch` — the actual code change (diff format)
- `fix-branch/test.patch` — the test I wrote to cover the fix

## Key things I learned

**Reading a real codebase is very different from reading tutorials.**
The socket.io codebase is TypeScript, has multiple layers of abstraction, and uses patterns I
hadn't seen before. I spent more time reading than writing — that's the right ratio.

**The contribution guide is not optional.**
I almost submitted without reading CONTRIBUTING.md. Reading it first saved me a rejected PR
because they have a specific commit message format and require tests for all bug fixes.

**Responsiveness matters more than being right.**
The maintainer asked for a change. I made it within 24 hours. They noticed. I think that
responsiveness is part of why the PR got merged relatively quickly.

## CV entry

Open Source: socket.io — Fixed a bug where pending acknowledgement callbacks were silently
dropped on disconnect. Pull request merged into production codebase used by millions of
applications. [[link to merged PR]](https://github.com/socketio/socket.io/pulls)
