import React, { useState } from "react";
import { HiOutlinePaperAirplane } from "react-icons/hi2";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Ask about your timetable, attendance percentage, courses...",
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
      borderTop: "1px solid var(--border-subtle)",
      padding: "1rem var(--sp-6)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        background: "var(--bg-input)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "0.5rem 0.75rem",
        boxShadow: "var(--shadow-sm)",
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
          aria-label="Send message"
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-md)",
            background: message.trim() && !disabled ? "var(--accent)" : "var(--border-subtle)",
            color: message.trim() && !disabled ? "#ffffff" : "var(--text-muted)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: message.trim() && !disabled ? "pointer" : "not-allowed",
            transition: "all var(--t-fast)",
            flexShrink: 0,
          }}
        >
          <HiOutlinePaperAirplane style={{ fontSize: "1.2rem", transform: "rotate(90deg)" }} />
        </button>
      </div>
    </div>
  );
}
