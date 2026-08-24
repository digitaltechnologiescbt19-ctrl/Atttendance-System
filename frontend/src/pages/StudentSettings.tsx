import { useEffect, useState, type ReactNode } from "react";
import { HiOutlineLockClosed, HiOutlineSun, HiOutlineUser } from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL ?? "";
type TabId = "profile" | "account" | "appearance";

function TabBtn({ active, id, label, icon, onClick }: { active: boolean; id: TabId; label: string; icon: ReactNode; onClick: (id: TabId) => void }) {
  return <button onClick={() => onClick(id)} style={{ padding: "var(--sp-3) var(--sp-4)", background: "none", border: "none", borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent", color: active ? "var(--primary)" : "var(--text-muted)", fontSize: "var(--tx-sm)", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}>{icon}{label}</button>;
}

export default function StudentSettings() {
  const { user, token, setUserFromServer } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isStudent = user?.role === "student";
  const studentId = isStudent ? user?.linked_id ?? null : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "account" | "appearance">("profile");
  const [profile, setProfile] = useState({ student_number: "", full_name: "", email: "", programme: "" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    async function load() {
      if (!isStudent || !studentId) { setError("No linked student profile found."); setLoading(false); return; }
      try {
        setLoading(true); setError(null);
        const res = await fetch(`${API_URL}/api/attendance/students/${studentId}`, { headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Failed to load student profile");
        setProfile({ student_number: data.student_number ?? "", full_name: data.full_name ?? "", email: data.email ?? "", programme: data.programme ?? "" });
      } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load profile"); }
      finally { setLoading(false); }
    }
    load();
  }, [isStudent, studentId, token]);

  function notifySuccess(message: string) { setSuccessMsg(message); setError(null); setTimeout(() => setSuccessMsg(""), 3000); }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/profile`, { method: "PATCH", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ full_name: profile.full_name }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to save profile");
      notifySuccess("Profile updated successfully.");
      const meRes = await fetch(`${API_URL}/api/auth/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (meRes.ok) { const meJson = await meRes.json(); if (meJson?.user) setUserFromServer(meJson.user); }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save profile"); }
    finally { setSaving(false); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!currentPassword || !newPassword || !confirmPassword) { setError("All password fields are required."); return; }
    if (newPassword !== confirmPassword) { setError("New passwords do not match."); return; }
    if (newPassword.length < 6) { setError("New password must be at least 6 characters."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to change password");
      notifySuccess("Password changed successfully."); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to change password"); }
    finally { setSaving(false); }
  }

  if (!isStudent) return <div className="card card-pad">You do not have student permissions to view this page.</div>;
  if (loading) return <div className="card card-pad">Loading...</div>;
  if (error && !profile.full_name) return <div className="card card-pad">Error: {error}</div>;

  return <>
    <div className="page-header"><div className="page-header-left"><span className="page-eyebrow">Student</span><h1 className="page-title">Settings</h1><p className="page-desc">Manage profile, account and appearance.</p></div></div>
    {successMsg && <div style={{ padding: "var(--sp-3) var(--sp-4)", background: "var(--success-subtle)", border: "1px solid var(--success-border)", borderRadius: "var(--radius-md)", marginBottom: "var(--sp-5)", color: "var(--success-text)" }}>{successMsg}</div>}
    {error && <div style={{ padding: "var(--sp-3) var(--sp-4)", background: "var(--danger-subtle)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-md)", marginBottom: "var(--sp-5)", color: "var(--danger-text)" }}>{error}</div>}
    <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-5)", borderBottom: "1px solid var(--border-subtle)" }}><TabBtn active={activeTab === "profile"} id="profile" label="Profile" icon={<HiOutlineUser style={{ fontSize: 16 }} />} onClick={(id) => { setActiveTab(id); setError(null); setSuccessMsg(""); }} /><TabBtn active={activeTab === "account"} id="account" label="Account" icon={<HiOutlineLockClosed style={{ fontSize: 16 }} />} onClick={(id) => { setActiveTab(id); setError(null); setSuccessMsg(""); }} /><TabBtn active={activeTab === "appearance"} id="appearance" label="Appearance" icon={<HiOutlineSun style={{ fontSize: 16 }} />} onClick={(id) => { setActiveTab(id); setError(null); setSuccessMsg(""); }} /></div>
    {activeTab === "profile" && <div className="card card-pad"><h3>Profile</h3><p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", marginBottom: "var(--sp-5)" }}>Update your student profile information.</p><form onSubmit={saveProfile}><div style={{ display: "grid", gap: "var(--sp-4)", maxWidth: 600 }}><div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} required disabled={saving} /></div><div className="form-group"><label className="form-label">Email</label><input className="form-input" value={profile.email} readOnly /></div><div className="form-group"><label className="form-label">Student Number</label><input className="form-input" value={profile.student_number} readOnly /></div><div className="form-group"><label className="form-label">Programme</label><input className="form-input" value={profile.programme} readOnly /></div></div><div style={{ marginTop: "var(--sp-5)" }}><button type="submit" className="btn btn-primary btn-md" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button></div></form></div>}
    {activeTab === "account" && <div className="card card-pad"><h3>Account</h3><p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", marginBottom: "var(--sp-5)" }}>Manage your account and security.</p><div style={{ marginBottom: "var(--sp-6)", paddingBottom: "var(--sp-6)", borderBottom: "1px solid var(--border-subtle)" }}><h4>Account Information</h4><p>Name: {user?.name || "-"}</p><p>Email: {user?.email || "-"}</p><p>Role: {user?.role?.toUpperCase() || "STUDENT"}</p></div><h4>Change Password</h4><form onSubmit={changePassword}><div style={{ display: "grid", gap: "var(--sp-4)", maxWidth: 600 }}><div className="form-group"><label className="form-label">Current Password</label><input className="form-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={saving} required /></div><div className="form-group"><label className="form-label">New Password</label><input className="form-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={saving} required /></div><div className="form-group"><label className="form-label">Confirm New Password</label><input className="form-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={saving} required /></div></div><div style={{ marginTop: "var(--sp-5)" }}><button type="submit" className="btn btn-primary btn-md" disabled={saving}>{saving ? "Changing..." : "Change Password"}</button></div></form></div>}
    {activeTab === "appearance" && <div className="card card-pad"><h3>Appearance</h3><p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", marginBottom: "var(--sp-5)" }}>Theme preferences.</p><div style={{ display: "flex", alignItems: "center", gap: 12 }}><span>Theme</span><button className="btn btn-ghost" onClick={toggleTheme}>{theme === "dark" ? "Switch to light" : "Switch to dark"}</button></div></div>}
  </>;
}
