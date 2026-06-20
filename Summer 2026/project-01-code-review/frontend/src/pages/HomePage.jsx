// Homepage — shows recent snippets if logged in, landing page if not

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../App";

export default function HomePage() {
  const { token, isLoggedIn } = useAuth();
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    api.listSnippets(token)
      .then(setSnippets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isLoggedIn, token]);

  if (!isLoggedIn) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Code review, instantly
        </h1>
        <p className="text-gray-400 text-lg mb-10">
          Paste code, share the link, and leave inline comments in real time —
          no setup, no PRs, no waiting.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/register"
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-md font-medium"
          >
            Get started for free
          </Link>
          <Link to="/login" className="text-gray-400 hover:text-white">
            Sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-white">Your reviews</h1>
        <Link
          to="/new"
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          + New review
        </Link>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && snippets.length === 0 && (
        <div className="text-center py-20 text-gray-600">
          <p className="mb-4">No reviews yet.</p>
          <Link to="/new" className="text-blue-400 hover:underline">
            Create your first one →
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {snippets.map((s) => (
          <Link
            key={s.id}
            to={`/review/${s.share_id}`}
            className="block bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-5 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-white font-medium truncate">
                  {s.title || s.code_preview || "Untitled"}
                </p>
                <p className="text-gray-500 text-sm mt-0.5">
                  {s.language} · {new Date(s.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="shrink-0 text-sm text-gray-600">
                {s.comment_count} comment{s.comment_count !== "1" ? "s" : ""}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
