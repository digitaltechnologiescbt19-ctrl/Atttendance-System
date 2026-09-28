const API_URL = `${import.meta.env.VITE_API_URL ?? ""}/api/chat`;

export async function sendMessage(message: string, token?: string | null) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
            message,
        }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(typeof data.message === "string" ? data.message : "Failed to contact NBI AI Assistant.");
    }

    return data as { reply: string; timestamp?: string; provider?: string };
}

export async function getChatHistory(token?: string | null) {
    const response = await fetch(`${API_URL}/history`, {
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(typeof data.message === "string" ? data.message : "Failed to load chat history.");
    }

    return (data.messages || []) as Array<{ id: number; role: "user" | "assistant"; content: string; timestamp?: string }>;
}

export async function clearChatHistory(token?: string | null) {
    const response = await fetch(`${API_URL}/history`, {
        method: "DELETE",
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(typeof data.message === "string" ? data.message : "Failed to clear chat history.");
    }

    return data;
}