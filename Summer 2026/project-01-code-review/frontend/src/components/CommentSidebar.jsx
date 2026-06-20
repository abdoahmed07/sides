// Sidebar showing all comments ordered by line number
// Clicking a comment scrolls the code to that line
// Replies are nested under their parent

import { useState } from "react";
import CommentForm from "./CommentForm";

// Format a timestamp to a human-readable relative string
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Avatar({ name }) {
  return (
    <div className="w-6 h-6 rounded-full bg-blue-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function Comment({ comment, replies, onCommentClick, onReply, currentUserId, token }) {
  const [replying, setReplying] = useState(false);

  return (
    <div
      className="group cursor-pointer"
      onClick={(e) => {
        // Don't trigger scroll when clicking the reply form
        if (e.target.closest("form") || e.target.closest("button")) return;
        onCommentClick(comment.line_number);
      }}
    >
      <div className="flex gap-2">
        <Avatar name={comment.author_name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-white text-xs font-medium">{comment.author_name || "Anonymous"}</span>
            <span className="text-gray-600 text-xs">line {comment.line_number}</span>
            <span className="text-gray-700 text-xs ml-auto">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-gray-300 text-sm mt-1 break-words">{comment.body}</p>

          {/* Reply button */}
          {token && (
            <button
              onClick={(e) => { e.stopPropagation(); setReplying(!replying); }}
              className="text-gray-600 hover:text-gray-400 text-xs mt-1"
            >
              {replying ? "Cancel" : "Reply"}
            </button>
          )}

          {replying && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <CommentForm
                onSubmit={(body) => {
                  onReply(comment.id, comment.line_number, body);
                  setReplying(false);
                }}
                onCancel={() => setReplying(false)}
                placeholder="Write a reply..."
                autoFocus
              />
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {replies.length > 0 && (
        <div className="ml-8 mt-2 space-y-3 border-l border-gray-800 pl-3">
          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-2">
              <Avatar name={reply.author_name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-xs font-medium">{reply.author_name || "Anonymous"}</span>
                  <span className="text-gray-700 text-xs ml-auto">{timeAgo(reply.created_at)}</span>
                </div>
                <p className="text-gray-300 text-sm mt-1 break-words">{reply.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentSidebar({ comments, onCommentClick, onReply, currentUserId, token }) {
  // Build a tree: top-level comments with their replies attached
  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = comments.filter((c) => c.parent_id);

  const repliesByParent = replies.reduce((acc, r) => {
    if (!acc[r.parent_id]) acc[r.parent_id] = [];
    acc[r.parent_id].push(r);
    return acc;
  }, {});

  return (
    <div className="w-80 shrink-0 border-l border-gray-800 bg-gray-950 overflow-y-auto flex flex-col">
      <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-300">
          Comments ({topLevel.length})
        </h2>
      </div>

      {topLevel.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-700 text-sm px-6 text-center">
          Click any line in the code to leave a comment
        </div>
      ) : (
        <div className="space-y-5 p-4">
          {topLevel.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              replies={repliesByParent[comment.id] || []}
              onCommentClick={onCommentClick}
              onReply={onReply}
              currentUserId={currentUserId}
              token={token}
            />
          ))}
        </div>
      )}
    </div>
  );
}
