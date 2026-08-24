import { useEffect, useState } from "react";
import {
  HiOutlineQrCode,
  HiOutlineClipboardDocumentList,
  HiOutlineChartBarSquare,
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import WelcomeBanner from "../components/dashboard/WelcomeBanner";
import StatCard from "../components/dashboard/StatCard";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface AttendanceSummary {
  total:      number;
  present:    number;
  late:       number;
  absent:     number;
  percentage: number;
}

/* ─────────────────────────────────────────────────────────────
   Student Dashboard
   Shows only the authenticated student's own information.
   No other students' data is ever loaded or displayed.
   QR scanning is the primary action — no session creation.
───────────────────────────────────────────────────────────── */

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  /* Fetch the student's own attendance summary when backend endpoint exists */
  useEffect(() => {
    if (!user?.linked_id) { setLoading(false); return; }

    fetch(`${API_URL}/api/attendance/students/${user.linked_id}/attendance`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!data || !Array.isArray(data)) return;
        const records = data as Array<{ status: string }>;
        const total   = records.length;
        const present = records.filter((r) => r.status === "present").length;
        const late    = records.filter((r) => r.status === "late").length;
        const absent  = records.filter((r) => r.status === "absent").length;
        setSummary({
          total, present, late, absent,
          percentage: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
        });
      })
      .catch(() => { /* fail silently — show empty state */ })
      .finally(() => setLoading(false));
  }, [user?.linked_id]);

  return (
    <>
      {/* Welcome banner — uses real authenticated student name */}
      <WelcomeBanner name={user?.name ?? "Student"} />

      {/* ── Attendance stats ── */}
      <div className="stats-grid">
        <StatCard
          label="Attendance Rate"
          value={loading ? "—" : summary ? `${summary.percentage}%` : "—"}
          supporting={loading ? "Loading…" : summary ? `${summary.present + summary.late} of ${summary.total} sessions` : "No records yet"}
          icon={<HiOutlineChartBarSquare />}
        />
        <StatCard
          label="Present"
          value={loading ? "—" : summary?.present ?? "—"}
          supporting="On-time check-ins"
          trendDir="up"
          icon={<HiOutlineCheckCircle />}
        />
        <StatCard
          label="Late"
          value={loading ? "—" : summary?.late ?? "—"}
          supporting="After the 10-minute window"
          icon={<HiOutlineClock />}
        />
      </div>

      <div className="stats-grid" style={{ marginTop: "calc(var(--sp-5) * -1 + var(--sp-1))" }}>
        <StatCard
          label="Absent"
          value={loading ? "—" : summary?.absent ?? "—"}
          supporting="Sessions with no scan recorded"
          trendDir="down"
          icon={<HiOutlineXCircle />}
        />
        <StatCard
          label="Today's Classes"
          value="—"
          supporting="Sessions scheduled today"
          icon={<HiOutlineCalendarDays />}
        />
        <StatCard
          label="Upcoming Sessions"
          value="—"
          supporting="Your next scheduled classes"
          icon={<HiOutlineCalendarDays />}
        />
      </div>

      {/* ── Primary action: Scan QR ── */}
      <div className="quick-actions">
        <div className="card-header" style={{ marginBottom: "var(--sp-4)" }}>
          <div>
            <div className="card-title">Attendance</div>
            <div className="card-subtitle">Mark your attendance for today's sessions</div>
          </div>
        </div>

        {/* Students scan QR — they do NOT generate it */}
        <div className="quick-actions-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          <button
            className="action-card"
            onClick={() => navigate("/student/scan")}
            type="button"
          >
            <span className="action-card-icon">
              <HiOutlineQrCode />
            </span>
            <span className="action-card-label">Scan QR Attendance</span>
            <span className="action-card-desc">
              Scan the QR code displayed by your lecturer to mark your attendance.
            </span>
          </button>

          <button
            className="action-card"
            onClick={() => navigate("/student/attendance")}
            type="button"
          >
            <span className="action-card-icon">
              <HiOutlineClipboardDocumentList />
            </span>
            <span className="action-card-label">My Attendance History</span>
            <span className="action-card-desc">
              View your full attendance record, including present, late and absent entries.
            </span>
          </button>
        </div>
      </div>

      {/* ── Today's schedule ── */}
      <div className="card card-pad">
        <div className="card-header">
          <div>
            <div className="card-title">Today's Classes</div>
            <div className="card-subtitle">Your scheduled sessions for today</div>
          </div>
        </div>
        <div className="empty-state" style={{ padding: "var(--sp-8) 0" }}>
          <div className="empty-icon">
            <HiOutlineCalendarDays />
          </div>
          <div className="empty-title">No classes today</div>
          <div className="empty-desc">
            Your scheduled classes will appear here once your lecturer creates a session.
          </div>
        </div>
      </div>
    </>
  );
}
