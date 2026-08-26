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

interface Session {
  id: number;
  course_id: number;
  session_date: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  course_code: string;
  course_name: string;
  attendance_status?: string;
  check_in_time?: string;
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
  const [todaysSessions, setTodaysSessions] = useState<Session[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  /* Fetch the student's own attendance summary when backend endpoint exists */
  useEffect(() => {
    if (!user?.linked_id) { setLoading(false); return; }

    // Fetch attendance summary
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

    // Fetch today's sessions
    fetch(`${API_URL}/api/attendance/students/${user.linked_id}/sessions/today`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!data || !Array.isArray(data)) return;
        setTodaysSessions(data as Session[]);
      })
      .catch(() => { /* fail silently */ });

    // Fetch upcoming sessions
    fetch(`${API_URL}/api/attendance/students/${user.linked_id}/sessions/upcoming`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!data || !Array.isArray(data)) return;
        setUpcomingSessions(data as Session[]);
      })
      .catch(() => { /* fail silently */ });
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
          value={todaysSessions.length}
          supporting={todaysSessions.length === 1 ? "Session scheduled today" : "Sessions scheduled today"}
          icon={<HiOutlineCalendarDays />}
        />
        <StatCard
          label="Upcoming Sessions"
          value={upcomingSessions.length}
          supporting={upcomingSessions.length === 1 ? "Upcoming session" : "Upcoming sessions"}
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
        {todaysSessions.length === 0 ? (
          <div className="empty-state" style={{ padding: "var(--sp-8) 0" }}>
            <div className="empty-icon">
              <HiOutlineCalendarDays />
            </div>
            <div className="empty-title">No classes today</div>
            <div className="empty-desc">
              Your scheduled classes will appear here once your lecturer creates a session.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {todaysSessions.map((session) => (
              <div
                key={session.id}
                className="card"
                style={{
                  padding: "var(--sp-4)",
                  borderLeft: `4px solid ${
                    session.attendance_status === "present"
                      ? "#10b981"
                      : session.attendance_status === "late"
                      ? "#f59e0b"
                      : session.attendance_status === "absent"
                      ? "#ef4444"
                      : "#6366f1"
                  }`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div className="card-title">{session.course_code}</div>
                    <div className="card-subtitle">{session.course_name}</div>
                    <div style={{ marginTop: "var(--sp-2)", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                      {session.start_time} - {session.end_time}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "var(--sp-2) var(--sp-3)",
                      borderRadius: "var(--rounded-md)",
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      backgroundColor:
                        session.attendance_status === "present"
                          ? "#d1fae5"
                          : session.attendance_status === "late"
                          ? "#fef3c7"
                          : session.attendance_status === "absent"
                          ? "#fee2e2"
                          : "#e0e7ff",
                      color:
                        session.attendance_status === "present"
                          ? "#065f46"
                          : session.attendance_status === "late"
                          ? "#92400e"
                          : session.attendance_status === "absent"
                          ? "#7f1d1d"
                          : "#3730a3",
                    }}
                  >
                    {session.attendance_status === "present"
                      ? "Present"
                      : session.attendance_status === "late"
                      ? "Late"
                      : session.attendance_status === "absent"
                      ? "Absent"
                      : "Not Marked"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Upcoming sessions ── */}
      {upcomingSessions.length > 0 && (
        <div className="card card-pad">
          <div className="card-header">
            <div>
              <div className="card-title">Upcoming Sessions</div>
              <div className="card-subtitle">Your next scheduled classes</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="card"
                style={{
                  padding: "var(--sp-4)",
                  borderLeft: "4px solid #6366f1",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div className="card-title">{session.course_code}</div>
                    <div className="card-subtitle">{session.course_name}</div>
                    <div style={{ marginTop: "var(--sp-2)", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                      {new Date(session.session_date).toLocaleDateString()} • {session.start_time} - {session.end_time}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "var(--sp-2) var(--sp-3)",
                      borderRadius: "var(--rounded-md)",
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      backgroundColor: "#e0e7ff",
                      color: "#3730a3",
                    }}
                  >
                    Upcoming
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
