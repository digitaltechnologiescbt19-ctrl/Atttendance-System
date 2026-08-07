import { useState } from "react";

interface ChatInputProps {
    onSend: (message: string) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
    const [message, setMessage] = useState("");

    function handleSend() {
        if (!message.trim()) return;

        onSend(message);
        setMessage("");
    }

    function handleKeyDown(
        e: React.KeyboardEvent<HTMLTextAreaElement>
    ) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <div className="border-t border-slate-200 bg-white p-6">

            <div className="flex items-end gap-4">

                <textarea
                    rows={1}
                    placeholder="Ask anything about NBI Institute..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 resize-none rounded-xl border border-slate-300 p-4 outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                    onClick={handleSend}
                    className="rounded-xl bg-blue-600 px-6 py-4 text-white hover:bg-blue-700 transition"
                >
                    Send
                </button>

            </div>

        </div>
    );
}