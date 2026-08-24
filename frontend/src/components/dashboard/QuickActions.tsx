import React from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineUserPlus,
  HiOutlineAcademicCap,
  HiOutlineBookOpen,
  HiOutlineChartBarSquare,
  HiOutlineClipboardDocumentList,
} from "react-icons/hi2";

/* ─────────────────────────────────────────────────────────────
   Admin Quick Actions
   These are administrator responsibilities only.
   QR session generation is NOT listed here — that belongs to
   lecturers and is surfaced in the Lecturer dashboard.
───────────────────────────────────────────────────────────── */

interface Action {
  icon:  React.ReactNode;
  label: string;
  desc:  string;
  to:    string;
}

const actions: Action[] = [
  {
    icon:  <HiOutlineUserPlus />,
    label: "Add Student",
    desc:  "Enrol a new student account into the system.",
    to:    "/admin/students",
  },
  {
    icon:  <HiOutlineAcademicCap />,
    label: "Add Lecturer",
    desc:  "Create a new lecturer account.",
    to:    "/admin/lecturers",
  },
  {
    icon:  <HiOutlineBookOpen />,
    label: "Manage Courses",
    desc:  "View and manage course listings and enrolments.",
    to:    "/admin/courses",
  },
  {
    icon:  <HiOutlineClipboardDocumentList />,
    label: "View Attendance",
    desc:  "Institution-wide attendance overview.",
    to:    "/admin/attendance",
  },
  {
    icon:  <HiOutlineChartBarSquare />,
    label: "View Reports",
    desc:  "Access attendance reports and exports.",
    to:    "/admin/reports",
  },
];

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="quick-actions">
      <div className="card-header" style={{ marginBottom: "var(--sp-4)" }}>
        <div>
          <div className="card-title">Quick Actions</div>
          <div className="card-subtitle">Common administrative operations</div>
        </div>
      </div>

      <div className="quick-actions-grid">
        {actions.map((a) => (
          <button
            key={a.to}
            className="action-card"
            onClick={() => navigate(a.to)}
            type="button"
          >
            <span className="action-card-icon">{a.icon}</span>
            <span className="action-card-label">{a.label}</span>
            <span className="action-card-desc">{a.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
