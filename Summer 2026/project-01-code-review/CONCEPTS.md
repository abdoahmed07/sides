# Project 01 — Concepts Reference

A glossary of every concept used in this project, with plain-english explanations and examples.

---

## React

### JSX
JavaScript XML. Lets you write HTML-like syntax inside JavaScript. Vite converts it to real JavaScript before the browser runs it.
```jsx
// This is JSX — looks like HTML but it's JavaScript
const element = <div className="text-white">Hello</div>;
```

---

### Component
A function that returns JSX. The building block of every React app. Each component is its own piece of UI.
```jsx
function Navbar() {
  return <nav>CodeReview</nav>;
}
```

---

### Props
Data passed from a parent component to a child, like function arguments.
```jsx
// Parent passes name down
<CommentForm placeholder="Write a comment..." />

// Child receives it
function CommentForm({ placeholder }) {
  return <textarea placeholder={placeholder} />;
}
```

---

### useState
A variable that, when changed, causes the component to re-render. Used for anything on screen that can change.
```jsx
const [selectedLine, setSelectedLine] = useState(null);

// Reading it
console.log(selectedLine); // null

// Changing it (triggers re-render)
setSelectedLine(5);
console.log(selectedLine); // 5
```

---

### useEffect
Runs code *after* the component renders. Used for fetching data on load, setting up connections, etc.
```jsx
useEffect(() => {
  // Runs after the page appears
  api.listSnippets(token).then(setSnippets);
}, [token]); // Re-runs if token changes
```
The array at the end is the **dependency array**. The effect only re-runs if one of those values changes.

---

### useRef
A reference to a DOM element or a value that doesn't cause re-renders when it changes. Used when you need to directly touch an element (like scrolling to it) or hold something like a socket connection.
```jsx
const socketRef = useRef(null);
socketRef.current = io(API_URL); // store the connection

const lineRefs = useRef({});
// Later: scroll to a specific line
lineRefs.current[5].scrollIntoView({ behavior: "smooth" });
```

---

### useCallback
Wraps a function so it doesn't get recreated on every render. Used when passing functions as props to child components to avoid unnecessary re-renders.
```jsx
const handlePostComment = useCallback(async (body) => {
  await api.postComment({ body }, token);
}, [token]); // Only recreate if token changes
```

---

### Context
A way to share data across the whole app without passing props through every layer. Think of it as a global variable any component can read.

**Creating it:**
```jsx
export const AuthContext = createContext(null);
```

**Providing it (wraps the whole app):**
```jsx
<AuthContext.Provider value={{ token, user, login, logout }}>
  <App />
</AuthContext.Provider>
```

**Reading it from anywhere:**
```jsx
const { token, user } = useContext(AuthContext);
```

---

### useAuth (custom hook)
A shortcut helper built on top of `useContext`. Instead of importing both `useContext` and `AuthContext` everywhere, you just call `useAuth()`.
```jsx
// Definition in App.jsx
export function useAuth() {
  return useContext(AuthContext);
}

// Usage anywhere in the app
const { token, isLoggedIn, login, logout } = useAuth();
```

---

### React Router
Library that maps URLs to components. No page reload happens; React swaps the component based on the URL.
```jsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/review/:shareId" element={<ReviewPage />} />
</Routes>
```

---

### useParams
Reads the variable parts of the URL (the ones with `:` in the route path).
```jsx
// URL: /review/aB3xKp
const { shareId } = useParams();
console.log(shareId); // "aB3xKp"
```

---

### useNavigate
Programmatically sends the user to a different page.
```jsx
const navigate = useNavigate();
navigate(`/review/${snippet.share_id}`); // redirect after creating snippet
```

---

### useSearchParams
Reads query parameters from the URL (the `?key=value` part).
```jsx
// URL: /login?redirect=/review/aB3xKp
const [searchParams] = useSearchParams();
const redirect = searchParams.get("redirect"); // "/review/aB3xKp"
```

---

### Optimistic Update
Adding data to local state immediately, before the server confirms it, so the UI feels instant. If the request fails you'd roll it back. Here we skip that since failure is rare.
```jsx
// Add comment to screen right away
setComments((prev) => [...prev, newComment]);

// Then the server saves it and Socket.io broadcasts to others
```

---

### prev (functional state update)
When you pass a function to a state setter, React gives you the current state as the argument. Named `prev` by convention. Safer than using the state variable directly when multiple updates could happen at once.
```jsx
// Safer than setComments([...comments, newComment])
setComments((prev) => [...prev, newComment]);
```

