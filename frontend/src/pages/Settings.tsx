import React, { useState, useEffect } from "react";
import {
  HiOutlineBuildingOffice2,
  HiOutlineClock,
  HiOutlineUserCircle,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";
import { useAuth } from "../context/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface InstituteSettings {
  name: string;
  short_name: string;
  email: string;
  phone: string;
  address: string;
}

interface AttendanceSettings {
  present_window_minutes: number;
  late_threshold_minutes: number;
  session_duration_minutes: number;
}

/* ------------------------------------------------------------------ */
/*  Auth header helper (reads from storage matching AuthContext)       */
/* ------------------------------------------------------------------ */

function getAuthHeaders(token: string | null): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* ------------------------------------------------------------------ */
/*  Main Settings Page                                                  */
/* ------------------------------------------------------------------ */

export default function Settings() {
  const { user, token } = useAuth();

  /* --- Institute Settings --- */
  const [instituteName,      setInstituteName]      = useState("NBI Institute");
  const [instituteShortName, setInstituteShortName] = useState("NBI");
  const [instituteEmail,     setInstituteEmail]     = useState("info@nbi.edu.gh");
  const [institutePhone,     setInstitutePhone]     = useState("+233 XX XXX XXXX");
  const [instituteAddress,   setInstituteAddress]   = useState("Accra, Ghana");

  /* --- Attendance Settings --- */
  const [presentWindow,   setPresentWindow]   = useState(10);
  const [lateThreshold,   setLateThreshold]   = useState(10);
  const [sessionDuration, setSessionDuration] = useState(60);

  /* --- Account Settings --- */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,      setNewPassword]     = useState("");
  const [confirmPassword,  setConfirmPassword] = useState("");

  /* --- UI State --- */
  const [saving,          setSaving]         = useState(false);
  const [activeTab,       setActiveTab]      = useState<"institute" | "attendance" | "account">("institute");
  const [successMessage,  setSuccessMessage] = useState("");
  const [errorMessage,    setErrorMessage]   = useState("");

