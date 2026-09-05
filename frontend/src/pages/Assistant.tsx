// default React import not required with JSX runtime
import { HiOutlineChatBubbleLeftEllipsis, HiOutlineSparkles, HiOutlineShieldCheck, HiOutlineUserGroup } from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";

export default function Assistant() {
  const { user } = useAuth();
  const roleTitle = user?.role === "admin" ? "Administrator" : user?.role === "lecturer" ? "Lecturer" : "Student";

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-eyebrow">NBI Native AI</span>
          <h1 className="page-title">AI Assistant</h1>
          <p className="page-desc">Role-aware academic intelligence for Students, Lecturers, and Administrators.</p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: "1.5rem", background: "var(--bg-surface-raised)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <HiOutlineSparkles style={{ fontSize: "1.5rem", color: "var(--accent)" }} />
          <h2 style={{ fontSize: "var(--tx-md)", fontWeight: 700, color: "var(--text-primary)" }}>
            Native NBI Assistant Workspace ({roleTitle} Mode)
          </h2>
        </div>
        <p style={{ fontSize: "var(--tx-sm)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Authenticated as <strong>{user?.name}</strong> ({user?.email}). The native AI assistant connects directly to authorized system tools for timetables, attendance analytics, and course records based on your role.
        </p>
      </div>

      <div className="placeholder-page">
        <div className="empty-icon"><HiOutlineChatBubbleLeftEllipsis /></div>
        <span className="placeholder-badge">Native AI Pipeline</span>
        <h2 style={{ fontSize: "var(--tx-xl)", fontWeight: 700, color: "var(--text-primary)" }}>
          Smart Attendance AI Assistant
        </h2>
        <p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", maxWidth: 480, lineHeight: 1.7 }}>
          The native assistant pipeline connects directly to authenticated backend tools without exposing private database records. Ready for live queries on your {roleTitle.toLowerCase()} dashboard.
        </p>
        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", fontSize: "var(--tx-xs)", color: "var(--text-muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <HiOutlineShieldCheck style={{ color: "var(--success)" }} /> Permission Enforced
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <HiOutlineUserGroup style={{ color: "var(--accent)" }} /> Role-Aware Context
          </span>
        </div>
      </div>
    </div>
  );
}
