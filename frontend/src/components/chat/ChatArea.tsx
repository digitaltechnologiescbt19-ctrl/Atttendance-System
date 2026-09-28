import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

export interface ChatMessageItem {
  id?: string | number;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ChatAreaProps {
  messages: ChatMessageItem[];
  loading: boolean;
  onSelectPrompt?: (prompt: string) => void;
  roleName?: string;
  userName?: string;
}

export default function ChatArea({
  messages,
  loading,
  onSelectPrompt,
  roleName = "User",
  userName = "User",
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

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
          "Summarize attendance for my courses",
          "When is my next lecture?",
        ]
      : [
          "Give me an institution attendance summary",
          "How many total students and lecturers are registered?",
          "Show course enrollment statistics across the institution",
          "How many user accounts are pending activation?",
        ];

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
            Select a common topic below or type your question in the box to begin.
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
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 960, width: "100%", margin: "0 auto" }}>
          {messages.map((msg, index) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  width: "100%",
                }}
              >
                <div style={{
                  maxWidth: "85%",
                  background: isUser ? "var(--accent)" : "var(--bg-surface)",
                  color: isUser ? "#ffffff" : "var(--text-primary)",
                  border: isUser ? "none" : "1px solid var(--border-default)",
                  borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  padding: "0.75rem 1rem",
                  fontSize: "var(--tx-base)",
                  lineHeight: 1.6,
                }}>
                  {isUser ? (
                    <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                  ) : (
                    <div className="markdown-content">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  {msg.timestamp && (
                    <div style={{
                      fontSize: "var(--tx-xs)",
                      color: isUser ? "rgba(255, 255, 255, 0.75)" : "var(--text-muted)",
                      marginTop: "0.35rem",
                      textAlign: isUser ? "right" : "left",
                    }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
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