---

## Backend

### Node.js
JavaScript runtime that lets you run JavaScript outside the browser, on a server.

---

### Express
A Node.js framework for building HTTP servers. Handles incoming requests and sends back responses.
```js
const app = express();

app.get("/api/snippets/:shareId", (req, res) => {
  res.json({ snippet: "..." });
});
```

---

### REST API
A pattern for building server endpoints. The frontend makes HTTP requests (`GET`, `POST`, `DELETE`) to URLs like `/api/snippets` and gets JSON back.

| Method | URL | What it does |
|--------|-----|--------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Log in, get token |
| POST | /api/snippets | Create a snippet |
| GET | /api/snippets/:id | Get a snippet |
| POST | /api/comments | Post a comment |

---

### PostgreSQL
A relational database. Stores data in tables with rows and columns. This project has three tables: `users`, `snippets`, `comments`.

---

### JWT (JSON Web Token)
A signed token the server gives you after login. You send it with every request that needs authentication. The server verifies the signature to confirm it's real without hitting the database.
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

### bcryptjs
Hashes passwords before saving them to the database. Hashing is one-way; you can't reverse it back to the original password.
```js
const hash = await bcrypt.hash("mypassword", 10);
// hash = "$2a$10$..." (can't reverse this)

const match = await bcrypt.compare("mypassword", hash);
// match = true
```

---

### Socket.io
Library for real-time two-way communication between server and browser. Keeps a persistent connection (WebSocket) open so the server can push data instantly without the browser asking for it.

**Server:**
```js
io.to(shareId).emit("new_comment", comment); // broadcast to all viewers
```

**Client:**
```js
socket.on("new_comment", (comment) => {
  setComments((prev) => [...prev, comment]); // update UI instantly
});
```

---

### Rooms (Socket.io)
A way to group socket connections. When you open a snippet, your socket joins a room named after the snippet's shareId. The server only broadcasts to sockets in the same room, so comments on snippet A don't appear on snippet B.
```js
socket.join(shareId);         // join the room
io.to(shareId).emit("...");   // send to everyone in that room
```

---

### CORS (Cross-Origin Resource Sharing)
A browser security rule that blocks requests from one domain to another unless the server explicitly allows it. Since the frontend (Vercel) and backend (Railway) are on different domains, the backend must say "I allow requests from this frontend URL."
```js
app.use(cors({ origin: process.env.FRONTEND_URL }));
```

---

### Vite Proxy
In development, the frontend and backend run on different ports (5173 and 3000). To avoid CORS, Vite forwards `/api` requests from the frontend to the backend automatically.
```js
// vite.config.js
proxy: {
  "/api": "http://localhost:3000",
  "/socket.io": { target: "http://localhost:3000", ws: true }
}
```

---

### Environment Variables (.env)
Config values kept outside your code so they're not committed to GitHub. Things like database passwords and secret keys.
```
DATABASE_URL=postgresql://...
JWT_SECRET=some-random-string
FRONTEND_URL=http://localhost:5174
```
Accessed in code as `process.env.DATABASE_URL`.

---

### crypto.randomBytes
Node.js built-in for generating random IDs. Used for snippet share IDs instead of a third-party package.
```js
const shareId = randomBytes(6).toString("base64url");
// shareId = "aB3xKp8Q" — random, URL-safe, 8 chars
```

---

## Deployment

### Vercel
Hosts the frontend. Takes your React/Vite code, builds it into static HTML/CSS/JS files, and serves them from a global CDN so they load fast everywhere.

### Railway
Hosts the backend (Node.js server) and the PostgreSQL database. A real always-on server, needed because Socket.io requires a persistent connection that serverless platforms like Vercel can't hold open.

---

## General

### highlight.js
Library that takes a code string and wraps keywords, strings, etc. in `<span>` tags with CSS classes for syntax highlighting colors.
```js
const result = hljs.highlight(code, { language: "javascript" });
// result.value = HTML string with <span class="hljs-keyword">const</span> etc.
```

### dangerouslySetInnerHTML
React's way of injecting raw HTML into the DOM. Named "dangerously" to make you think twice. Safe here because highlight.js output is trusted, not user input.
```jsx
<span dangerouslySetInnerHTML={{ __html: lineHtml }} />
```

### FileReader
Browser built-in that reads a file the user dropped or selected and gives you its contents as a string.
```js
const reader = new FileReader();
reader.onload = (e) => setCode(e.target.result);
reader.readAsText(file);
```
