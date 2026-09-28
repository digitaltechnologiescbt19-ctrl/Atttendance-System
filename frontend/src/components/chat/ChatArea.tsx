import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  HiOutlineClipboard,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineArrowPath,
  HiCheck,
} from "react-icons/hi2";

export interface ChatMessageItem {
  id?: string | number;
  role: "user" | "assistant";
  content: string;
  action_required?: {
    tool: string;
    args: Record<string, any>;
    description: string;
  };
  timestamp?: string;
  isError?: boolean;
  failedPrompt?: string;
}

interface ChatAreaProps {
  messages: ChatMessageItem[];
  loading: boolean;
  onSelectPrompt?: (prompt: string) => void;
  onConfirmAction?: (action: { tool: string; args: Record<string, any> }) => void;
  onDeleteMessage?: (id: string | number) => void;
  onEditMessage?: (id: string | number, newContent: string) => void;
  onRetryMessage?: (failedPrompt: string) => void;
  roleName?: string;
  userName?: string;
}

export default function ChatArea({
  messages,
  loading,
  onSelectPrompt,
  onConfirmAction,
  onDeleteMessage,
  onEditMessage,
  onRetryMessage,
  roleName = "User",
  userName = "User",
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const defaultPrompts =
    roleName.toLowerCase() === "student"
      ? [
          "What is my overall attendance percentage?",
          "What is my lowest course attendance?",
          "When is my next class?",
          "What courses am I currently taking?",
        ]
      : roleName.toLowerCase() === "lecturer"
      ? [
          "What courses do I teach?",
          "Which students attended my class today?",
          "Create session for CS101",
          "When is my next lecture?",
        ]
      : [
          "Give me an institution attendance summary",
          "How many total students and lecturers are registered?",
          "Create a new course",
          "How many user accounts are pending activation?",
        ];

  function handleCopy(id: string | number | undefined, text: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (id !== undefined) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  }

  function startEditing(msg: ChatMessageItem) {
    if (!msg.id) return;
    setEditingId(msg.id);
    setEditText(msg.content);
  }

  function saveEdit(id: string | number) {
    if (!editText.trim()) return;
    onEditMessage?.(id, editText.trim());
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  return (
    <div style={{
      flex: 1,
      overflowY: "auto",
      padding: "1rem var(--sp-4)",
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
    }}>
      {messages.length === 0 ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem var(--sp-4)",
          textAlign: "center",
          margin: "auto 0",
        }}>
          <h2 style={{ fontSize: "var(--tx-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.35rem" }}>
            Welcome, {userName}
          </h2>
          <p style={{ fontSize: "var(--tx-sm)", color: "var(--text-secondary)", maxWidth: 520, lineHeight: 1.5, marginBottom: "1.5rem" }}>
            Select a common topic below or type your question in the search box to begin.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "0.75rem",
            maxWidth: 640,
            width: "100%",
          }}>
            {defaultPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt?.(prompt)}
                className="btn-secondary"
                style={{
                  padding: "0.75rem 1rem",
                  fontSize: "var(--tx-sm)",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  textAlign: "left",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  cursor: "pointer",
                  transition: "border-color var(--t-fast)",
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 960, width: "100%", margin: "0 auto" }}>
          {messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const msgId = msg.id ?? index;
            const isEditing = editingId === msgId;

            return (
              <div
                key={index}
                className="chat-message-group"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  width: "100%",
                  position: "relative",
                }}
              >
                {/* Message Bubble Container */}
                <div
                  className="chat-bubble"
                  style={{
                    maxWidth: "85%",
                    position: "relative",
                    background: isUser ? "var(--accent)" : msg.isError ? "var(--bg-surface)" : "var(--bg-surface)",
                    color: isUser ? "#ffffff" : "var(--text-primary)",
                    border: isUser ? "none" : msg.isError ? "1px solid #ef4444" : "1px solid var(--border-default)",
                    borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    padding: "0.75rem 1rem",
                    fontSize: "var(--tx-base)",
                    lineHeight: 1.6,
                    boxShadow: "var(--shadow-xs)",
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 260 }}>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-default)",
                          background: "#ffffff",
                          color: "#111827",
                          fontFamily: "inherit",
                          fontSize: "var(--tx-sm)",
                        }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => saveEdit(msgId)}
                          style={{
                            padding: "4px 10px",
                            fontSize: "var(--tx-xs)",
                            borderRadius: "var(--radius-sm)",
                            background: "#ffffff",
                            color: "var(--accent)",
                            border: "none",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Save & Resend
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          style={{
                            padding: "4px 10px",
                            fontSize: "var(--tx-xs)",
                            borderRadius: "var(--radius-sm)",
                            background: "rgba(255,255,255,0.2)",
                            color: "#ffffff",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : isUser ? (
                    <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                  ) : (
                    <div>
                      <div className="markdown-content">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>

                      {/* Side-Effect Confirmation Bar */}
                      {msg.action_required && (
                        <div style={{
                          marginTop: "0.85rem",
                          padding: "0.75rem 1rem",
                          background: "var(--accent-subtle)",
                          border: "1px solid var(--accent-border)",
                          borderRadius: "var(--radius-md)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}>
                          <div style={{ fontSize: "var(--tx-xs)", fontWeight: 600, color: "var(--accent)" }}>
                            ⚡ Action Required: {msg.action_required.description}
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={() => onConfirmAction?.({ tool: msg.action_required!.tool, args: msg.action_required!.args })}
                              className="btn-primary"
                              style={{
                                padding: "4px 14px",
                                fontSize: "var(--tx-xs)",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                              }}
                            >
                              Confirm Action
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteMessage?.(msgId)}
                              className="btn-secondary"
                              style={{
                                padding: "4px 14px",
                                fontSize: "var(--tx-xs)",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Retry Button on Error */}
                      {msg.isError && msg.failedPrompt && (
                        <div style={{ marginTop: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => onRetryMessage?.(msg.failedPrompt!)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              padding: "4px 10px",
                              fontSize: "var(--tx-xs)",
                              borderRadius: "var(--radius-sm)",
                              background: "#ef4444",
                              color: "#ffffff",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            <HiOutlineArrowPath /> Retry
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Action Toolbar (WhatsApp-Style Hover Menu) */}
                  <div
                    className="chat-actions-toolbar"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      marginTop: "0.35rem",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                      fontSize: "var(--tx-xs)",
                      color: isUser ? "rgba(255, 255, 255, 0.75)" : "var(--text-muted)",
                    }}
                  >
                    <span>
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>

                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={() => handleCopy(msgId, msg.content)}
                      title="Copy text"
                      style={{
                        background: "none",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        padding: "2px 4px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "2px",
                      }}
                    >
                      {copiedId === msgId ? <HiCheck style={{ color: "#22c55e" }} /> : <HiOutlineClipboard />}
                      {copiedId === msgId && <span style={{ fontSize: "10px" }}>Copied</span>}
                    </button>

                    {/* User Edit Button */}
                    {isUser && msg.id && (
                      <button
                        type="button"
                        onClick={() => startEditing(msg)}
                        title="Edit message"
                        style={{
                          background: "none",
                          border: "none",
                          color: "inherit",
                          cursor: "pointer",
                          padding: "2px 4px",
                        }}
                      >
                        <HiOutlinePencilSquare />
                      </button>
                    )}

                    {/* Delete Button */}
                    {msg.id && (
                      <button
                        type="button"
                        onClick={() => onDeleteMessage?.(msg.id!)}
                        title="Delete message"
                        style={{
                          background: "none",
                          border: "none",
                          color: "inherit",
                          cursor: "pointer",
                          padding: "2px 4px",
                        }}
                      >
                        <HiOutlineTrash />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: "12px 12px 12px 2px",
                padding: "0.75rem 1rem",
                color: "var(--text-secondary)",
                fontSize: "var(--tx-sm)",
              }}>
                Loading response...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}