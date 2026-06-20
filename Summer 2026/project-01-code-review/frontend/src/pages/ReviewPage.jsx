// The main review page — code viewer on the left, comment sidebar on the right
// This is the most complex component in the whole app

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import hljs from "highlight.js";
import { io } from "socket.io-client";
import { api } from "../api";
import { useAuth } from "../App";
import CommentSidebar from "../components/CommentSidebar";
import CommentForm from "../components/CommentForm";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function ReviewPage() {
  const { shareId } = useParams();
  const { token, user } = useAuth();

  const [snippet, setSnippet] = useState(null);
  const [comments, setComments] = useState([]);
  const [selectedLine, setSelectedLine] = useState(null); // which line has the comment form open
  const [viewerCount, setViewerCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const socketRef = useRef(null);
  const lineRefs = useRef({}); // ref map so I can scrollIntoView from the sidebar

  // Load the snippet and its comments on mount
  useEffect(() => {
    async function load() {
      try {
        const data = await api.getSnippet(shareId, token);
        setSnippet(data.snippet);
        setComments(data.comments);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [shareId, token]);

  // Set up Socket.io after snippet loads
  useEffect(() => {
    if (!snippet) return;

    const socket = io(API_URL);
    socketRef.current = socket;

    socket.emit("join_snippet", { shareId, user: user || null });

    // New comment from another user — add it to the list
    socket.on("new_comment", (comment) => {
      setComments((prev) => {
        // Avoid duplicates (our own comments are added optimistically in postComment)
        if (prev.some((c) => c.id === comment.id)) return prev;
        return [...prev, comment];
      });
    });

    // Presence update — how many people are viewing this snippet
    socket.on("presence_update", ({ count }) => {
      setViewerCount(count);
    });

    return () => {
      socket.emit("leave_snippet", { shareId });
      socket.disconnect();
    };
  }, [snippet?.id, shareId, user]);

  // Post a new comment on the selected line
  const handlePostComment = useCallback(
    async (body, parentId = null) => {
      if (!token) return;

      try {
        const newComment = await api.postComment(
          {
            snippet_share_id: shareId,
            line_number: selectedLine,
            body,
            parent_id: parentId,
          },
          token
        );

        // Optimistic update — add it locally right away
        // Socket.io will emit it to other viewers
        setComments((prev) => {
          if (prev.some((c) => c.id === newComment.id)) return prev;
          return [...prev, newComment];
        });

        if (!parentId) setSelectedLine(null); // close the inline form after top-level comment
      } catch (err) {
        console.error("Failed to post comment:", err);
      }
    },
    [shareId, selectedLine, token]
  );

  // Scroll to a line when a comment in the sidebar is clicked
  const scrollToLine = useCallback((lineNumber) => {
    const el = lineRefs.current[lineNumber];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setSelectedLine(lineNumber);
    }
  }, []);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">{error}</div>
    );
  }

  // Split the code into lines for rendering with line numbers
  const lines = snippet.code.split("\n");

  // Get comment count per line for the gutter indicators
  const commentsByLine = comments.reduce((acc, c) => {
    if (!c.parent_id) { // only top-level comments show in the gutter
      acc[c.line_number] = (acc[c.line_number] || 0) + 1;
    }
    return acc;
  }, {});

  const highlighted = hljs.highlight(snippet.code, {
    language: snippet.language,
    ignoreIllegals: true,
  });

  // Split the highlighted HTML by line — a bit tricky because hljs doesn't know about lines
  // I render it as plain text with syntax classes per line
  const highlightedLines = highlighted.value.split("\n");

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Code panel */}
      <div className="flex-1 overflow-auto bg-gray-950">
        {/* Header bar */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold">
              {snippet.title || "Untitled review"}
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {snippet.language} · {snippet.author_name} ·{" "}
              {new Date(snippet.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {/* Viewer count */}
            <div className="flex items-center gap-1.5 text-gray-500">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {viewerCount} viewing
            </div>
            <button
              onClick={copyLink}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-md text-sm"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>

        {/* Code with line numbers */}
        <pre className="font-mono text-sm leading-6 p-0">
          <code className={`hljs language-${snippet.language}`}>
            {highlightedLines.map((lineHtml, idx) => {
              const lineNum = idx + 1;
              const isSelected = selectedLine === lineNum;
              const hasComments = !!commentsByLine[lineNum];

              return (
                <div key={lineNum}>
                  <div
                    ref={(el) => { lineRefs.current[lineNum] = el; }}
                    className={`flex group hover:bg-gray-800 cursor-pointer ${
                      isSelected ? "bg-blue-950 border-l-2 border-blue-500" : ""
                    } ${hasComments ? "border-l-2 border-yellow-600/50" : "border-l-2 border-transparent"}`}
                    onClick={() => {
                      // Toggle the comment form on click
                      setSelectedLine(isSelected ? null : lineNum);
                    }}
                  >
                    {/* Line number gutter */}
                    <span className="select-none w-12 shrink-0 text-right pr-4 py-0.5 text-gray-600 group-hover:text-gray-400 text-xs leading-6">
                      {lineNum}
                    </span>
                    {/* Comment indicator dot */}
                    <span className="w-4 shrink-0 flex items-center justify-center">
                      {hasComments && (
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" title={`${commentsByLine[lineNum]} comment(s)`} />
                      )}
                    </span>
                    {/* Code content */}
                    <span
                      className="flex-1 py-0.5 pr-4 whitespace-pre"
                      dangerouslySetInnerHTML={{ __html: lineHtml || " " }}
                    />
                  </div>

                  {/* Inline comment form appears below the selected line */}
                  {isSelected && token && (
                    <div className="ml-16 my-2 mr-4">
                      <CommentForm
                        onSubmit={(body) => handlePostComment(body, null)}
                        onCancel={() => setSelectedLine(null)}
                        placeholder={`Comment on line ${lineNum}...`}
                        autoFocus
                      />
                    </div>
                  )}
                  {isSelected && !token && (
                    <div className="ml-16 my-2 mr-4 text-sm text-gray-500">
                      <a href="/login" className="text-blue-400 hover:underline">Sign in</a> to leave a comment
                    </div>
                  )}
                </div>
              );
            })}
          </code>
        </pre>
      </div>

      {/* Comment sidebar */}
      <CommentSidebar
        comments={comments}
        onCommentClick={scrollToLine}
        onReply={(parentId, lineNumber, body) => {
          setSelectedLine(lineNumber);
          handlePostComment(body, parentId);
        }}
        currentUserId={user?.id}
        token={token}
      />
    </div>
  );
}
