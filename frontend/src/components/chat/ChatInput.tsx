import React, { useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Ask a question...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");

  function handleSend() {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{
      background: "var(--bg-surface)",
      borderTop: "1px solid var(--border-default)",
      padding: "0.85rem var(--sp-6)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        background: "var(--bg-input)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        padding: "0.4rem 0.5rem 0.4rem 0.85rem",
      }}>
        <textarea
          rows={1}
          placeholder={placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          style={{
            flex: 1,
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: "var(--tx-base)",
            lineHeight: "1.5",
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className="btn-primary"
          style={{
            padding: "0.45rem 1rem",
            fontSize: "var(--tx-sm)",
            fontWeight: 500,
            borderRadius: "var(--radius-md)",
            cursor: message.trim() && !disabled ? "pointer" : "not-allowed",
            opacity: message.trim() && !disabled ? 1 : 0.6,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
