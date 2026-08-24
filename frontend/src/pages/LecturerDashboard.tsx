import { useEffect, useState, useCallback } from "react";
import {
  HiOutlineQrCode,
  HiOutlineClipboardDocumentList,
  HiOutlineUsers,
  HiOutlineChartBarSquare,
  HiOutlineCalendarDays,
  HiOutlinePlusCircle,
  HiOutlineArrowPath,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import WelcomeBanner from "../components/dashboard/WelcomeBanner";
import StatCard     from "../components/dashboard/StatCard";
import TodaySchedule from "../components/dashboard/TodaySchedule";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

/* ------------------------------------------------------------------ */
/*  Types — mirrors what GET /lecturers/:id/dashboard returns          */
/* ------------------------------------------------------------------ */

interface DashboardCheckin {
  id:             number;
  status:         "present" | "late" | "absent";
  check_in_time:  string;
  student_name:   string;
  student_number: string;
  course_code:    string;
  course_name:    string;
  session_date:   string;
}

interface DashboardSession {
  id:                     number;
  session_date:           string;
  start_time:             string;
  end_time:               string;
  is_active:              boolean;
  qr_generated_at:        string | null;
  present_window_minutes: number;
  course_code:            string;
  course_name:            string;
  total_checkins:         number;
}

interface LecturerDashboardData {
  sessions_today:          number;
  students_present_today:  number;
  average_attendance_rate: number;
  total_records:           number;
  total_courses:           number;
  upcoming_sessions:       DashboardSession[];
  recent_checkins:         DashboardCheckin[];
}

/* ------------------------------------------------------------------ */
/*  Auth header helper (matches AuthContext storage keys)              */
/* ------------------------------------------------------------------ */
function getAuthHeaders(token: string | null): HeadersInit {
  const t = token ||
    localStorage.getItem("nbi-auth-token") ||
    sessionStorage.getItem("nbi-auth-token");
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

/* ------------------------------------------------------------------ */
/*  Status badge for recent check-in rows                              */
/* ------------------------------------------------------------------ */
function StatusBadge({ status }: { status: string }) {
  if (status === "present") return <span className="badge badge-sm badge-success">Present</span>;
  if (status === "late")    return <span className="badge badge-sm badge-warning">Late</span>;
  if (status === "absent")  return <span className="badge badge-sm badge-danger">Absent</span>;
  return <span className="badge badge-sm badge-neutral">{status}</span>;
}

/* ------------------------------------------------------------------ */
/*  LecturerDashboard                                                   */
/* ------------------------------------------------------------------ */

export default function LecturerDashboard() {
  const { user, token } = useAuth();
  const navigate        = useNavigate();

  // lecturerId comes from the authenticated JWT — cannot be spoofed
  const lecturerId = user?.linked_id ?? null;

  const [data,    setData]    = useState<LecturerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  /* ---- Fetch dashboard data ---- */
  const fetchDashboard = useCallback(async () => {
    if (!lecturerId) {
      setError("No lecturer profile is linked to your account. Contact your administrator.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_URL}/api/attendance/lecturers/${lecturerId}/dashboard`,
        { headers: getAuthHeaders(token) }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { message?: string }).message || "Failed to load dashboard data");
      }
      const json: LecturerDashboardData = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load your dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [lecturerId, token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /* ---- Stat helpers ---- */
  const sessionsToday   = data?.sessions_today          ?? 0;
  const studentsPresent = data?.students_present_today  ?? 0;
  const avgRate         = data?.average_attendance_rate ?? 0;
  const recentCheckins  = data?.recent_checkins         ?? [];
  const upcomingSessions = data?.upcoming_sessions      ?? [];

  /* ---- Today's sessions for TodaySchedule (lecturer-scoped) ---- */
  // Filter upcoming_sessions to just today
  const today = new Date().toISOString().split("T")[0];
  const todaySessions = upcomingSessions
    .filter((s) => s.session_date.split("T")[0] === today)
    .slice(0, 5);

  return (
    <>
      {/* Welcome banner — real user name from AuthContext */}
      <WelcomeBanner name={user?.name ?? "Lecturer"} />

      {/* ── Error banner ── */}
      {!loading && error && (
        <div style={{
          display: "flex", alignItems: "center", gap: "var(--sp-3)",
          padding: "var(--sp-3) var(--sp-4)",
          background: "var(--danger-subtle)",
          border: "1px solid var(--danger-border)",
          borderRadius: "var(--radius-md)",
          marginBottom: "var(--sp-5)",
        }}>
          <HiOutlineExclamationTriangle style={{ fontSize: 18, color: "var(--danger-text)", flexShrink: 0 }} />
          <span style={{ fontSize: "var(--tx-sm)", color: "var(--danger-text)", flex: 1 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={fetchDashboard}>
            <span className="btn-icon"><HiOutlineArrowPath /></span>
            Retry
          </button>
        </div>
      )}

      {/* ── Stats row — real values or skeletons while loading ── */}
      <div className="stats-grid">
        <StatCard
          label="My Sessions Today"
          value={loading ? "…" : sessionsToday}
          supporting={
            loading ? "Loading…" :
            sessionsToday === 0 ? "No sessions scheduled for today" :
            `${sessionsToday} session${sessionsToday !== 1 ? "s" : ""} today`
          }
          icon={<HiOutlineCalendarDays />}
          loading={loading}
        />
        <StatCard
          label="Students Present"
          value={loading ? "…" : studentsPresent}
          supporting={
            loading ? "Loading…" :
            studentsPresent === 0 ? "No check-ins recorded today" :
            `${studentsPresent} student${studentsPresent !== 1 ? "s" : ""} checked in`
          }
          icon={<HiOutlineUsers />}
          loading={loading}
        />
        <StatCard
          label="Avg. Attendance Rate"
          value={loading ? "…" : `${avgRate.toFixed(1)}%`}
          supporting={
            loading ? "Loading…" :
            data?.total_records === 0 ? "No attendance recorded yet" :
            `Based on ${data?.total_records ?? 0} total records`
          }
          icon={<HiOutlineChartBarSquare />}
          loading={loading}
        />
      </div>

      {/* ── Quick actions (navigation only — no data needed) ── */}
      <div className="quick-actions">
        <div className="card-header" style={{ marginBottom: "var(--sp-4)" }}>
          <div>
            <div className="card-title">Quick Actions</div>
            <div className="card-subtitle">Manage your sessions and attendance</div>
          </div>
        </div>

        <div className="quick-actions-grid">
          <button className="action-card" onClick={() => navigate("/lecturer/qr-attendance")} type="button">
            <span className="action-card-icon"><HiOutlineQrCode /></span>
            <span className="action-card-label">Generate QR Attendance</span>
            <span className="action-card-desc">Create a session and generate a QR code for student check-in.</span>
          </button>

          <button className="action-card" onClick={() => navigate("/lecturer/qr-attendance")} type="button">
            <span className="action-card-icon"><HiOutlinePlusCircle /></span>
            <span className="action-card-label">New Attendance Session</span>
            <span className="action-card-desc">Open a new session for one of your classes.</span>
          </button>

          <button className="action-card" onClick={() => navigate("/lecturer/attendance")} type="button">
            <span className="action-card-icon"><HiOutlineClipboardDocumentList /></span>
            <span className="action-card-label">View Attendance</span>
            <span className="action-card-desc">Review check-in records for your classes.</span>
          </button>

          <button className="action-card" onClick={() => navigate("/lecturer/reports")} type="button">
            <span className="action-card-icon"><HiOutlineChartBarSquare /></span>
            <span className="action-card-label">My Reports</span>
            <span className="action-card-desc">Attendance reports for your assigned courses.</span>
          </button>
        </div>
      </div>

      {/* ── Lower panels ── */}
      <div className="dashboard-lower">

        {/* Today's schedule — passes lecturer-scoped sessions as props;
            TodaySchedule will use them directly instead of fetching all sessions */}
        <TodaySchedule sessions={loading ? undefined : todaySessions} />

        {/* Recent Check-ins — real data from lecturer dashboard endpoint */}
        <div className="card card-pad">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Check-ins</div>
              <div className="card-subtitle">Latest student attendance activity</div>
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", gap: "var(--sp-3)", padding: "var(--sp-3) 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 13, width: "55%", marginBottom: 5 }} />
                    <div className="skeleton" style={{ height: 11, width: "40%" }} />
                  </div>
                  <div className="skeleton" style={{ height: 22, width: 60, borderRadius: "var(--radius-full)" }} />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && recentCheckins.length === 0 && !error && (
            <div className="empty-state" style={{ padding: "var(--sp-8) 0" }}>
              <div className="empty-icon"><HiOutlineClipboardDocumentList /></div>
              <div className="empty-title">No recent check-ins</div>
              <div className="empty-desc">
                Student check-ins will appear here once attendance sessions are active.
              </div>
            </div>
          )}

          {/* Real check-in rows */}
          {!loading && recentCheckins.length > 0 && (
            <div>
              {recentCheckins.map((c) => (
                <div key={c.id} className="class-row" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="class-name" style={{ fontSize: "var(--tx-sm)" }}>
                      {c.student_name ?? "—"}
                    </div>
                    <div className="class-meta">
                      {c.course_code} &middot;{" "}
                      {c.check_in_time
                        ? new Date(c.check_in_time).toLocaleTimeString("en-GB", {
                            hour: "2-digit", minute: "2-digit",
                          })
                        : "—"}
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
