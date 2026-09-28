const API_URL = `${import.meta.env.VITE_API_URL ?? ""}/api/chat`;

export async function sendMessage(
    message?: string,
    token?: string | null,
    confirmAction?: { tool: string; args: Record<string, any> }
) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
            ...(message ? { message } : {}),
            ...(confirmAction ? { confirm_action: confirmAction } : {}),
        }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(typeof data.message === "string" ? data.message : "Failed to contact NBI AI Assistant.");
    }

    return data as {
        reply: string;
        action_required?: { tool: string; args: Record<string, any>; description: string };
        timestamp?: string;
        provider?: string;
    };
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

    return (data.messages || []) as Array<{
        id: number | string;
        role: "user" | "assistant";
        content: string;
        action_required?: { tool: string; args: Record<string, any>; description: string };
        timestamp?: string;
    }>;
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

export async function deleteChatMessage(id: number | string, token?: string | null) {
    const response = await fetch(`${API_URL}/messages/${id}`, {
        method: "DELETE",
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(typeof data.message === "string" ? data.message : "Failed to delete message.");
    }

    return data;
}

export async function editChatMessage(id: number | string, content: string, token?: string | null) {
    const response = await fetch(`${API_URL}/messages/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(typeof data.message === "string" ? data.message : "Failed to edit message.");
    }

    return data as {
        reply: string;
        action_required?: { tool: string; args: Record<string, any>; description: string };
        timestamp?: string;
    };
}