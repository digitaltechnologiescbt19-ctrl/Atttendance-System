import { useEffect, useState } from "react";
import {
  HiOutlineUsers,
  HiOutlineUserMinus,
  HiOutlineChartBarSquare,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlineClipboardDocumentCheck,
  HiOutlineAcademicCap,
  HiOutlineBookOpen,
} from "react-icons/hi2";

import { useAuth } from "../context/AuthContext";
import WelcomeBanner   from "../components/dashboard/WelcomeBanner";
import StatCard         from "../components/dashboard/StatCard";
import QuickActions     from "../components/dashboard/QuickActions";
import TodaySchedule    from "../components/dashboard/TodaySchedule";
import LecturerSummary  from "../components/dashboard/LecturerSummary";

/* ------------------------------------------------------------------ */
/*  Dashboard Summary type — matches backend /dashboard-summary        */
/* ------------------------------------------------------------------ */

interface DashboardSummary {
  total_students:  number;
  total_lecturers: number;
  total_courses:   number;
  today_total:     number;
  today_present:   number;
  today_late:      number;
  today_absent:    number;
  attendance_rate: number;
  total_records:   number;
  at_risk_count:   number;
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                           */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { user, token } = useAuth();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/attendance/dashboard-summary", {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) throw new Error("Failed to load dashboard data");

        const data = await res.json();

        if (!cancelled) {
          setSummary(data as DashboardSummary);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Unable to load dashboard statistics");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSummary();
    return () => { cancelled = true; };
  }, []);

  /* Defensive helpers */
  const v = (field: keyof DashboardSummary): string => {
    if (loading)          return "…";
    if (error || !summary) return "—";
    const n = summary[field];
    return n !== undefined && n !== null ? String(n) : "—";
  };

  const rate = (): string => {
    if (loading || !summary) return loading ? "…" : "—";
    return `${summary.attendance_rate.toFixed(1)}%`;
  };

  return (
    <>
      {/* Welcome / hero */}
      <WelcomeBanner name={user?.name ?? "Administrator"} />

      {/* Error banner — only shown if summary fails */}
      {error && !loading && (
        <div style={{
          padding: "var(--sp-3) var(--sp-4)",
          background: "var(--danger-subtle)",
          border: "1px solid var(--danger-border)",
          borderRadius: "var(--radius-md)",
          marginBottom: "var(--sp-5)",
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
        }}>
          <HiOutlineExclamationTriangle style={{ fontSize: 18, color: "var(--danger-text)", flexShrink: 0 }} />
          <span style={{ fontSize: "var(--tx-sm)", color: "var(--danger-text)" }}>
            Unable to load dashboard statistics. Statistics will show "—" until the connection is restored.
          </span>
        </div>
      )}

      {/* Stats row 1 — Today's Attendance */}
      <div className="stats-grid">
        <StatCard
          label="Today's Check-ins"
          value={v("today_total")}
          supporting={loading ? "Loading…" : summary ? `${summary.today_present} present, ${summary.today_late} late` : "No data for today"}
          icon={<HiOutlineClipboardDocumentCheck />}
          loading={loading}
        />
        <StatCard
          label="Present Today"
          value={v("today_present")}
          supporting={loading ? "Loading…" : summary && summary.today_total > 0
            ? `${((summary.today_present / summary.today_total) * 100).toFixed(1)}% of today's records`
            : "No attendance records today"}
          icon={<HiOutlineUsers />}
          loading={loading}
        />
        <StatCard
          label="Absent Today"
          value={v("today_absent")}
          supporting={loading ? "Loading…" : summary && summary.today_total > 0
            ? `${((summary.today_absent / summary.today_total) * 100).toFixed(1)}% of today's records`
            : "No attendance records today"}
          trendDir="down"
          icon={<HiOutlineUserMinus />}
          loading={loading}
        />
      </div>

      {/* Stats row 2 — Institutional Overview */}
      <div className="stats-grid" style={{ marginTop: "calc(var(--sp-5) * -1 + var(--sp-1))" }}>
        <StatCard
          label="Late Check-ins Today"
          value={v("today_late")}
          supporting="Students who checked in after the present window"
          icon={<HiOutlineClock />}
          loading={loading}
        />
        <StatCard
          label="Overall Attendance Rate"
          value={rate()}
          supporting={loading ? "Loading…" : summary && summary.total_records > 0
            ? `Based on ${summary.total_records} total records`
            : "No attendance records yet"}
          icon={<HiOutlineChartBarSquare />}
          loading={loading}
        />
        <StatCard
          label="Students at Risk"
          value={v("at_risk_count")}
          supporting="Below 75% attendance rate"
          trendDir="down"
          icon={<HiOutlineExclamationTriangle />}
          loading={loading}
        />
      </div>

      {/* Stats row 3 — Totals */}
      <div className="stats-grid" style={{ marginTop: "calc(var(--sp-5) * -1 + var(--sp-1))" }}>
        <StatCard
          label="Total Students"
          value={v("total_students")}
          supporting="Enrolled students in the system"
          icon={<HiOutlineUsers />}
          loading={loading}
        />
        <StatCard
          label="Total Lecturers"
          value={v("total_lecturers")}
          supporting="Academic staff registered"
          icon={<HiOutlineAcademicCap />}
          loading={loading}
        />
        <StatCard
          label="Total Courses"
          value={v("total_courses")}
          supporting="Courses across all programmes"
          icon={<HiOutlineBookOpen />}
          loading={loading}
        />
      </div>

      {/* Quick actions */}
      <QuickActions />

      {/* Lower panels */}
      <div className="dashboard-lower">
        <TodaySchedule />
        <LecturerSummary />
      </div>
    </>
  );
}
