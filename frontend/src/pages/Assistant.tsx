import { useState } from "react";
import { HiOutlineSparkles, HiOutlineTrash } from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";
import ChatArea, { type ChatMessageItem } from "../components/chat/ChatArea";
import ChatInput from "../components/chat/ChatInput";
import { sendMessage } from "../services/chatService";

export default function Assistant() {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);

  const roleTitle = user?.role === "admin" ? "Administrator" : user?.role === "lecturer" ? "Lecturer" : "Student";

  async function handleSend(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessageItem = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await sendMessage(text, token);
      const assistantMsg: ChatMessageItem = {
        role: "assistant",
        content: res.reply || "I am here to assist with your academic timetable and attendance.",
        timestamp: res.timestamp || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errMsg: ChatMessageItem = {
        role: "assistant",
        content: err instanceof Error ? err.message : "Unable to process message right now. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setMessages([]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--topbar-h) - var(--sp-8) * 2)" }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: "1rem" }}>
        <div className="page-header-left">
          <span className="page-eyebrow">NBI Native AI</span>
          <h1 className="page-title">AI Assistant</h1>
          <p className="page-desc">Role-aware academic intelligence powered by Google Gemini API.</p>
        </div>

        <div className="page-header-actions" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{
            background: "var(--accent-subtle)",
            color: "var(--accent)",
            border: "1px solid var(--accent-border)",
            borderRadius: "var(--radius-full)",
            padding: "4px 12px",
            fontSize: "var(--tx-xs)",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
          }}>
            <HiOutlineSparkles /> {roleTitle} Mode
          </span>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "6px 14px",
                fontSize: "var(--tx-xs)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <HiOutlineTrash /> Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Area Card */}
      <div className="card" style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
      }}>
        <ChatArea
          messages={messages}
          loading={loading}
          onSelectPrompt={handleSend}
          roleName={roleTitle}
          userName={user?.name || "User"}
        />
        <ChatInput
          onSend={handleSend}
          disabled={loading}
          placeholder={`Ask about your ${user?.role === "student" ? "classes, attendance rate, check-in history" : user?.role === "lecturer" ? "lectures, course check-ins, student attendance" : "institute attendance trends, courses, student metrics"}...`}
        />
      </div>
    </div>
  );
}
