interface Message {
    role: "user" | "assistant";
    content: string;
}

interface ChatAreaProps {
    messages: Message[];
    loading: boolean;
}

export default function ChatArea({
    messages,
    loading,
}: ChatAreaProps) {
    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 px-8 py-8">
            {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                    <div className="max-w-2xl text-center">
                        <h1 className="text-4xl font-bold text-slate-800">
                            Welcome to NBI Institute AI Assistant
                        </h1>

                        <p className="mt-4 text-lg text-slate-500">
                            Ask anything about admissions, tuition fees, courses,
                            facilities, student life, or any information available on
                            the official NBI Institute website.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="mx-auto max-w-4xl space-y-6">
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex ${message.role === "user"
                                    ? "justify-end"
                                    : "justify-start"
                                }`}
                        >
                            <div
                                className={`max-w-2xl rounded-2xl px-5 py-4 shadow-sm ${message.role === "user"
                                        ? "bg-blue-600 text-white"
                                        : "border border-slate-200 bg-white text-slate-800"
                                    }`}
                            >
                                {message.content}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex justify-start">
                            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-500">
                                NBI AI is thinking...
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}