export default function Sidebar() {
    return (
        <aside className="w-72 h-screen bg-slate-950 text-white flex flex-col border-r border-slate-800">

            {/* ===== Header ===== */}
            <div className="border-b border-slate-800 p-6 flex flex-col items-center">

                <img
                    src="/nbi-logo.jpg"
                    alt="NBI Institute Logo"
                    className="w-20 h-20 object-contain mb-4"
                />

                <h1 className="text-xl font-bold">
                    NBI Institute
                </h1>

                <p className="text-sm text-slate-400">
                    AI Assistant
                </p>

            </div>

            {/* ===== New Chat Button ===== */}
            <div className="p-4">
                <button
                    className="
            w-full
            rounded-xl
            bg-blue-600
            hover:bg-blue-700
            transition
            py-3
            font-medium
          "
                >
                    + New Chat
                </button>
            </div>

            {/* ===== Chat History ===== */}
            <div className="flex-1 overflow-y-auto px-3 space-y-2">

                <button className="w-full text-left rounded-lg p-3 hover:bg-slate-900 transition">
                    🎓 Admissions
                </button>

                <button className="w-full text-left rounded-lg p-3 hover:bg-slate-900 transition">
                    💰 School Fees
                </button>

                <button className="w-full text-left rounded-lg p-3 hover:bg-slate-900 transition">
                    📚 Courses
                </button>

            </div>

            {/* ===== Footer ===== */}
            <div className="border-t border-slate-800 p-4">

                <p className="text-xs text-slate-500 text-center">
                    Powered by Gemini AI
                </p>

            </div>

        </aside>
    );
}