/* ------------------------------------------------------------------ */
/*  Load settings on mount — backend first, fallback to localStorage  */
/* ------------------------------------------------------------------ */

  useEffect(() => {
    async function loadSettings() {
      try {
        // Load institute settings from localStorage (no backend table yet)
        const savedInstitute = localStorage.getItem("settings_institute");
        if (savedInstitute) {
          const d: InstituteSettings = JSON.parse(savedInstitute);
          setInstituteName(d.name            || "NBI Institute");
          setInstituteShortName(d.short_name || "NBI");
          setInstituteEmail(d.email          || "");
          setInstitutePhone(d.phone          || "");
          setInstituteAddress(d.address      || "");
        }

        // Load attendance rules from backend system_settings table
        const res = await fetch(`${BASE_URL}/api/attendance/settings/attendance_rules`, {
          headers: getAuthHeaders(token),
        });
        if (res.ok) {
          const row = await res.json();
          const d: AttendanceSettings = row.value || {};
          setPresentWindow(d.present_window_minutes    ?? 10);
          setLateThreshold(d.late_threshold_minutes    ?? 10);
          setSessionDuration(d.session_duration_minutes ?? 60);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
    loadSettings();
  }, [token]);

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  function showSuccess(msg: string) {
    setSuccessMessage(msg);
    setErrorMessage("");
    setTimeout(() => setSuccessMessage(""), 3500);
  }

  function showError(msg: string) {
    setErrorMessage(msg);
    setSuccessMessage("");
  }

  /* ---------------------------------------------------------------- */
  /*  Save Institute Settings (localStorage)                          */
  /* ---------------------------------------------------------------- */

  async function saveInstituteSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const settings: InstituteSettings = {
        name:       instituteName,
        short_name: instituteShortName,
        email:      instituteEmail,
        phone:      institutePhone,
        address:    instituteAddress,
      };
      localStorage.setItem("settings_institute", JSON.stringify(settings));
      showSuccess("Institute settings saved.");
    } catch (err: any) {
      showError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Save Attendance Rules — persisted to backend system_settings    */
  /* ---------------------------------------------------------------- */

  async function saveAttendanceSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const value: AttendanceSettings = {
        present_window_minutes:   presentWindow,
        late_threshold_minutes:   lateThreshold,
        session_duration_minutes: sessionDuration,
      };

      const res = await fetch(`${BASE_URL}/api/attendance/settings/attendance_rules`, {
        method:  "PUT",
        headers: getAuthHeaders(token),
        body:    JSON.stringify({ value }),
      });

      const data = await res.json().catch(() => ({ message: "Unexpected server response." }));

      if (!res.ok) {
        showError(typeof data.message === "string" ? data.message : "Failed to save attendance rules.");
        return;
      }

      showSuccess("Attendance rules saved to database.");
    } catch (err: any) {
      showError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Change Password — calls real backend endpoint                   */
  /* ---------------------------------------------------------------- */

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    // Client-side validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      showError("All password fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      showError("New password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password:     newPassword,
        }),
      });

      const data = await res.json().catch(() => ({ message: "Unexpected server response." }));

      if (!res.ok) {
        showError(
          typeof data.message === "string"
            ? data.message
            : "Failed to change password. Please try again."
        );
        return;
      }

      showSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      showError("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Tab button helper                                                */
  /* ---------------------------------------------------------------- */

  function TabBtn({
    id, label, icon,
  }: { id: "institute" | "attendance" | "account"; label: string; icon: React.ReactNode }) {
    const active = activeTab === id;
    return (
      <button
        onClick={() => { setActiveTab(id); setSuccessMessage(""); setErrorMessage(""); }}
        style={{
          padding:       "var(--sp-3) var(--sp-4)",
          background:    "none",
          border:        "none",
          borderBottom:  active ? "2px solid var(--primary)" : "2px solid transparent",
          color:         active ? "var(--primary)" : "var(--text-muted)",
          fontSize:      "var(--tx-sm)",
          fontWeight:    600,
          cursor:        "pointer",
          display:       "inline-flex",
          alignItems:    "center",
          gap:           "var(--sp-2)",
        }}
      >
        {icon}{label}
      </button>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-eyebrow">System</span>
          <h1 className="page-title">Settings</h1>
          <p className="page-desc">Configure application preferences and account settings.</p>
        </div>
      </div>

      {/* Success / Error banners */}
      {successMessage && (
        <div style={{ padding:"var(--sp-3) var(--sp-4)", background:"var(--success-subtle)", border:"1px solid var(--success-border)", borderRadius:"var(--radius-md)", marginBottom:"var(--sp-5)", display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
          <HiOutlineCheckCircle style={{ fontSize:18, color:"var(--success-text)", flexShrink:0 }} />
          <span style={{ fontSize:"var(--tx-sm)", color:"var(--success-text)" }}>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div style={{ padding:"var(--sp-3) var(--sp-4)", background:"var(--danger-subtle)", border:"1px solid var(--danger-border)", borderRadius:"var(--radius-md)", marginBottom:"var(--sp-5)", display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
          <HiOutlineExclamationTriangle style={{ fontSize:18, color:"var(--danger-text)", flexShrink:0 }} />
          <span style={{ fontSize:"var(--tx-sm)", color:"var(--danger-text)" }}>{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:"var(--sp-2)", marginBottom:"var(--sp-5)", borderBottom:"1px solid var(--border-subtle)" }}>
        <TabBtn id="institute"  label="Institute Information" icon={<HiOutlineBuildingOffice2 style={{ fontSize:16 }} />} />
        <TabBtn id="attendance" label="Attendance Rules"      icon={<HiOutlineClock          style={{ fontSize:16 }} />} />
        <TabBtn id="account"    label="Account Settings"      icon={<HiOutlineUserCircle     style={{ fontSize:16 }} />} />
      </div>

      {/* ── Institute Information ── */}
      {activeTab === "institute" && (
        <div className="card card-pad">
          <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-1)" }}>Institute Information</h3>
          <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginBottom:"var(--sp-5)" }}>
            Update basic information about your institute. Saved in browser storage.
          </p>
          <form onSubmit={saveInstituteSettings}>
            <div style={{ display:"grid", gap:"var(--sp-4)", maxWidth:600 }}>
              <div className="form-group">
                <label className="form-label">Institute Name</label>
                <input className="form-input" value={instituteName} onChange={(e) => setInstituteName(e.target.value)} required disabled={saving} />
              </div>
              <div className="form-group">
                <label className="form-label">Short Name</label>
                <input className="form-input" value={instituteShortName} onChange={(e) => setInstituteShortName(e.target.value)} required disabled={saving} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={instituteEmail} onChange={(e) => setInstituteEmail(e.target.value)} required disabled={saving} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={institutePhone} onChange={(e) => setInstitutePhone(e.target.value)} disabled={saving} />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-input" value={instituteAddress} onChange={(e) => setInstituteAddress(e.target.value)} rows={3} disabled={saving} />
              </div>
            </div>
            <div style={{ marginTop:"var(--sp-5)" }}>
              <button type="submit" className="btn btn-primary btn-md" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Attendance Rules ── */}
      {activeTab === "attendance" && (
        <div className="card card-pad">
          <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-1)" }}>Attendance Rules</h3>
          <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginBottom:"var(--sp-5)" }}>
            Configure attendance marking thresholds. These values are saved to the database and apply system-wide.
          </p>
          <form onSubmit={saveAttendanceSettings}>
            <div style={{ display:"grid", gap:"var(--sp-4)", maxWidth:600 }}>
              <div className="form-group">
                <label className="form-label">Present Window (minutes)</label>
                <input className="form-input" type="number" min="1" max="60" value={presentWindow} onChange={(e) => setPresentWindow(parseInt(e.target.value))} required disabled={saving} />
                <p style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>Students who check in within this window are marked PRESENT</p>
              </div>
              <div className="form-group">
                <label className="form-label">Late Threshold (minutes)</label>
                <input className="form-input" type="number" min="1" max="120" value={lateThreshold} onChange={(e) => setLateThreshold(parseInt(e.target.value))} required disabled={saving} />
                <p style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>After this threshold, students are marked LATE</p>
              </div>
              <div className="form-group">
                <label className="form-label">Default Session Duration (minutes)</label>
                <input className="form-input" type="number" min="15" max="300" value={sessionDuration} onChange={(e) => setSessionDuration(parseInt(e.target.value))} required disabled={saving} />
                <p style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>Default duration for new attendance sessions</p>
              </div>
            </div>
            <div style={{ marginTop:"var(--sp-5)" }}>
              <button type="submit" className="btn btn-primary btn-md" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Account Settings ── */}
      {activeTab === "account" && (
        <div className="card card-pad">
          <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-1)" }}>Account Settings</h3>
          <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginBottom:"var(--sp-5)" }}>
            Manage your account and security.
          </p>

          {/* Account Info */}
          <div style={{ marginBottom:"var(--sp-6)", paddingBottom:"var(--sp-6)", borderBottom:"1px solid var(--border-subtle)" }}>
            <h4 style={{ fontSize:"var(--tx-sm)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-3)" }}>Account Information</h4>
            <div style={{ display:"grid", gap:"var(--sp-3)" }}>
              {[
                { label: "Name",   value: user?.name  || "—" },
                { label: "Email",  value: user?.email || "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>{label}</span>
                  <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-primary)", fontWeight:500 }}>{value}</span>
                </div>
              ))}
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>Role</span>
                <span className="badge badge-sm badge-primary">{user?.role?.toUpperCase() || "ADMIN"}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>Status</span>
                <span className="badge badge-sm badge-success">ACTIVE</span>
              </div>
            </div>
          </div>

          {/* Change Password */}
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
                <button type="submit" className="btn btn-primary btn-md" disabled={saving}>
                  {saving ? "Changing..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
