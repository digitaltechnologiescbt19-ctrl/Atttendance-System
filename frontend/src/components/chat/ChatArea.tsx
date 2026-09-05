import { useEffect, useRef } from "react";
import { HiOutlineSparkles, HiOutlineUser, HiOutlineClock } from "react-icons/hi2";
import ReactMarkdown from "react-markdown";

export interface ChatMessageItem {
  id?: string;
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
          "📅 When is my next class?",
          "📊 What is my overall attendance percentage?",
          "📝 Show my attendance summary",
          "❓ Did I attend today's lecture?",
        ]
      : roleName.toLowerCase() === "lecturer"
      ? [
          "👥 How many students attended my class today?",
          "⚠️ Which students have low attendance?",
          "📚 Summarize attendance for my courses",
          "⏰ When is my next lecture?",
        ]
      : [
          "🎓 How many total students are registered?",
          "📈 Show overall institute attendance stats",
          "🔒 How many accounts are pending activation?",
          "🏢 Summarize today's attendance across institute",
        ];

  return (
    <div style={{
      flex: 1,
      overflowY: "auto",
      padding: "1.5rem var(--sp-6)",
      display: "flex",
      flexDirection: "column",
      gap: "1.25rem",
      background: "var(--bg-app)",
    }}>
      {messages.length === 0 ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "360px",
          textAlign: "center",
          margin: "auto 0",
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: "var(--radius-xl)",
            background: "var(--accent-subtle)",
            border: "1px solid var(--accent-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
            fontSize: "2rem",
            marginBottom: "1.25rem",
            boxShadow: "var(--shadow-md)",
          }}>
            <HiOutlineSparkles />
          </div>

          <h2 style={{ fontSize: "var(--tx-xl)", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            Welcome, {userName}!
          </h2>
          <p style={{ fontSize: "var(--tx-sm)", color: "var(--text-secondary)", maxWidth: 480, lineHeight: 1.6, marginBottom: "1.75rem" }}>
            I am your NBI Smart Attendance AI Assistant ({roleName} Mode). Ask me about timetables, attendance stats, course check-ins, or institute metrics.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
            maxWidth: 640,
            width: "100%",
          }}>
            {defaultPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt?.(prompt.replace(/^[\uD800-\uDBFF\uDC00-\uDFFF\u2600-\u27BF]\s*/, ""))}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.85rem 1rem",
                  color: "var(--text-primary)",
                  fontSize: "var(--tx-sm)",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all var(--t-fast)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                <span>{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 900, width: "100%", margin: "0 auto" }}>
          {messages.map((msg, index) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  flexDirection: isUser ? "row-reverse" : "row",
                  alignItems: "flex-start",
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-md)",
                  background: isUser ? "var(--accent)" : "var(--bg-surface-raised)",
                  border: isUser ? "none" : "1px solid var(--border-default)",
                  color: isUser ? "#ffffff" : "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                  flexShrink: 0,
                  boxShadow: "var(--shadow-sm)",
                }}>
                  {isUser ? <HiOutlineUser /> : <HiOutlineSparkles />}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: "75%",
                  background: isUser ? "var(--accent)" : "var(--bg-surface)",
                  color: isUser ? "#ffffff" : "var(--text-primary)",
                  border: isUser ? "none" : "1px solid var(--border-subtle)",
                  borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "0.85rem 1.15rem",
                  fontSize: "var(--tx-base)",
                  lineHeight: 1.6,
                  boxShadow: "var(--shadow-sm)",
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
                      color: isUser ? "rgba(255,255,255,0.7)" : "var(--text-muted)",
                      marginTop: "0.4rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                    }}>
                      <HiOutlineClock style={{ fontSize: "0.75rem" }} />
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface-raised)",
                border: "1px solid var(--border-default)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
                flexShrink: 0,
              }}>
                <HiOutlineSparkles />
              </div>
              <div style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "16px 16px 16px 4px",
                padding: "0.85rem 1.15rem",
                color: "var(--text-secondary)",
                fontSize: "var(--tx-sm)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}>
                <span className="typing-dots">NBI AI is analyzing system data...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}