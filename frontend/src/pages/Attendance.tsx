import { useCallback, useEffect, useState } from "react";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineArrowPath,
  HiOutlineEye,
  HiOutlineMagnifyingGlass,
} from "react-icons/hi2";
import type { AttendanceRecord, Session } from "../types/attendance";
import { formatDate, formatTime } from "../types/attendance";
import { useAuth } from "../context/AuthContext";

/* ------------------------------------------------------------------ */
/*  Auth header helper                                                  */
/* ------------------------------------------------------------------ */

function getToken(): string | null {
  return (
    localStorage.getItem("nbi-auth-token") ||
    sessionStorage.getItem("nbi-auth-token")
  );
}

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

function authFetch(path: string): Promise<Response> {
  const t = getToken();
  return fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Status badges                                                       */
/* ------------------------------------------------------------------ */

function SessionBadge({ active }: { active: boolean }) {
  return active
    ? <span className="badge badge-sm badge-success">Open</span>
    : <span className="badge badge-sm badge-neutral">Closed</span>;
}

function AttendBadge({ status }: { status: string }) {
  if (status === "present") return <span className="badge badge-sm badge-success">Present</span>;
  if (status === "late")    return <span className="badge badge-sm badge-warning">Late</span>;
  if (status === "absent")  return <span className="badge badge-sm badge-danger">Absent</span>;
  return <span className="badge badge-sm badge-neutral">{status}</span>;
}

/* ------------------------------------------------------------------ */
/*  Session records drawer                                              */
/* ------------------------------------------------------------------ */

interface RecordsDrawerProps {
  session: Session;
  onClose: () => void;
}

function RecordsDrawer({ session, onClose }: RecordsDrawerProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    authFetch(`/api/attendance/records/by-session/${session.id}`)
      .then((r) => {
        if (r.status === 403) throw new Error("You are not authorised to view records for this session.");
        if (r.status === 404) throw new Error("Session not found.");
        if (!r.ok) throw new Error("Failed to load attendance records.");
        return r.json();
      })
      .then((data: AttendanceRecord[]) =>
        setRecords(Array.isArray(data)
          ? data.filter((r) => r.session_id === session.id)
          : [])
      )
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load attendance records."))
      .finally(() => setLoading(false));
  }, [session.id]);

  const present = records.filter((r) => r.status === "present").length;
  const late    = records.filter((r) => r.status === "late").length;
  const absent  = records.filter((r) => r.status === "absent").length;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "var(--bg-overlay)",
        display: "flex", justifyContent: "flex-end",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card"
        style={{
          width: "100%", maxWidth: 520, height: "100vh",
          borderRadius: 0, borderLeft: "1px solid var(--border-default)",
          overflowY: "auto", display: "flex", flexDirection: "column",
        }}
      >
        {/* Drawer header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          padding: "var(--sp-6)", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0,
        }}>
          <div>
            <h3 style={{ fontSize: "var(--tx-md)", fontWeight: 700, color: "var(--text-primary)" }}>
              Attendance Records
            </h3>
            <p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", marginTop: "var(--sp-1)" }}>
              {session.course_code} · {session.course_name}
            </p>
            <p style={{ fontSize: "var(--tx-xs)", color: "var(--text-muted)", marginTop: 2 }}>
              {formatDate(session.session_date)} · {formatTime(session.start_time)} – {formatTime(session.end_time)}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ padding: "6px 10px" }} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Summary row */}
        {!loading && !error && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)",
            gap: "var(--sp-3)", padding: "var(--sp-5) var(--sp-6)",
            borderBottom: "1px solid var(--border-subtle)", flexShrink: 0,
          }}>
            {[
              { label: "Present", count: present, color: "var(--success-text)" },
              { label: "Late",    count: late,    color: "var(--warning-text)" },
              { label: "Absent",  count: absent,  color: "var(--danger-text)"  },
            ].map(({ label, count, color }) => (
              <div key={label} style={{
                background: "var(--bg-surface-raised)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "var(--sp-4)", textAlign: "center",
              }}>
                <div style={{ fontSize: "var(--tx-xl)", fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: "var(--tx-xs)", color: "var(--text-muted)", marginTop: "var(--sp-1)" }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Records body */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {loading && (
            <div style={{ padding: "var(--sp-6)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {[1,2,3,4,5].map((i) => (
                <div key={i} style={{ display: "flex", gap: "var(--sp-3)" }}>
                  <div className="skeleton" style={{ flex: 2, height: 13 }} />
                  <div className="skeleton" style={{ flex: 1, height: 13 }} />
                  <div className="skeleton" style={{ width: 55, height: 20, borderRadius: "var(--radius-full)" }} />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="empty-state" style={{ padding: "var(--sp-8) var(--sp-6)" }}>
              <div className="empty-title">{error}</div>
            </div>
          )}

          {!loading && !error && records.length === 0 && (
            <div className="empty-state" style={{ padding: "var(--sp-8) var(--sp-6)" }}>
              <div className="empty-icon"><HiOutlineClipboardDocumentList /></div>
              <div className="empty-title">No records yet</div>
              <div className="empty-desc">No students have checked in for this session.</div>
            </div>
          )}

          {!loading && !error && records.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: "var(--sp-6)" }}>Student</th>
                    <th>ID</th>
                    <th>Check-in</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td style={{ paddingLeft: "var(--sp-6)", color: "var(--text-primary)", fontWeight: 500 }}>
                        {r.full_name ?? "—"}
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "var(--tx-xs)" }}>
                        {r.student_number ?? "—"}
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: "var(--tx-xs)" }}>
                        {r.check_in_time
                          ? new Date(r.check_in_time).toLocaleTimeString("en-GB", {
                              hour: "2-digit", minute: "2-digit", second: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td><AttendBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Attendance page                                                */
/* ------------------------------------------------------------------ */

export default function Attendance() {
  const { user, token } = useAuth();

  // For lecturers: use linked_id to scope sessions to their courses only.
  // The backend enforces ownership — this is just the correct URL to call.
  const lecturerId = user?.role === "lecturer" ? (user.linked_id ?? null) : null;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<"all" | "open" | "closed">("all");
  const [drawer,   setDrawer]   = useState<Session | null>(null);

  /* Build auth headers from context token (with storage fallback) */
  function authHeaders(): HeadersInit {
    const t = token ||
      localStorage.getItem("nbi-auth-token") ||
      sessionStorage.getItem("nbi-auth-token");
    return {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    };
  }

  const loadSessions = useCallback(async () => {
    setLoading(true); setError("");
    try {
      // Lecturers: use the scoped endpoint so only their own sessions are returned.
      // Admins/others: use the institution-wide endpoint.
      const url = lecturerId
        ? `${BASE_URL}/api/attendance/lecturers/${lecturerId}/sessions`
        : `${BASE_URL}/api/attendance/sessions`;

      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { message?: string }).message || "Failed to load sessions.");
      }
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load attendance sessions.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturerId, token]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  /* Filtered + searched */
  const displayed = sessions.filter((s) => {
    if (filter === "open"   && !s.is_active) return false;
    if (filter === "closed" &&  s.is_active) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !s.course_name?.toLowerCase().includes(q) &&
        !s.course_code?.toLowerCase().includes(q) &&
        !s.session_date?.includes(q)
      ) return false;
    }
    return true;
  });

  /* Stats for summary row */
  const totalOpen   = sessions.filter((s) =>  s.is_active).length;
  const totalClosed = sessions.filter((s) => !s.is_active).length;

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-eyebrow">Records</span>
          <h1 className="page-title">Attendance</h1>
          <p className="page-desc">
            {user?.role === "admin"
              ? "Institution-wide attendance sessions and records."
              : "Attendance sessions and records for your courses."}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost btn-md" onClick={loadSessions} title="Refresh">
            <span className="btn-icon"><HiOutlineArrowPath /></span>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {!loading && !error && sessions.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3,1fr)",
          gap: "var(--sp-4)", marginBottom: "var(--sp-6)",
        }} className="attendance-summary-strip">
          {[
            { label: "Total Sessions", value: sessions.length,  color: "var(--accent)" },
            { label: "Open",           value: totalOpen,         color: "var(--success-text)" },
            { label: "Closed",         value: totalClosed,       color: "var(--text-muted)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">{label}</span>
              </div>
              <div className="stat-card-value" style={{ fontSize: "var(--tx-2xl)", color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter + search bar */}
      <div style={{
        display: "flex", gap: "var(--sp-3)", flexWrap: "wrap",
        alignItems: "center", marginBottom: "var(--sp-5)",
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 340 }}>
          <span style={{
            position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-muted)", fontSize: 15, pointerEvents: "none", display: "flex",
          }}>
            <HiOutlineMagnifyingGlass />
          </span>
          <input
            className="form-input"
            style={{ paddingLeft: 34, width: "100%" }}
            placeholder="Search by course or date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter buttons */}
        {(["all", "open", "closed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
            style={{ textTransform: "capitalize" }}
          >
            {f === "all" ? "All" : f === "open" ? "Open" : "Closed"}
          </button>
        ))}
      </div>

      {/* Sessions table */}
      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Sessions</div>
              <div className="card-subtitle">
                {loading ? "Loading…" : `${displayed.length} of ${sessions.length} sessions`}
              </div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: "var(--sp-6)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            {[1,2,3,4].map((i) => (
              <div key={i} style={{ display: "flex", gap: "var(--sp-4)" }}>
                <div className="skeleton" style={{ flex: 3, height: 14 }} />
                <div className="skeleton" style={{ flex: 1, height: 14 }} />
                <div className="skeleton" style={{ flex: 1, height: 14 }} />
                <div className="skeleton" style={{ width: 60, height: 22, borderRadius: "var(--radius-full)" }} />
                <div className="skeleton" style={{ width: 80, height: 28, borderRadius: "var(--radius-md)" }} />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="empty-state">
            <div className="empty-title">{error}</div>
            <div className="empty-desc">Ensure the backend server is running.</div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && displayed.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"><HiOutlineClipboardDocumentList /></div>
            <div className="empty-title">No sessions found</div>
            <div className="empty-desc">
              {search || filter !== "all"
                ? "No sessions match your current filters."
                : user?.role === "lecturer"
                  ? "No attendance sessions found for your assigned courses."
                  : "No attendance sessions have been created yet."}
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && !error && displayed.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: "var(--sp-6)" }}>Course</th>
                  <th>Code</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right", paddingRight: "var(--sp-6)" }}>Records</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((s) => (
                  <tr key={s.id}>
                    <td style={{
                      paddingLeft: "var(--sp-6)",
                      color: "var(--text-primary)", fontWeight: 500,
                    }}>
                      {s.course_name}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "var(--tx-xs)", color: "var(--text-secondary)" }}>
                      {s.course_code}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(s.session_date)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatTime(s.start_time)} – {formatTime(s.end_time)}
                    </td>
                    <td><SessionBadge active={s.is_active} /></td>
                    <td style={{ textAlign: "right", paddingRight: "var(--sp-6)" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDrawer(s)}
                        title="View attendance records"
                      >
                        <span className="btn-icon"><HiOutlineEye /></span>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Records drawer */}
      {drawer && (
        <RecordsDrawer
          session={drawer}
          onClose={() => setDrawer(null)}
        />
      )}

      {/* Responsive — stack summary strip on mobile */}
      <style>{`
        @media (max-width: 520px) {
          .attendance-summary-strip { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
