import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export default function Profile() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true); setError(null);
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!res.ok) throw new Error("Failed to load profile");
        const j = await res.json();
        setProfile(j.user);
      } catch (err: any) {
        setError(err?.message || "Failed to load profile");
      } finally { setLoading(false); }
    }
    load();
  }, [token]);

  if (loading) return <div className="card card-pad">Loading profile…</div>;
  if (error) return <div className="card card-pad">Error: {error}</div>;
  if (!profile) return <div className="card card-pad">No profile available.</div>;

  return (
    <div>
      <div className="page-header"><div className="page-header-left"><h1 className="page-title">Profile</h1></div></div>
      <div className="card card-pad">
        <div style={{ display: "grid", gap: 12, maxWidth: 600 }}>
          <div><strong>Name:</strong> {profile.name}</div>
          <div><strong>Email:</strong> {profile.email}</div>
          <div><strong>Role:</strong> {profile.role}</div>
          <div><strong>Linked ID:</strong> {profile.linked_id ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}
