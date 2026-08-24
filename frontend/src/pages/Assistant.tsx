// default React import not required with JSX runtime
import { HiOutlineChatBubbleLeftEllipsis } from "react-icons/hi2";

export default function Assistant() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-eyebrow">NBI AI</span>
          <h1 className="page-title">AI Assistant</h1>
          <p className="page-desc">Ask about courses, attendance, timetables and academic information.</p>
        </div>
      </div>
      <div className="placeholder-page">
        <div className="empty-icon"><HiOutlineChatBubbleLeftEllipsis /></div>
        <span className="placeholder-badge">Integration Pending</span>
        <h2 style={{ fontSize: "var(--tx-xl)", fontWeight: 700, color: "var(--text-primary)" }}>
          NBI Institute AI Assistant
        </h2>
        <p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", maxWidth: 420, lineHeight: 1.7 }}>
          The existing NBI AI chatbot will be integrated here as a feature of Smart Attendance.
          The chatbot backend and existing functionality are preserved and will be connected shortly.
        </p>
      </div>
    </div>
  );
}
