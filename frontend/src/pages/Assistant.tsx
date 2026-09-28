import { useEffect, useState } from "react";
import { HiOutlineTrash } from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";
import ChatArea, { type ChatMessageItem } from "../components/chat/ChatArea";
import ChatInput from "../components/chat/ChatInput";
import { sendMessage, getChatHistory, clearChatHistory } from "../services/chatService";

export default function Assistant() {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const roleTitle = user?.role === "admin" ? "Administrator" : user?.role === "lecturer" ? "Lecturer" : "Student";

  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      if (!token) {
        setInitialLoading(false);
        return;
      }
      try {
        const history = await getChatHistory(token);
        if (isMounted) {
          setMessages(history);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    }
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [token]);

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

  async function handleClear() {
    if (messages.length === 0) return;
    const confirmed = window.confirm("Are you sure you want to clear your chat history?");
    if (!confirmed) return;

    try {
      await clearChatHistory(token);
      setMessages([]);
    } catch (err) {
      console.error("Failed to clear chat history:", err);
      alert("Failed to clear chat history. Please try again.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--topbar-h) - var(--sp-8) * 2)" }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: "0.75rem" }}>
        <div className="page-header-left">
          <h1 className="page-title">AI Assistant</h1>
          <p className="page-desc">Role-aware academic & attendance intelligence.</p>
        </div>

        <div className="page-header-actions" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
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
                cursor: "pointer",
              }}
            >
              <HiOutlineTrash /> Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Surface — directly on page content without giant outer card box */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 0,
      }}>
        {initialLoading ? (
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            fontSize: "var(--tx-sm)",
          }}>
            Loading conversation...
          </div>
        ) : (
          <ChatArea
            messages={messages}
            loading={loading}
            onSelectPrompt={handleSend}
            roleName={roleTitle}
            userName={user?.name || "User"}
          />
        )}
        <ChatInput
          onSend={handleSend}
          disabled={loading || initialLoading}
          placeholder={`Ask about ${user?.role === "student" ? "classes, attendance rate, or schedule" : user?.role === "lecturer" ? "lectures, course check-ins, or student attendance" : "institution attendance trends, courses, or student metrics"}...`}
        />
      </div>
    </div>
  );
}
