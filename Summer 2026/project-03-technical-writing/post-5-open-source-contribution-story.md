# How I contributed to an open source project as a second-year student

Here's exactly what I did, what surprised me, and what I'd tell other students who want to do
the same.

---

I contributed a bug fix to socket.io — the real-time WebSocket library I'd been using all
summer in my code review app. Here's the whole thing from start to finish.

## How I found the issue

I went to `github.com/socketio/socket.io/issues` and filtered by the `good first issue` label.
I read through about 15 open issues before finding one that made sense to me.

The bug: when a client calls `socket.emit("event", data, callback)` and then disconnects before
the server sends the acknowledgement, the callback was silently dropped. The caller had no way
to know their message wasn't delivered.

I understood this bug because I'd been thinking about socket acknowledgements while building my
own project. That's what made it the right issue to pick — not that it was the easiest, but
that I already had context.

I commented: *"Hi, I'd like to work on this. I'm a computer engineering student familiar with
Socket.io. Is this still open?"* One sentence. Professional. They said yes.

## Reading the codebase

Before writing a single line of code, I cloned the repo and just read it for a few days while
working on other things.

The socket.io codebase is TypeScript with multiple packages in a monorepo. I had to learn
where the actual socket class lives (`lib/socket.ts`), how the event/ack system is structured,
and what the conventions are for how they write error handling.

Reading is the actual work. Writing the fix took maybe 30 minutes. Understanding the codebase
well enough to know *where* the fix should go took much longer.

## The fix itself

In `Socket._onclose()`, I added a loop that calls any pending acknowledgement callbacks with
an error when the socket closes:

```typescript
// When a socket closes, call any pending ack callbacks with an error
// so callers know delivery failed instead of hanging forever
for (const id in this._acks) {
  const ack = this._acks[id];
  process.nextTick(ack, new Error("socket disconnected"));
  delete this._acks[id];
}
```

I also wrote a test that verifies the callback is called with an error when the socket
disconnects before the ack. The project requires tests for bug fixes — CONTRIBUTING.md says
this explicitly.

## What surprised me

**The maintainers are just people.** I was nervous opening the PR. I thought it would be
judged harshly or ignored. Instead, one of the maintainers reviewed it within three days, left
clear feedback, and was genuinely helpful. The open source community is much more welcoming
than I expected.

**Responsiveness matters as much as code quality.** When the maintainer asked for a change,
I made it within 24 hours. They explicitly thanked me for the quick turnaround. That detail
— just being responsive — probably helped get it merged.

**Reading the diff of every merged PR in the relevant area first was worth it.** Before writing
my fix, I read the last 10 PRs that touched `lib/socket.ts`. This told me the naming
conventions, the comment style, and the level of documentation they expected. My PR matched
the codebase style because I'd seen what "matching the codebase style" looked like in practice.

## What I'd tell other students

Pick an issue in something you actually use. I knew socket.io from my own project, which gave
me enough context to understand the bug without reading the entire codebase from scratch.

Read CONTRIBUTING.md completely before touching any code. It exists for a reason.

Start with something small. A bug fix, a missing test, a documentation gap. The goal of your
first PR is to learn the contribution process, not to redesign the architecture.

And: if your first issue gets closed by someone else or your PR gets rejected, that's fine.
It's not personal. Pick another issue.
