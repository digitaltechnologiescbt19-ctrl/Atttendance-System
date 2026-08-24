import { useEffect, useState } from "react";
import { HiOutlineUser, HiOutlineLockClosed, HiOutlineSun } from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export default function LecturerSettings() {
  const { user, token, setUserFromServer } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isLecturer = user?.role === "lecturer";
  const lecturerId = isLecturer ? user?.linked_id ?? null : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [profile, setProfile] = useState({
    lecturer_number: "",
    full_name: "",
    email: "",
    department: "",
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [activeTab, setActiveTab] = useState<"profile" | "account" | "appearance">("profile");

  useEffect(() => {
    async function load() {
      if (!isLecturer || !lecturerId) {
        setError("No linked lecturer profile found.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_URL}/api/attendance/lecturers/${lecturerId}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error("Failed to load lecturer profile");
        const data = await res.json();
        setProfile({
          lecturer_number: data.lecturer_number ?? "",
          full_name: data.full_name ?? "",
          email: data.email ?? "",
          department: data.department ?? "",
        });
      } catch (err: any) {
        setError(err?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isLecturer, lecturerId, token]);

  async function saveProfile(e: any) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ full_name: profile.full_name, department: profile.department }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || "Failed to save profile");
      }
      setSuccessMsg("Profile updated");

      // Refresh auth user to get updated name
      const meRes = await fetch(`${API_URL}/api/auth/me`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (meRes.ok) {
        const meJson = await meRes.json();
        if (meJson?.user) setUserFromServer(meJson.user);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save profile");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  }

  async function changePassword(e: any) {
    e.preventDefault();
    setError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to change password");
      setSuccessMsg("Password changed successfully.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      setError(err?.message || "Failed to change password");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  }

  if (!isLecturer) {
    return (
      <div className="card card-pad">
        <h3>Settings</h3>
        <p>You do not have lecturer permissions to view this page.</p>
      </div>
    );
  }

  if (loading) return <div className="card card-pad">Loading...</div>;
  if (error) return <div className="card card-pad">Error: {error}</div>;

  function TabBtn({ id, label, icon }: { id: "profile" | "account" | "appearance"; label: string; icon: any }) {
    const active = activeTab === id;
    return (
      <button
        onClick={() => { setActiveTab(id); setError(null); setSuccessMsg(""); }}
        style={{
          padding: "var(--sp-3) var(--sp-4)",
          background: "none",
          border: "none",
          borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
          color: active ? "var(--primary)" : "var(--text-muted)",
          fontSize: "var(--tx-sm)",
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--sp-2)",
        }}
      >
        {icon}{label}
      </button>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-eyebrow">Lecturer</span>
          <h1 className="page-title">Settings</h1>
          <p className="page-desc">Manage profile, account and appearance.</p>
        </div>
      </div>

      {successMsg && (
        <div style={{ padding:"var(--sp-3) var(--sp-4)", background:"var(--success-subtle)", border:"1px solid var(--success-border)", borderRadius:"var(--radius-md)", marginBottom:"var(--sp-5)", display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
          <span style={{ fontSize:"var(--tx-sm)", color:"var(--success-text)" }}>{successMsg}</span>
        </div>
      )}

      <div style={{ display:"flex", gap:"var(--sp-2)", marginBottom:"var(--sp-5)", borderBottom:"1px solid var(--border-subtle)" }}>
        <TabBtn id="profile" label="Profile" icon={<HiOutlineUser style={{ fontSize:16 }} />} />
        <TabBtn id="account" label="Account" icon={<HiOutlineLockClosed style={{ fontSize:16 }} />} />
        <TabBtn id="appearance" label="Appearance" icon={<HiOutlineSun style={{ fontSize:16 }} />} />
      </div>

      {activeTab === "profile" && (
        <div className="card card-pad">
          <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-1)" }}>Profile</h3>
          <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginBottom:"var(--sp-5)" }}>Update your public profile information for reporting.</p>
          <form onSubmit={saveProfile}>
            <div style={{ display:"grid", gap:"var(--sp-4)", maxWidth:600 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} required disabled={saving} />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input className="form-input" value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} disabled={saving} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" value={profile.email} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Lecturer Number</label>
                <input className="form-input" value={profile.lecturer_number} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <input className="form-input" value={user?.role || "lecturer"} readOnly />
              </div>
            </div>
            <div style={{ marginTop:"var(--sp-5)" }}>
              <button type="submit" className="btn btn-primary btn-md" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "account" && (
        <div className="card card-pad">
          <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-1)" }}>Account</h3>
          <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginBottom:"var(--sp-5)" }}>Manage your account and security.</p>

          <div style={{ marginBottom:"var(--sp-6)", paddingBottom:"var(--sp-6)", borderBottom:"1px solid var(--border-subtle)" }}>
            <h4 style={{ fontSize:"var(--tx-sm)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-3)" }}>Account Information</h4>
            <div style={{ display:"grid", gap:"var(--sp-3)" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>Name</span>
                <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-primary)", fontWeight:500 }}>{user?.name || "—"}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>Email</span>
                <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-primary)", fontWeight:500 }}>{user?.email || "—"}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>Role</span>
                <span className="badge badge-sm badge-primary">{user?.role?.toUpperCase() || "LECTURER"}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize:"var(--tx-sm)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-3)" }}>Change Password</h4>
            <form onSubmit={changePassword}>
              <div style={{ display:"grid", gap:"var(--sp-4)", maxWidth:600 }}>
                <div className="form-group">
                  <label className="form-label">Current Password <span style={{ color:"var(--danger-text)" }}>*</span></label>
                  <input className="form-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={saving} required />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password <span style={{ color:"var(--danger-text)" }}>*</span></label>
                  <input className="form-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={saving} required />
                  <p style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>Must be at least 6 characters.</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password <span style={{ color:"var(--danger-text)" }}>*</span></label>
                  <input className="form-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={saving} required />
                </div>
              </div>
              <div style={{ marginTop:"var(--sp-5)" }}>
                <button type="submit" className="btn btn-primary btn-md" disabled={saving}>{saving ? "Changing..." : "Change Password"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "appearance" && (
        <div className="card card-pad">
          <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-1)" }}>Appearance</h3>
          <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginBottom:"var(--sp-5)" }}>Theme preferences.</p>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div>Theme</div>
            <button className="btn btn-ghost" onClick={toggleTheme}>{theme === 'dark' ? 'Switch to light' : 'Switch to dark'}</button>
          </div>
        </div>
      )}
    </>
  );
}
