import { useState, useEffect, useCallback } from "react";
import {
  HiOutlineLightBulb,
  HiOutlineArrowTrendingUp,
  HiOutlineExclamationTriangle,
  HiOutlineUserGroup,
  HiOutlineAcademicCap,
} from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL ?? "";

/* ------------------------------------------------------------------ */
/*  Auth helper                                                         */
/* ------------------------------------------------------------------ */

function getAuthHeaders(token: string | null): HeadersInit {
  const t =
    token ||
    localStorage.getItem("nbi-auth-token") ||
    sessionStorage.getItem("nbi-auth-token");
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

/** Shape returned by both admin (/insights) and lecturer (/lecturers/:id/insights) */
interface InsightsData {
  overall: {
    total_records:  string;
    present_count:  string;
    late_count:     string;
    absent_count:   string;
    present_rate:   string;
    late_rate:      string;
  };
  /** Per-course breakdown — present on both admin and lecturer responses */
  course_rates: Array<{
    course_code:      string;
    course_name:      string;
    programme:        string;
    total_attendance: string;
    present_count:    string;
    late_count?:      string;
    absent_count?:    string;
    attendance_rate:  string;
  }>;
  low_attendance_students: Array<{
    id:                      number;
    student_number:          string;
    full_name:               string;
    programme:               string;
    total_sessions_attended: string;
    present_count:           string;
    late_count:              string;
    absent_count:            string;
    attendance_rate:         string;
    /** Lecturer endpoint also returns the course the student belongs to */
    course_code?:  string;
    course_name?:  string;
  }>;
  recent_trends: Array<{
    session_date:  string;
    total_records: string;
    present_count: string;
    late_count:    string;
    present_rate:  string;
  }>;
  /** Admin-only — institution-wide programme breakdown */
  by_programme?: Array<{
    programme:      string;
    student_count:  string;
    total_records:  string;
    present_count:  string;
    attendance_rate: string;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function rateColor(rate: number): string {
  if (rate >= 75) return "var(--success)";
  if (rate >= 50) return "var(--warning)";
  return "var(--danger)";
}

function PageHeader({ isLecturer }: { isLecturer: boolean }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <span className="page-eyebrow">Analytics</span>
        <h1 className="page-title">Insights</h1>
        <p className="page-desc">
          {isLecturer
            ? "Attendance trends and analytics for your assigned courses."
            : "Attendance trends, patterns and real-time analytics."}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Insights Page                                                  */
/* ------------------------------------------------------------------ */

function AdminInsights() {
  const { user, token } = useAuth();

  const isLecturer = user?.role === "lecturer";
  const lecturerId = isLecturer ? (user?.linked_id ?? null) : null;

  const [data,    setData]    = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  /* ---------------------------------------------------------------- */
  /*  Load insights — lecturer gets scoped endpoint, admin gets global */
  /* ---------------------------------------------------------------- */
  const loadInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      let url: string;
      if (isLecturer) {
        if (!lecturerId) {
          // Lecturer account has no linked_id — show empty state
          setData(null);
          return;
        }
        url = `${API_URL}/api/attendance/lecturers/${lecturerId}/insights`;
      } else {
        url = `${API_URL}/api/attendance/insights`;
      }

      const res = await fetch(url, { headers: getAuthHeaders(token) });

      if (res.status === 401) throw new Error("401");
      if (res.status === 403) throw new Error("403");
      if (!res.ok) throw new Error("Failed to load insights");

      const result: InsightsData = await res.json();
      setData(result);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load insights";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isLecturer, lecturerId, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInsights();
  }, [loadInsights]);

  /* ---------------------------------------------------------------- */
  /*  Guard: lecturer with no linked_id                               */
  /* ---------------------------------------------------------------- */
  if (isLecturer && !lecturerId && !loading) {
    return (
      <>
        <PageHeader isLecturer />
        <div className="card card-pad" style={{ textAlign: "center", padding: "var(--sp-12)" }}>
          <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:64, height:64, borderRadius:"var(--radius-lg)", background:"var(--accent-subtle)", border:"1px solid var(--accent-border)", color:"var(--accent)", marginBottom:"var(--sp-4)" }}>
            <HiOutlineLightBulb style={{ fontSize: 32 }} />
          </div>
          <h3 style={{ fontSize:"var(--tx-lg)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-2)" }}>
            No Lecturer Profile Linked
          </h3>
          <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", maxWidth:420, margin:"0 auto" }}>
            Your account does not have a linked lecturer profile. Contact your administrator.
          </p>
        </div>
      </>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */
  if (loading) {
    return (
      <>
        <PageHeader isLecturer={isLecturer} />
        <div className="card card-pad" style={{ textAlign:"center", padding:"var(--sp-12)" }}>
          <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>Loading insights…</p>
        </div>
      </>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Error state                                                      */
  /* ---------------------------------------------------------------- */
  if (error) {
    const friendly =
      error === "401" ? "Your session has expired. Please log in again." :
      error === "403" ? "Access denied. You can only view insights for your own courses." :
      error;

    return (
      <>
        <PageHeader isLecturer={isLecturer} />
        <div style={{ padding:"var(--sp-4)", background:"var(--danger-subtle)", border:"1px solid var(--danger-border)", borderRadius:"var(--radius-md)", marginBottom:"var(--sp-5)", display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
          <HiOutlineExclamationTriangle style={{ fontSize:20, color:"var(--danger-text)", flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--danger-text)" }}>
              Failed to load insights
            </div>
            <div style={{ fontSize:"var(--tx-sm)", color:"var(--danger-text)", marginTop:2 }}>
              {friendly}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadInsights}>Retry</button>
        </div>
      </>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Empty state                                                      */
  /* ---------------------------------------------------------------- */
  const totalRecords = parseInt(data?.overall?.total_records ?? "0", 10);
  if (!data || totalRecords === 0) {
    return (
      <>
        <PageHeader isLecturer={isLecturer} />
        <div className="card card-pad" style={{ textAlign:"center", padding:"var(--sp-12)" }}>
          <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:64, height:64, borderRadius:"var(--radius-lg)", background:"var(--accent-subtle)", border:"1px solid var(--accent-border)", color:"var(--accent)", marginBottom:"var(--sp-4)" }}>
            <HiOutlineLightBulb style={{ fontSize:32 }} />
          </div>
          <h3 style={{ fontSize:"var(--tx-lg)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-2)" }}>
            No Attendance Data Yet
          </h3>
          <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", maxWidth:420, margin:"0 auto" }}>
            {isLecturer
              ? "Insights will appear once your students have marked attendance in your sessions."
              : "Insights will be available once attendance sessions are created and students mark their attendance."}
          </p>
        </div>
      </>
    );
  }

  const presentRate = parseFloat(data.overall.present_rate  || "0");
  const lateRate    = parseFloat(data.overall.late_rate     || "0");
  const absentCount = parseInt(data.overall.absent_count    || "0", 10);
  const totalRecs   = parseInt(data.overall.total_records   || "0", 10);

  return (
    <>
      {/* ---- Page header ---- */}
      <PageHeader isLecturer={isLecturer} />

      {/* ---- Context note ---- */}
      <div style={{ padding:"var(--sp-3) var(--sp-4)", background:"var(--accent-subtle)", border:"1px solid var(--accent-border)", borderRadius:"var(--radius-md)", marginBottom:"var(--sp-5)", fontSize:"var(--tx-sm)", color:"var(--text-secondary)" }}>
        <strong style={{ color:"var(--text-primary)" }}>Note:</strong>{" "}
        {isLecturer
          ? "All analytics below are calculated from real attendance data for your assigned courses only."
          : "All analytics below are calculated from real attendance data. This system does not include predictive AI or forecasting."}
      </div>

      {/* ---- Overall Statistics ---- */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:"var(--sp-4)", marginBottom:"var(--sp-6)" }}>
        <div className="card card-pad">
          <div style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:"var(--sp-2)" }}>
            {isLecturer ? "Your Attendance Rate" : "Overall Attendance Rate"}
          </div>
          <div style={{ fontSize:"var(--tx-2xl)", fontWeight:700, color: rateColor(presentRate) }}>
            {presentRate.toFixed(1)}%
          </div>
          <div style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>
            {data.overall.present_count} present of {data.overall.total_records} records
          </div>
        </div>

        <div className="card card-pad">
          <div style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:"var(--sp-2)" }}>
            Late Arrivals
          </div>
          <div style={{ fontSize:"var(--tx-2xl)", fontWeight:700, color:"var(--warning)" }}>
            {lateRate.toFixed(1)}%
          </div>
          <div style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>
            {data.overall.late_count} late arrivals
          </div>
        </div>

        <div className="card card-pad">
          <div style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:"var(--sp-2)" }}>
            Absent
          </div>
          <div style={{ fontSize:"var(--tx-2xl)", fontWeight:700, color:"var(--danger)" }}>
            {absentCount}
          </div>
          <div style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>
            {totalRecs > 0 ? ((absentCount / totalRecs) * 100).toFixed(1) : "0.0"}% absent
          </div>
        </div>
      </div>

      {/* ---- Students at Risk ---- */}
      {data.low_attendance_students.length > 0 && (
        <div className="card" style={{ marginBottom:"var(--sp-6)" }}>
          <div style={{ padding:"var(--sp-5) var(--sp-6)", borderBottom:"1px solid var(--border-subtle)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"var(--sp-2)", marginBottom:"var(--sp-2)" }}>
              <HiOutlineExclamationTriangle style={{ fontSize:20, color:"var(--warning)" }} />
              <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>
                {isLecturer ? "Students Needing Attention" : "Students with Low Attendance"}
              </h3>
            </div>
            <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>
              {isLecturer
                ? "Students in your courses with less than 75% attendance rate"
                : "Students with less than 75% attendance rate (Present records only)"}
            </p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft:"var(--sp-6)" }}>Student</th>
                  <th>Programme</th>
                  {isLecturer && <th>Course</th>}
                  <th>Total Sessions</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th style={{ paddingRight:"var(--sp-6)" }}>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.low_attendance_students.map((s, idx) => (
                  <tr key={`${s.id}-${idx}`}>
                    <td style={{ paddingLeft:"var(--sp-6)" }}>
                      <div style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--text-primary)" }}>
                        {s.full_name}
                      </div>
                      <div style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", fontFamily:"monospace", marginTop:2 }}>
                        {s.student_number}
                      </div>
                    </td>
                    <td style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>{s.programme}</td>
                    {isLecturer && (
                      <td style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>
                        {s.course_code ?? "—"}
                      </td>
                    )}
                    <td style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>{s.total_sessions_attended}</td>
                    <td style={{ fontSize:"var(--tx-sm)", color:"var(--success)" }}>{s.present_count}</td>
                    <td style={{ fontSize:"var(--tx-sm)", color:"var(--warning)" }}>{s.late_count}</td>
                    <td style={{ fontSize:"var(--tx-sm)", color:"var(--danger)" }}>{s.absent_count}</td>
                    <td style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--danger)", paddingRight:"var(--sp-6)" }}>
                      {parseFloat(s.attendance_rate).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Programme Performance (Admin only) ---- */}
      {!isLecturer && data.by_programme && data.by_programme.length > 0 && (
        <div className="card" style={{ marginBottom:"var(--sp-6)" }}>
          <div style={{ padding:"var(--sp-5) var(--sp-6)", borderBottom:"1px solid var(--border-subtle)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"var(--sp-2)", marginBottom:"var(--sp-2)" }}>
              <HiOutlineUserGroup style={{ fontSize:20, color:"var(--primary)" }} />
              <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>
                Programme Attendance Rates
              </h3>
            </div>
            <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>
              Attendance performance by programme
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft:"var(--sp-6)" }}>Programme</th>
                  <th>Students</th>
                  <th>Total Records</th>
                  <th>Present</th>
                  <th style={{ paddingRight:"var(--sp-6)" }}>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.by_programme.map((p, idx) => {
                  const rate = parseFloat(p.attendance_rate);
                  return (
                    <tr key={idx}>
                      <td style={{ paddingLeft:"var(--sp-6)", fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--text-primary)" }}>
                        {p.programme}
                      </td>
                      <td style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>{p.student_count}</td>
                      <td style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>{p.total_records}</td>
                      <td style={{ fontSize:"var(--tx-sm)", color:"var(--success)" }}>{p.present_count}</td>
                      <td style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:rateColor(rate), paddingRight:"var(--sp-6)" }}>
                        {rate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Course Performance ---- */}
      {data.course_rates.length > 0 && (
        <div className="card" style={{ marginBottom:"var(--sp-6)" }}>
          <div style={{ padding:"var(--sp-5) var(--sp-6)", borderBottom:"1px solid var(--border-subtle)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"var(--sp-2)", marginBottom:"var(--sp-2)" }}>
              <HiOutlineAcademicCap style={{ fontSize:20, color:"var(--accent)" }} />
              <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>
                {isLecturer ? "Your Courses" : "Course Attendance Rates"}
              </h3>
            </div>
            <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>
              {isLecturer
                ? "Attendance performance across your assigned courses"
                : "Attendance performance by course"}
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft:"var(--sp-6)" }}>Course</th>
                  <th>Programme</th>
                  <th>Total Records</th>
                  <th>Present</th>
                  {isLecturer && <th>Late</th>}
                  {isLecturer && <th>Absent</th>}
                  <th style={{ paddingRight:"var(--sp-6)" }}>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.course_rates.map((c, idx) => {
                  const rate = parseFloat(c.attendance_rate);
                  return (
                    <tr key={idx}>
                      <td style={{ paddingLeft:"var(--sp-6)" }}>
                        <div style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--text-primary)" }}>
                          {c.course_code}
                        </div>
                        <div style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", marginTop:2 }}>
                          {c.course_name}
                        </div>
                      </td>
                      <td style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>{c.programme}</td>
                      <td style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>{c.total_attendance}</td>
                      <td style={{ fontSize:"var(--tx-sm)", color:"var(--success)" }}>{c.present_count}</td>
                      {isLecturer && (
                        <td style={{ fontSize:"var(--tx-sm)", color:"var(--warning)" }}>{c.late_count ?? "0"}</td>
                      )}
                      {isLecturer && (
                        <td style={{ fontSize:"var(--tx-sm)", color:"var(--danger)" }}>{c.absent_count ?? "0"}</td>
                      )}
                      <td style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:rateColor(rate), paddingRight:"var(--sp-6)" }}>
                        {rate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Recent Trends ---- */}
      {data.recent_trends.length > 0 && (
        <div className="card">
          <div style={{ padding:"var(--sp-5) var(--sp-6)", borderBottom:"1px solid var(--border-subtle)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"var(--sp-2)", marginBottom:"var(--sp-2)" }}>
              <HiOutlineArrowTrendingUp style={{ fontSize:20, color:"var(--success)" }} />
              <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>
                {isLecturer ? "Attendance Trend (Last 14 Days)" : "Recent Trends (Last 7 Days)"}
              </h3>
            </div>
            <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>
              {isLecturer
                ? "Daily attendance rates across your sessions over the past two weeks"
                : "Daily attendance rates over the past week"}
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft:"var(--sp-6)" }}>Date</th>
                  <th>Total Records</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th style={{ paddingRight:"var(--sp-6)" }}>Present Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_trends.map((t, idx) => {
                  const rate = parseFloat(t.present_rate);
                  return (
                    <tr key={idx}>
                      <td style={{ paddingLeft:"var(--sp-6)", fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--text-primary)" }}>
                        {new Date(t.session_date).toLocaleDateString()}
                      </td>
                      <td style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>{t.total_records}</td>
                      <td style={{ fontSize:"var(--tx-sm)", color:"var(--success)" }}>{t.present_count}</td>
                      <td style={{ fontSize:"var(--tx-sm)", color:"var(--warning)" }}>{t.late_count}</td>
                      <td style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:rateColor(rate), paddingRight:"var(--sp-6)" }}>
                        {rate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

interface StudentInsightReport {
  summary: { total_sessions: number; present: number; late: number; absent: number; attendance_rate: number };
  courses: Array<{ course_id: number; course_code: string; course_name: string; attendance_rate: number; total_sessions: number }>;
}

function StudentInsights({ token }: { token: string | null }) {
  const [report, setReport] = useState<StudentInsightReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`${API_URL}/api/attendance/students/me/report`, { headers: getAuthHeaders(token) })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message); setReport(data); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load insights."))
      .finally(() => setLoading(false));
  }, [token]);
  if (loading) return <><PageHeader isLecturer={false} /><div className="card card-pad">Loading insights...</div></>;
  if (error) return <><PageHeader isLecturer={false} /><div className="card card-pad"><p style={{ color: "var(--danger-text)" }}>{error}</p></div></>;
  const courses = report?.courses ?? [];
  const best = courses.length ? courses.reduce((a, b) => a.attendance_rate >= b.attendance_rate ? a : b) : null;
  const lowest = courses.length ? courses.reduce((a, b) => a.attendance_rate <= b.attendance_rate ? a : b) : null;
  const health = (rate: number) => rate >= 85 ? "Excellent" : rate >= 75 ? "Good" : "Needs attention";
  return <><PageHeader isLecturer={false} />{!report || report.summary.total_sessions === 0 ? <div className="card card-pad"><h3>No attendance insights yet</h3><p style={{ color: "var(--text-muted)" }}>Insights will appear after attendance is recorded.</p></div> : <><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "var(--sp-4)", marginBottom: "var(--sp-5)" }}><div className="stat-card"><div className="stat-card-label">Overall attendance</div><div className="stat-card-value">{report.summary.attendance_rate}%</div></div><div className="stat-card"><div className="stat-card-label">Classes attended</div><div className="stat-card-value">{report.summary.present + report.summary.late}</div></div><div className="stat-card"><div className="stat-card-label">Best course</div><div className="stat-card-value" style={{ fontSize: "var(--tx-lg)" }}>{best?.course_code ?? "-"}</div></div><div className="stat-card"><div className="stat-card-label">Lowest course</div><div className="stat-card-value" style={{ fontSize: "var(--tx-lg)" }}>{lowest?.course_code ?? "-"}</div></div></div><div className="card"><div className="card-pad"><div className="card-title">Course health</div><div className="card-subtitle">Based on present and late attendance across recorded sessions.</div></div><div className="table-wrap"><table><thead><tr><th>Course</th><th>Attendance</th><th>Sessions</th><th>Health</th></tr></thead><tbody>{courses.map((course) => <tr key={course.course_id}><td><strong>{course.course_code}</strong><div style={{ color: "var(--text-muted)", fontSize: "var(--tx-xs)" }}>{course.course_name}</div></td><td>{course.attendance_rate}%</td><td>{course.total_sessions}</td><td><span className={`badge badge-sm ${course.attendance_rate >= 85 ? "badge-success" : course.attendance_rate >= 75 ? "badge-primary" : "badge-warning"}`}>{health(course.attendance_rate)}</span></td></tr>)}</tbody></table></div></div></>}</>;
}

export default function Insights() {
  const { user, token } = useAuth();
  if (user?.role === "student") return <StudentInsights token={token} />;
  return <AdminInsights />;
}
