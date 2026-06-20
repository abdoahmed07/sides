# WebSockets vs HTTP: what I learned building a real-time app

Here's the concrete difference between HTTP and WebSockets, explained using a real feature
I built: live comment updates in a code review tool.

---

## The problem with HTTP for real-time updates

In a normal HTTP request, the client asks and the server answers. One request, one response,
connection closed. That's the model.

If I want to show new comments as they're posted — without the user refreshing — I have a few
options with plain HTTP:

**Polling:** the frontend asks the server every 2 seconds, "any new comments?" The server
either says "yes, here they are" or "no, nothing new." This works but it's wasteful — most of
those requests will get back an empty response. At 100 users on the same snippet, that's 3,000
requests per minute for data that doesn't exist yet.

**Long polling:** the frontend makes a request and the server just... holds it open until there's
something to send. When a new comment arrives, the server responds with it and the client
immediately opens a new request. Better than regular polling but awkward to implement.

## What WebSockets actually do differently

A WebSocket is a persistent, bidirectional connection. Here's what happens:

1. The browser makes a normal HTTP request with an `Upgrade: websocket` header
2. The server responds with `101 Switching Protocols`
3. The TCP connection stays open and both sides can send messages any time, in either direction

In my code review app, when a user opens a snippet page, this happens:

```javascript
// Frontend — join the room for this snippet
const socket = io("http://localhost:3000");
socket.emit("join_snippet", { shareId: "abc123" });

// Listen for new comments from other users
socket.on("new_comment", (comment) => {
  setComments((prev) => [...prev, comment]);
});
```

On the backend, when someone posts a comment, I emit it to everyone in that snippet's room:

```javascript
// Backend — after saving the comment to PostgreSQL
io.to(`snippet:${shareId}`).emit("new_comment", newComment);
```

No polling. No repeated requests. The server pushes the comment to everyone the instant it's
saved. If 50 people are viewing the same snippet, they all see the comment within milliseconds.

## The thing I didn't expect: presence

The bidirectional nature of WebSockets made the "X people viewing" feature really easy to add.
When a user opens a snippet page, the client sends a `join_snippet` event. When they leave or
close the tab, the client sends `leave_snippet` (or the socket just disconnects).

I couldn't have done this cleanly with HTTP. With polling, I'd have no reliable way to know
when a user left — they'd just stop making requests, and I'd have to expire their "presence"
after some timeout.

## When to use which

Use HTTP for: loading a page, submitting a form, fetching data on demand.

Use WebSockets for: anything where the server needs to push data to clients without them
asking, or where you need the client to send and receive at any time. Chat, live cursors,
notifications, collaborative editing, real-time dashboards.

I'm currently working on the authentication layer for the same app — JWT tokens. I'll write
about that in two weeks.
