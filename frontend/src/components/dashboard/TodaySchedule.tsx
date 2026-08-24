import { useEffect, useState } from "react";

interface Session {
  id: number;
  course_code: string;
  course_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

/** Read the JWT from whichever storage AuthContext used. */
function getToken(): string | null {
  return (
    localStorage.getItem("nbi-auth-token") ||
    sessionStorage.getItem("nbi-auth-token")
  );
}

function authFetch(url: string): Promise<Response> {
  const token = getToken();
  return fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function getStatus(session: Session): { label: string; cls: string } {
  const now   = new Date();
  const today = now.toISOString().split("T")[0];
  // Normalise session_date — may be a full ISO timestamp from some endpoints
  const sessionDay = session.session_date.split("T")[0];
  if (sessionDay !== today) {
    return { label: "Upcoming", cls: "badge badge-sm badge-accent" };
  }
  if (session.is_active) {
    return { label: "Active", cls: "badge badge-sm badge-success" };
  }
  const [endH, endM] = session.end_time.split(":").map(Number);
  const end = new Date();
  end.setHours(endH, endM, 0, 0);
  if (now > end) {
    return { label: "Completed", cls: "badge badge-sm badge-neutral" };
  }
  return { label: "Upcoming", cls: "badge badge-sm badge-accent" };
}

function formatTime(t: string): string {
  // Handles both "HH:MM" and "HH:MM:SS" formats
  const [h, m] = t.split(":").map(Number);
  const ampm   = h >= 12 ? "PM" : "AM";
  const hour   = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function TodaySchedule({ sessions: propSessions }: { sessions?: Session[] }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading,  setLoading]  = useState(!propSessions);
  const [error,    setError]    = useState("");

  useEffect(() => {
    // If sessions were passed as props (lecturer-scoped), use them directly
    if (propSessions !== undefined) {
      setSessions(propSessions);
      setLoading(false);
      return;
    }
    // Otherwise fetch institution-wide sessions (admin / fallback)
    authFetch("/api/attendance/sessions")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load sessions");
        return r.json();
      })
      .then((data: Session[]) => {
        const today    = new Date().toISOString().split("T")[0];
        const filtered = (Array.isArray(data) ? data : [])
          .filter((s) => s.session_date >= today)
          .slice(0, 5);
        setSessions(filtered);
      })
      .catch(() => setError("Unable to load schedule"))
      .finally(() => setLoading(false));
  }, [propSessions]);

  return (
    <div className="card card-pad">
      <div className="card-header">
        <div>
          <div className="card-title">Today's Schedule</div>
          <div className="card-subtitle">Active and upcoming sessions</div>
        </div>
      </div>

      {loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:"var(--sp-3)" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"var(--sp-3) 0", borderBottom:"1px solid var(--border-subtle)" }}>
              <div style={{ flex:1 }}>
                <div className="skeleton" style={{ height:13, width:"60%", marginBottom:6 }} />
                <div className="skeleton" style={{ height:11, width:"40%" }} />
              </div>
              <div className="skeleton" style={{ height:22, width:70, borderRadius:"var(--radius-full)" }} />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="empty-state" style={{ padding:"var(--sp-8) 0" }}>
          <div className="empty-title" style={{ fontSize:"var(--tx-sm)" }}>{error}</div>
          <div className="empty-desc">Check that the backend server is running.</div>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="empty-state" style={{ padding:"var(--sp-8) 0" }}>
          <div className="empty-title">No sessions scheduled</div>
          <div className="empty-desc">There are no upcoming attendance sessions for today.</div>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div>
          {sessions.map((s) => {
            const status = getStatus(s);
            return (
              <div key={s.id} className="class-row">
                <div>
                  <div className="class-name">{s.course_name}</div>
                  <div className="class-meta">
                    {s.course_code} &middot; {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  </div>
                </div>
                <span className={status.cls}>{status.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
