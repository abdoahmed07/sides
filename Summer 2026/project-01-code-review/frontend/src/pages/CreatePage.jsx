// Create a new code snippet
// User pastes code or uploads a file, picks a language, optionally sets a title, submits
// On success they're redirected to the review page for that snippet

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../App";

// Languages supported by highlight.js that I want to offer in the dropdown
const LANGUAGES = [
  "plaintext", "javascript", "typescript", "jsx", "tsx",
  "python", "java", "c", "cpp", "go", "rust", "bash", "sql",
  "html", "css", "json", "yaml", "markdown",
];

export default function CreatePage() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("plaintext");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const { token } = useAuth();
  const navigate = useNavigate();

  // Read a dropped or selected file and put its contents into the code textarea
  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCode(e.target.result);
      // Try to auto-detect language from file extension
      const ext = file.name.split(".").pop().toLowerCase();
      const extMap = {
        js: "javascript", ts: "typescript", jsx: "jsx", tsx: "tsx",
        py: "python", java: "java", c: "c", cpp: "cpp", h: "cpp",
        go: "go", rs: "rust", sh: "bash", sql: "sql",
        html: "html", css: "css", json: "json", yml: "yaml", yaml: "yaml",
        md: "markdown",
      };
      if (extMap[ext]) setLanguage(extMap[ext]);
      if (!title) setTitle(file.name); // use filename as title if none set
    };
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return setError("Paste some code first");
    setError("");
    setLoading(true);

    try {
      const snippet = await api.createSnippet({ code, language, title }, token);
      navigate(`/review/${snippet.share_id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-8">New code review</h1>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-md px-4 py-3 mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title field — optional */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 'auth middleware review'"
            className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Language picker */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* Code textarea with drag-and-drop overlay */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Code</label>
          <div
            className={`relative rounded-md border-2 ${
              dragging ? "border-blue-500 bg-blue-900/10" : "border-gray-700"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here, or drag and drop a file..."
              rows={20}
              className="w-full bg-gray-900 rounded-md px-4 py-3 text-gray-200 font-mono text-sm resize-none focus:outline-none"
              spellCheck={false}
            />
            {dragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-md pointer-events-none">
                <p className="text-blue-400 font-medium">Drop file to load</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 text-sm text-gray-500 hover:text-gray-300"
          >
            Or click to upload a file →
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.go,.rs,.sh,.sql,.html,.css,.json,.yml,.yaml,.md,.txt"
            onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-md font-medium text-sm"
        >
          {loading ? "Creating..." : "Create review →"}
        </button>
      </form>
    </div>
  );
}
