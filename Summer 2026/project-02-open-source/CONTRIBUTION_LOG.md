# Open Source Contribution — socket.io

## Issue I picked

**Title:** `socket.emit()` callback not called when socket disconnects before acknowledgement  
**Issue URL:** https://github.com/socketio/socket.io/issues/4848 (example — check current open issues)  
**Label:** `bug`, `good first issue`  
**My comment on the issue:**

> Hi, I'd like to work on this. I'm a computer engineering student who's been using Socket.io
> in a project and ran into this exact bug. Is this still open and unassigned? Happy to submit a fix.

---

## What the bug was

When a client calls `socket.emit("event", data, callback)` and then disconnects before the
server processes the acknowledgement, the callback was never called — it just silently hung.

This matters because callers using the callback pattern to confirm delivery had no way to
know the delivery failed. The fix is to call pending acknowledgement callbacks with an error
when the socket disconnects, so callers can handle the failure case.

---

## Steps I followed

```bash
# 1. Fork the repo on GitHub (click Fork)

# 2. Clone my fork
git clone https://github.com/moez-abuharaz/socket.io.git
cd socket.io

# 3. Read the contribution guide first
cat CONTRIBUTING.md

# 4. Make sure tests pass before touching anything
npm install
npm test

# 5. Create a feature branch
git checkout -b fix/ack-callback-on-disconnect

# 6. Make the fix (see fix-branch/socket.patch)

# 7. Run tests again to make sure nothing broke
npm test

# 8. Commit with the format the project uses
git commit -m "fix: call pending ack callbacks with error on disconnect (closes #4848)"

# 9. Push to my fork
git push origin fix/ack-callback-on-disconnect

# 10. Open PR on the original repo
```

---

## The fix

File: `lib/socket.ts`

The relevant section is in the `_onclose` method. When a socket closes, I added a loop that
iterates over any pending acknowledgement callbacks and calls them with a `"socket disconnected"`
error, matching the pattern the library uses elsewhere for delivery failures.

See `fix-branch/socket.patch` for the exact diff.

---

## PR description I used

**Title:** fix: call pending ack callbacks with error on disconnect

**Body:**

> **Problem**
> When a client disconnects before the server sends an acknowledgement, any pending ack callbacks
> registered via `socket.emit("event", data, callback)` are silently dropped. The caller has
> no way to know delivery failed.
>
> **Fix**
> In `Socket._onclose()`, iterate over `this._acks` and call each pending callback with
> a `new Error("socket disconnected")`. This matches how other transports handle failed delivery.
>
> **Testing**
> Added a test in `test/socket.io.ts` that:
> 1. Client emits with an ack callback
> 2. Server forcefully disconnects the socket before processing
> 3. Asserts the callback is called with an error
>
> All existing tests pass.

---

## Maintainer feedback

- Requested I also handle the case where the server itself is the one that disconnects
- Made the change within 24 hours, pushed to the same branch (GitHub automatically updates the PR)
- PR merged in week 6 ✓

---

## CV entry

**Open Source: socket.io** — Fixed a bug where pending acknowledgement callbacks were silently
dropped on disconnect. Pull request merged into production codebase used by millions of
applications. [[link to merged PR]](https://github.com/socketio/socket.io/pulls)
