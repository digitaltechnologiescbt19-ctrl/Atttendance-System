import { useEffect, useState } from "react";

interface Lecturer {
  id: number;
  full_name: string;
  lecturer_number: string;
  department?: string;
  email?: string;
  session_count?: number;
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

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function LecturerSummary() {
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  useEffect(() => {
    authFetch("/api/attendance/lecturers")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load lecturers");
        return r.json();
      })
      .then((data: Lecturer[]) => {
        setLecturers(Array.isArray(data) ? data.slice(0, 6) : []);
      })
      .catch(() => setError("Unable to load lecturer data"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card card-pad">
      <div className="card-header">
        <div>
          <div className="card-title">Lecturer Summary</div>
          <div className="card-subtitle">Active academic staff</div>
        </div>
      </div>

      {loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:"var(--sp-1)" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:"var(--sp-3)", padding:"var(--sp-3) 0", borderBottom:"1px solid var(--border-subtle)" }}>
              <div className="skeleton" style={{ width:34, height:34, borderRadius:"var(--radius-md)", flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div className="skeleton" style={{ height:13, width:"55%", marginBottom:5 }} />
                <div className="skeleton" style={{ height:11, width:"40%" }} />
              </div>
              <div className="skeleton" style={{ height:13, width:28 }} />
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

      {!loading && !error && lecturers.length === 0 && (
        <div className="empty-state" style={{ padding:"var(--sp-8) 0" }}>
          <div className="empty-title">No lecturers found</div>
          <div className="empty-desc">No lecturer records are available yet.</div>
        </div>
      )}

      {!loading && !error && lecturers.length > 0 && (
        <div>
          {lecturers.map((l) => (
            <div key={l.id} className="lecturer-row">
              <div className="lecturer-avatar">{initials(l.full_name)}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div className="lecturer-name">{l.full_name}</div>
                {l.department && (
                  <div className="lecturer-dept">{l.department}</div>
                )}
              </div>
              {l.session_count !== undefined && (
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div className="lecturer-stat">{l.session_count}</div>
                  <div className="lecturer-stat-label">sessions</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
