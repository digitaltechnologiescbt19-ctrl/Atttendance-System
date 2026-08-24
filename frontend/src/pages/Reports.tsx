import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import {
  HiOutlineArrowDownTray,
  HiOutlineFunnel,
  HiOutlineXMark,
  HiOutlineExclamationTriangle,
  HiOutlineChartBarSquare,
} from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL ?? "";

/* ------------------------------------------------------------------ */
/*  Auth helper — reads from context token with storage fallback       */
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
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  programme?: string;
}

interface AttendanceRecord {
  id: number;
  status: "present" | "late" | "absent";
  check_in_time: string;
  student_id: number;
  student_number: string;
  student_name: string;
  student_programme: string;
  course_id: number;
  course_code: string;
  course_name: string;
  course_programme: string;
  session_date: string;
  start_time: string;
  end_time: string;
  lecturer_name: string | null;
}

interface AttendanceStats {
  status_breakdown: Array<{ status: string; count: string }>;
  totals: {
    total_sessions: string;
    total_students: string;
    total_records: string;
  };
  by_course: Array<{
    course_code: string;
    course_name: string;
    total_attendance: string;
    present_count: string;
    late_count: string;
    absent_count: string;
  }>;
}

const PROGRAMMES = [
  "Frontend Engineering",
  "Backend Engineering",
  "Flutter Development",
  "Cybersecurity",
  "Artificial Intelligence",
  "Machine Learning",
  "UI/UX Design",
  "Data Analytics",
  "Product Design",
  "Software Engineering",
];

/* ------------------------------------------------------------------ */
/*  Main Reports Page                                                   */
/* ------------------------------------------------------------------ */

