// Reusable comment form — used for both inline comments and sidebar replies
// Simple textarea with submit/cancel buttons

import { useState, useEffect, useRef } from "react";

export default function CommentForm({ onSubmit, onCancel, placeholder, autoFocus }) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    await onSubmit(body.trim());
    setBody("");
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder || "Leave a comment..."}
        rows={3}
        className="w-full bg-gray-900 border border-gray-700 focus:border-blue-500 rounded-md px-3 py-2 text-white text-sm resize-none focus:outline-none"
        onKeyDown={(e) => {
          // Cmd/Ctrl + Enter submits — feels natural
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit(e);
          if (e.key === "Escape") onCancel?.();
        }}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!body.trim() || submitting}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-md font-medium"
        >
          {submitting ? "Posting..." : "Comment"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-300 text-xs"
          >
            Cancel
          </button>
        )}
        <span className="text-gray-700 text-xs ml-auto">⌘↵ to submit</span>
      </div>
    </form>
  );
}
