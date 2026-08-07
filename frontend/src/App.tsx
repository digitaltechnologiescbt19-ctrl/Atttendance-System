import { useState } from "react";
import Layout from "./components/Layout/Layout";
import ChatArea from "./components/chat/ChatArea";
import ChatInput from "./components/chat/ChatInput";
import { sendMessage } from "./services/chatService";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSend(message: string) {
    const userMessage = {
      role: "user" as const,
      content: message,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const data = await sendMessage(message);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, something went wrong while contacting the server.",
        },
      ]);
    }

    setLoading(false);
  }

  return (
    <Layout>
      <div className="flex h-full flex-col">
        <ChatArea
          messages={messages}
          loading={loading} />
        <ChatInput onSend={handleSend} />
      </div>
    </Layout>
  );
}