function AdminReports() {
  const { user, token } = useAuth();

  // For lecturers: linked_id is the authoritative lecturer ID.
  // It comes from the JWT — it cannot be spoofed by the browser.
  const isLecturer = user?.role === "lecturer";
  const lecturerId = isLecturer ? (user?.linked_id ?? null) : null;

  /* --- data state --- */
  const [records,     setRecords]     = useState<AttendanceRecord[]>([]);
  const [stats,       setStats]       = useState<AttendanceStats | null>(null);
  const [courses,     setCourses]     = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  /* --- filters --- */
  const [courseId,      setCourseId]      = useState("");
  const [programme,     setProgramme]     = useState("");
  const [startDate,     setStartDate]     = useState("");
  const [endDate,       setEndDate]       = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");

  /* ---------------------------------------------------------------- */
  /*  Load courses on mount                                            */
  /*  Lecturers: scoped to their own courses only.                    */
  /*  Admins/others: all institution courses.                         */
  /* ---------------------------------------------------------------- */
  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);
    try {
      const url = lecturerId
        ? `${API_URL}/api/attendance/lecturers/${lecturerId}/courses`
        : `${API_URL}/api/attendance/courses`;

      const res = await fetch(url, { headers: getAuthHeaders(token) });
      if (!res.ok) throw new Error("Failed to load courses");
      const data = await res.json();
      setCourses(Array.isArray(data) ? data : []);
    } catch {
      // Non-fatal — course dropdown just won't populate
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }, [lecturerId, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCourses();
  }, [loadCourses]);

  /* ---------------------------------------------------------------- */
  /*  Generate report                                                  */
  /*  For lecturers: lecturer_id is always injected by the frontend   */
  /*  AND verified server-side against the JWT identity.              */
  /* ---------------------------------------------------------------- */
  async function generateReport() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      // For lecturers: always scope to their own lecturer_id.
      // The backend will reject requests where this doesn't match
      // the authenticated user's linked_id.
      if (lecturerId) {
        params.append("lecturer_id", String(lecturerId));
      }

      if (courseId)     params.append("course_id",  courseId);
      if (programme)    params.append("programme",  programme);
      if (startDate)    params.append("start_date", startDate);
      if (endDate)      params.append("end_date",   endDate);
      if (statusFilter) params.append("status",     statusFilter);

      const [reportResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/api/attendance/reports/attendance?${params.toString()}`, {
          headers: getAuthHeaders(token),
        }),
        fetch(`${API_URL}/api/attendance/reports/stats?${params.toString()}`, {
          headers: getAuthHeaders(token),
        }),
      ]);

      if (reportResponse.status === 403 || statsResponse.status === 403) {
        throw new Error("Access denied. You can only generate reports for your own courses.");
      }
      if (!reportResponse.ok || !statsResponse.ok) {
        throw new Error("Failed to generate report. Please try again.");
      }

      const reportData  = await reportResponse.json();
      const statsData   = await statsResponse.json();

      setRecords(reportData);
      setStats(statsData);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  CSV Export — contains only what the backend returned            */
  /* ---------------------------------------------------------------- */
  function exportToCSV() {
    if (records.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = [
      "Date", "Course Code", "Course Name",
      "Student Number", "Student Name", "Programme",
      "Status", "Check-in Time", "Lecturer",
    ];

    const rows = records.map((r) => [
      r.session_date,
      r.course_code,
      r.course_name,
      r.student_number,
      r.student_name,
      r.student_programme,
      r.status.toUpperCase(),
      new Date(r.check_in_time).toLocaleTimeString(),
      r.lecturer_name || "Not assigned",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute(
      "download",
      `attendance_report_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ---------------------------------------------------------------- */
  /*  Clear filters                                                    */
  /* ---------------------------------------------------------------- */
  function clearFilters() {
    setCourseId("");
    setProgramme("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("");
    setRecords([]);
    setStats(null);
  }

  const filtersActive = !!(courseId || programme || startDate || endDate || statusFilter);

  /* ---------------------------------------------------------------- */
  /*  Summary cards                                                    */
  /* ---------------------------------------------------------------- */
  const summaryCards = useMemo(() => {
    if (!stats) return [];
    const present = parseInt(stats.status_breakdown.find((s) => s.status === "present")?.count || "0");
    const late    = parseInt(stats.status_breakdown.find((s) => s.status === "late")?.count    || "0");
    const absent  = parseInt(stats.status_breakdown.find((s) => s.status === "absent")?.count  || "0");
    return [
      { label: "Total Records",  value: stats.totals.total_records, color: "var(--text-primary)" },
      { label: "Present",        value: present,                    color: "var(--success)" },
      { label: "Late",           value: late,                       color: "var(--warning)" },
      { label: "Absent",         value: absent,                     color: "var(--danger)" },
      { label: "Total Sessions", value: stats.totals.total_sessions, color: "var(--accent)" },
      { label: "Total Students", value: stats.totals.total_students, color: "var(--primary)" },
    ];
  }, [stats]);

  /* ---------------------------------------------------------------- */
  /*  Guard: lecturer with no linked_id                               */
  /* ---------------------------------------------------------------- */
  if (isLecturer && !lecturerId) {
    return (
      <div className="empty-state" style={{ padding: "var(--sp-12)" }}>
        <div className="empty-icon"><HiOutlineChartBarSquare /></div>
        <div className="empty-title">No lecturer profile linked</div>
        <div className="empty-desc">
          Your account does not have a lecturer profile. Contact your administrator.
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-eyebrow">Analytics</span>
          <h1 className="page-title">Reports</h1>
          <p className="page-desc">
            {isLecturer
              ? "Generate and export attendance reports for your assigned courses."
              : "Generate and export attendance reports by course, lecturer or date range."}
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary btn-md"
            onClick={exportToCSV}
            disabled={records.length === 0}
          >
            <span className="btn-icon"><HiOutlineArrowDownTray /></span>
            Export CSV
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: "var(--sp-4)",
          background: "var(--danger-subtle)",
          border: "1px solid var(--danger-border)",
          borderRadius: "var(--radius-md)",
          marginBottom: "var(--sp-5)",
          display: "flex", alignItems: "center", gap: "var(--sp-3)",
        }}>
          <HiOutlineExclamationTriangle style={{ fontSize: 20, color: "var(--danger-text)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--tx-sm)", fontWeight: 600, color: "var(--danger-text)" }}>
              Failed to generate report
            </div>
            <div style={{ fontSize: "var(--tx-sm)", color: "var(--danger-text)", marginTop: 2 }}>
              {error}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card card-pad" style={{ marginBottom: "var(--sp-5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "var(--sp-4)" }}>
          <HiOutlineFunnel style={{ fontSize: 18, color: "var(--text-primary)" }} />
          <h3 style={{ fontSize: "var(--tx-md)", fontWeight: 700, color: "var(--text-primary)" }}>
            Report Filters
          </h3>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--sp-4)",
          marginBottom: "var(--sp-5)",
        }}>
          {/* Course — shows only lecturer's courses for lecturers */}
          <div className="form-group">
            <label className="form-label">Course</label>
            {coursesLoading ? (
              <div className="skeleton" style={{ height: 38, borderRadius: "var(--radius-md)" }} />
            ) : courses.length === 0 && isLecturer ? (
              <p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", margin: "8px 0" }}>
                No courses assigned to you yet.
              </p>
            ) : (
              <select
                className="form-input"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                disabled={loading}
              >
                <option value="">{isLecturer ? "All My Courses" : "All Courses"}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} — {c.course_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Programme */}
          <div className="form-group">
            <label className="form-label">Programme</label>
            <select
              className="form-input"
              value={programme}
              onChange={(e) => setProgramme(e.target.value)}
              disabled={loading}
            >
              <option value="">All Programmes</option>
              {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Start Date */}
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* End Date */}
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Status */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={loading}
            >
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          <button
            className="btn btn-primary btn-md"
            onClick={generateReport}
            disabled={loading || (isLecturer && courses.length === 0)}
          >
            {loading ? "Generating..." : "Generate Report"}
          </button>
          {filtersActive && (
            <button className="btn btn-ghost btn-md" onClick={clearFilters} disabled={loading}>
              <span className="btn-icon"><HiOutlineXMark /></span>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      {stats && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--sp-4)",
          marginBottom: "var(--sp-5)",
        }}>
          {summaryCards.map((card) => (
            <div key={card.label} className="card card-pad">
              <div style={{
                fontSize: "var(--tx-xs)", color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "var(--sp-2)",
              }}>
                {card.label}
              </div>
              <div style={{ fontSize: "var(--tx-2xl)", fontWeight: 700, color: card.color }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results table */}
      {records.length > 0 && (
        <div className="card">
          <div style={{
            padding: "var(--sp-4) var(--sp-6)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)" }}>
              {records.length} {records.length === 1 ? "record" : "records"} found
            </span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: "var(--sp-6)" }}>Date</th>
                  <th>Course</th>
                  <th>Student</th>
                  <th>Programme</th>
                  <th>Status</th>
                  <th>Check-in Time</th>
                  <th style={{ paddingRight: "var(--sp-6)" }}>Lecturer</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td style={{ paddingLeft: "var(--sp-6)", whiteSpace: "nowrap" }}>
                      {new Date(r.session_date).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ fontSize: "var(--tx-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                        {r.course_code}
                      </div>
                      <div style={{ fontSize: "var(--tx-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                        {r.course_name}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: "var(--tx-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                        {r.student_name}
                      </div>
                      <div style={{ fontSize: "var(--tx-xs)", color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>
                        {r.student_number}
                      </div>
                    </td>
                    <td style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)" }}>
                      {r.student_programme}
                    </td>
                    <td>
                      <span className={`badge badge-sm ${
                        r.status === "present" ? "badge-success" :
                        r.status === "late"    ? "badge-warning" : "badge-danger"
                      }`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {new Date(r.check_in_time).toLocaleTimeString()}
                    </td>
                    <td style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", paddingRight: "var(--sp-6)" }}>
                      {r.lecturer_name || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && records.length === 0 && !error && (
        <div className="card card-pad" style={{ textAlign: "center", padding: "var(--sp-12)" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 64, height: 64, borderRadius: "var(--radius-lg)",
            background: "var(--accent-subtle)", border: "1px solid var(--accent-border)",
            color: "var(--accent)", marginBottom: "var(--sp-4)",
          }}>
            <HiOutlineChartBarSquare style={{ fontSize: 32 }} />
          </div>
          <h3 style={{ fontSize: "var(--tx-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--sp-2)" }}>
            {isLecturer && courses.length === 0
              ? "No Courses Assigned"
              : filtersActive
                ? "No Records Found"
                : "Generate a Report"}
          </h3>
          <p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", maxWidth: 420, margin: "0 auto" }}>
            {isLecturer && courses.length === 0
              ? "No courses have been assigned to you yet. Contact your administrator."
              : filtersActive
                ? "No attendance records match your current filters. Try adjusting your criteria."
                : "Select filters above and click Generate Report to view attendance data."}
          </p>
        </div>
      )}
    </>
  );
}

export default function Reports() {
  const { user, token } = useAuth();
  if (user?.role === "student") return <StudentReports token={token} />;
  if (user?.role === "lecturer") return <LecturerReports token={token} lecturerId={user.linked_id ?? null} />;
  return <AdminReports />;
}

interface StudentReportData {
  summary: { total_sessions: number; present: number; late: number; absent: number; attendance_rate: number };
  courses: Array<{ course_id: number; course_code: string; course_name: string; total_sessions: number; present: number; late: number; absent: number; attendance_rate: number }>;
  records: Array<{ session_date: string; course_code: string; course_name: string; status: string; check_in_time: string | null }>;
}

function StudentReports({ token }: { token: string | null }) {
  const [data, setData] = useState<StudentReportData | null>(null);
  const [courseId, setCourseId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    const query = new URLSearchParams();
    if (courseId) query.set("course_id", courseId);
    if (startDate) query.set("start_date", startDate);
    if (endDate) query.set("end_date", endDate);
    try {
      const response = await fetch(`${API_URL}/api/attendance/students/me/report?${query}`, { headers: getAuthHeaders(token) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not load your report.");
      setData(result);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not load your report."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, courseId, startDate, endDate]);
  return <><div className="page-header"><div className="page-header-left"><span className="page-eyebrow">My attendance</span><h1 className="page-title">Reports</h1><p className="page-desc">Track your attendance across every enrolled course.</p></div></div>{error && <div style={{ marginBottom: "var(--sp-5)" }}><Notice text={error} /></div>}<div className="card card-pad" style={{ marginBottom: "var(--sp-5)" }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "var(--sp-4)" }}><Field label="Course"><select className="form-input" value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">All courses</option>{data?.courses.map((course) => <option key={course.course_id} value={course.course_id}>{course.course_code}</option>)}</select></Field><Field label="From"><input className="form-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field><Field label="To"><input className="form-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field></div></div>{loading ? <div className="card card-pad">Loading your attendance...</div> : data && <><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "var(--sp-4)", marginBottom: "var(--sp-5)" }}>{[["Attendance rate", `${data.summary.attendance_rate}%`], ["Total classes", data.summary.total_sessions], ["Present", data.summary.present], ["Late", data.summary.late], ["Absent", data.summary.absent]].map(([label, value]) => <div className="stat-card" key={label}><div className="stat-card-label">{label}</div><div className="stat-card-value">{value}</div></div>)}</div><div className="card"><div className="card-pad"><div className="card-title">Course breakdown</div><div className="card-subtitle">Attendance health across your enrolled courses.</div></div><div className="table-wrap"><table><thead><tr><th>Course</th><th>Sessions</th><th>Present</th><th>Late</th><th>Absent</th><th>Rate</th></tr></thead><tbody>{data.courses.map((course) => <tr key={course.course_id}><td><strong>{course.course_code}</strong><div style={{ fontSize: "var(--tx-xs)", color: "var(--text-muted)" }}>{course.course_name}</div></td><td>{course.total_sessions}</td><td>{course.present}</td><td>{course.late}</td><td>{course.absent}</td><td>{course.attendance_rate}%</td></tr>)}</tbody></table></div></div></>}</>;
}

function reportDate(value: string) { const date = new Date(`${value.slice(0, 10)}T12:00:00`); return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString(); }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="form-group"><label className="form-label">{label}</label>{children}</div>; }
function Notice({ text }: { text: string }) { return <div style={{ padding: "var(--sp-3) var(--sp-4)", background: "var(--danger-subtle)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-md)", color: "var(--danger-text)" }}>{text}</div>; }

function LecturerReports({ token, lecturerId }: { token: string | null; lecturerId: number | null }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [students, setStudents] = useState<Array<{ student_id: number; student_number: string; full_name: string; present: number; late: number; absent: number; total_sessions: number; attendance_rate: number }>>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<Array<{ session_date: string; status: string; check_in_time: string | null }>>([]);
  const [error, setError] = useState("");
  useEffect(() => { if (!lecturerId) return; fetch(`${API_URL}/api/attendance/lecturers/${lecturerId}/courses`, { headers: getAuthHeaders(token) }).then((response) => response.json()).then((value) => setCourses(Array.isArray(value) ? value : [])).catch(() => setError("Could not load assigned courses.")); }, [lecturerId, token]);
  useEffect(() => { if (!lecturerId || !courseId) return; fetch(`${API_URL}/api/attendance/lecturers/${lecturerId}/courses/${courseId}/report`, { headers: getAuthHeaders(token) }).then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.message); setStudents(value); }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load course report.")); }, [lecturerId, courseId, token]);
  async function openStudent(studentId: number) { if (!lecturerId || !courseId) return; const response = await fetch(`${API_URL}/api/attendance/lecturers/${lecturerId}/courses/${courseId}/students/${studentId}`, { headers: getAuthHeaders(token) }); const value = await response.json(); if (response.ok) { setSelected(studentId); setHistory(value); } }
  return <><div className="page-header"><div className="page-header-left"><span className="page-eyebrow">Lecturer reporting</span><h1 className="page-title">Reports</h1><p className="page-desc">Review attendance performance for your assigned courses.</p></div></div>{error && <Notice text={error} />}<div className="card card-pad" style={{ marginBottom: "var(--sp-5)" }}><Field label="Course"><select className="form-input" value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Select an assigned course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.course_code} - {course.course_name}</option>)}</select></Field></div>{courseId && <div className="card"><div className="card-pad"><div className="card-title">Course attendance summary</div><div className="card-subtitle">Select a student to view their session history.</div></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Present</th><th>Late</th><th>Absent</th><th>Rate</th></tr></thead><tbody>{students.slice().sort((a, b) => a.attendance_rate - b.attendance_rate).map((student) => <tr key={student.student_id} onClick={() => void openStudent(student.student_id)} style={{ cursor: "pointer" }}><td><strong>{student.full_name}</strong><div style={{ fontSize: "var(--tx-xs)", color: "var(--text-muted)" }}>{student.student_number}</div></td><td>{student.present}</td><td>{student.late}</td><td>{student.absent}</td><td>{student.attendance_rate}%</td></tr>)}</tbody></table></div></div>}{selected && <div className="card card-pad" style={{ marginTop: "var(--sp-5)" }}><div className="card-title">Student attendance history</div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Check-in</th><th>Status</th></tr></thead><tbody>{history.map((record, index) => <tr key={index}><td>{reportDate(record.session_date)}</td><td>{record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "-"}</td><td>{record.status}</td></tr>)}</tbody></table></div></div>}</>;
}
