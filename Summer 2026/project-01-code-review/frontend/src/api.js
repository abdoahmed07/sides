// Thin API wrapper — all fetch calls go through here
// I centralize this so I can easily change the base URL or add error handling in one place

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function request(path, options = {}, token = null) {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    // Throw with the server's error message so UI components can display it
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),

  // Snippets
  createSnippet: (body, token) =>
    request("/api/snippets", { method: "POST", body: JSON.stringify(body) }, token),
  getSnippet: (shareId, token) => request(`/api/snippets/${shareId}`, {}, token),
  listSnippets: (token) => request("/api/snippets", {}, token),

  // Comments
  postComment: (body, token) =>
    request("/api/comments", { method: "POST", body: JSON.stringify(body) }, token),
  deleteComment: (id, token) =>
    request(`/api/comments/${id}`, { method: "DELETE" }, token),
};
