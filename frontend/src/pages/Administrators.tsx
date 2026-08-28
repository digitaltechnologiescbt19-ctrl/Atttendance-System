import React, { useState, useMemo, useRef, useEffect } from "react";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";
import {
  HiOutlineUserPlus,
  HiOutlineMagnifyingGlass,
  HiOutlineXMark,
  HiOutlineEllipsisVertical,
  HiOutlineEye,
  HiOutlineNoSymbol,
  HiOutlineCheckCircle,
  HiOutlineKey,
  HiOutlineExclamationTriangle,
  HiOutlineChevronUpDown,
  HiOutlineShieldCheck,
} from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface Administrator {
  id: number;
  email: string;
  name: string;
  role: "admin";
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Build auth headers from the token passed in from AuthContext. */
function makeAuthHeaders(token: string | null) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* ------------------------------------------------------------------ */
/*  Row Action Menu                                                     */
/* ------------------------------------------------------------------ */

interface RowMenuProps {
  admin: Administrator;
  currentUserId?: number;
  onView:          (a: Administrator) => void;
  onToggleStatus:  (a: Administrator) => void;
  onResetPassword: (a: Administrator) => void;
}

function RowMenu({ admin, currentUserId, onView, onToggleStatus, onResetPassword }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isSelf = currentUserId === admin.id;

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        className="btn btn-ghost btn-sm"
        style={{ padding: "6px 8px" }}
        onClick={() => setOpen((o) => !o)}
        title="Actions"
      >
        <span className="btn-icon"><HiOutlineEllipsisVertical /></span>
      </button>

      {open && (
        <div className="dropdown" style={{ right: 0, left: "auto", minWidth: 190 }}>
          <button className="dropdown-item" onClick={() => { onView(admin); setOpen(false); }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <HiOutlineEye style={{ fontSize: 15 }} /> View Profile
            </span>
          </button>
          <button
            className="dropdown-item"
            disabled={isSelf}
            onClick={() => { onResetPassword(admin); setOpen(false); }}
          >
            <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <HiOutlineKey style={{ fontSize: 15 }} /> Reset Password
            </span>
          </button>
          <div className="dropdown-divider" />
          <button
            className="dropdown-item danger"
            disabled={isSelf}
            onClick={() => { onToggleStatus(admin); setOpen(false); }}
          >
            <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              {admin.is_active
                ? <><HiOutlineNoSymbol style={{ fontSize: 15 }} /> Deactivate</>
                : <><HiOutlineCheckCircle style={{ fontSize: 15 }} /> Activate</>
              }
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Administrator Modal                                             */
/* ------------------------------------------------------------------ */

interface AddAdminModalProps {
  onClose: () => void;
  onSave:  (data: { name: string; email: string }) => Promise<void>;
}

function AddAdminModal({ onClose, onSave }: AddAdminModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) return;
    setError("");
    setSaving(true);
    try {
      await onSave({ name, email });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create administrator");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:500, background:"var(--bg-overlay)", display:"flex", alignItems:"center", justifyContent:"center", padding:"var(--sp-4)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card card-pad" style={{ width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"var(--sp-6)" }}>
          <div>
            <h2 style={{ fontSize:"var(--tx-lg)", fontWeight:700, color:"var(--text-primary)" }}>Add Administrator</h2>
            <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>
              Create a new administrator account. They will receive an email to activate and set their password.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ padding:"6px 8px" }} onClick={onClose} disabled={saving}>
            <span className="btn-icon"><HiOutlineXMark /></span>
          </button>
        </div>

        {error && (
          <div style={{ padding:"var(--sp-3) var(--sp-4)", background:"var(--danger-subtle)", border:"1px solid var(--danger-border)", borderRadius:"var(--radius-md)", marginBottom:"var(--sp-4)", display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
            <HiOutlineExclamationTriangle style={{ fontSize:18, color:"var(--danger-text)", flexShrink:0 }} />
            <span style={{ fontSize:"var(--tx-sm)", color:"var(--danger-text)" }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display:"grid", gap:"var(--sp-4)" }}>
            <div className="form-group">
              <label className="form-label">Full Name <span style={{ color:"var(--danger-text)" }}>*</span></label>
              <input className="form-input" placeholder="e.g. Sarah Mensah" value={name} onChange={(e) => setName(e.target.value)} required disabled={saving} />
            </div>

            <div className="form-group">
              <label className="form-label">Email <span style={{ color:"var(--danger-text)" }}>*</span></label>
              <input className="form-input" type="email" placeholder="admin@nbi.edu.gh" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={saving} />
              <p style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>
                The administrator will use this email to activate their account and set their own password.
              </p>
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", gap:"var(--sp-3)", marginTop:"var(--sp-6)" }}>
            <button type="button" className="btn btn-ghost btn-md" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-md" disabled={saving}>
              {saving ? "Creating..." : "Create Administrator"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reset Password Modal                                                */
/* ------------------------------------------------------------------ */

interface ResetPasswordModalProps {
  admin: Administrator;
  onClose: () => void;
  onReset: (id: number, newPassword: string) => Promise<void>;
}

function ResetPasswordModal({ admin, onClose, onReset }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || !confirm) return;
    if (newPassword !== confirm) { setError("Passwords do not match."); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError("");
    setSaving(true);
    try {
      await onReset(admin.id, newPassword);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:600, background:"var(--bg-overlay)", display:"flex", alignItems:"center", justifyContent:"center", padding:"var(--sp-4)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="card card-pad" style={{ width:"100%", maxWidth:440 }}>
        <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-2)" }}>Reset Password</h3>
        <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-secondary)", marginBottom:"var(--sp-5)" }}>
          Set a new password for <strong>{admin.name}</strong>.
        </p>

        {error && (
          <div style={{ padding:"var(--sp-3) var(--sp-4)", background:"var(--danger-subtle)", border:"1px solid var(--danger-border)", borderRadius:"var(--radius-md)", marginBottom:"var(--sp-4)", display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
            <HiOutlineExclamationTriangle style={{ fontSize:18, color:"var(--danger-text)", flexShrink:0 }} />
            <span style={{ fontSize:"var(--tx-sm)", color:"var(--danger-text)" }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display:"grid", gap:"var(--sp-4)", marginBottom:"var(--sp-5)" }}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" placeholder="Minimum 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={saving} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input className="form-input" type="password" placeholder="Re-enter password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required disabled={saving} />
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:"var(--sp-3)" }}>
            <button type="button" className="btn btn-ghost btn-md" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-md" disabled={saving}>
              {saving ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile Drawer                                                      */
/* ------------------------------------------------------------------ */

function ProfileDrawer({ admin, onClose }: { admin: Administrator; onClose: () => void }) {
  const initials = admin.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, background:"var(--bg-overlay)", display:"flex", justifyContent:"flex-end" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width:"100%", maxWidth:400, height:"100vh", borderRadius:0, borderLeft:"1px solid var(--border-default)", overflowY:"auto", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"var(--sp-6)", borderBottom:"1px solid var(--border-subtle)", flexShrink:0 }}>
          <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>Administrator Profile</h3>
          <button className="btn btn-ghost btn-sm" style={{ padding:"6px 8px" }} onClick={onClose}><span className="btn-icon"><HiOutlineXMark /></span></button>
        </div>
        <div style={{ padding:"var(--sp-6)", flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"var(--sp-4)", marginBottom:"var(--sp-6)" }}>
            <div style={{ width:56, height:56, borderRadius:"var(--radius-lg)", background:"var(--primary-subtle)", border:"1px solid var(--primary-border)", color:"var(--primary)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:"var(--tx-lg)", flexShrink:0 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>{admin.name}</div>
              <div style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginTop:2 }}>Administrator</div>
              <div style={{ marginTop:"var(--sp-2)", display:"flex", gap:"var(--sp-2)" }}>
                <span className={`badge badge-sm ${admin.is_active ? "badge-success" : "badge-neutral"}`}>{admin.is_active ? "Active" : "Inactive"}</span>
                {admin.is_verified && <span className="badge badge-sm badge-primary">Verified</span>}
              </div>
            </div>
          </div>
          {[
            { label: "Email",    value: admin.email },
            { label: "Role",     value: "Administrator" },
            { label: "Verified", value: admin.is_verified ? "Yes" : "No" },
            { label: "Joined",   value: new Date(admin.created_at).toLocaleDateString() },
          ].map(({ label, value }) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"var(--sp-3) 0", borderBottom:"1px solid var(--border-subtle)" }}>
              <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>{label}</span>
              <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-primary)", fontWeight:500, textAlign:"right", wordBreak:"break-all" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confirm Dialog                                                      */
/* ------------------------------------------------------------------ */

interface ConfirmProps { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void; loading?: boolean; }
function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel, loading }: ConfirmProps) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:600, background:"var(--bg-overlay)", display:"flex", alignItems:"center", justifyContent:"center", padding:"var(--sp-4)" }} onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}>
      <div className="card card-pad" style={{ width:"100%", maxWidth:400 }}>
        <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-3)" }}>{title}</h3>
        <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-secondary)", lineHeight:1.6, marginBottom:"var(--sp-6)" }}>{message}</p>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:"var(--sp-3)" }}>
          <button className="btn btn-ghost btn-md" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={`btn btn-md ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={loading}>{loading ? "Processing..." : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Administrators Page                                            */
/* ------------------------------------------------------------------ */

export default function Administrators() {
  const { user, token } = useAuth();

  const [admins, setAdmins] = useState<Administrator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  type ModalState =
    | { type: "none" }
    | { type: "add" }
    | { type: "view";   admin: Administrator }
    | { type: "reset";  admin: Administrator }
    | { type: "toggle"; admin: Administrator };

  const [modal, setModal] = useState<ModalState>({ type: "none" });

  const [sortKey, setSortKey] = useState<keyof Administrator>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: keyof Administrator) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  useEffect(() => { loadAdmins(); }, []);

  async function loadAdmins() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${BASE_URL}/api/attendance/administrators`, {
        headers: makeAuthHeaders(token),
      });
      if (!res.ok) throw new Error("Failed to load administrators");
      const data = await res.json();
      setAdmins(data);
    } catch (err: any) {
      setError(err.message || "Failed to load administrators");
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    let list = [...admins];
    const q = search.toLowerCase().trim();
    if (q) list = list.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
    list.sort((a, b) => {
      const av = String(a[sortKey]).toLowerCase();
      const bv = String(b[sortKey]).toLowerCase();
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [admins, search, sortKey, sortDir]);

  async function handleAdd(data: { name: string; email: string }) {
    const res = await fetch(`${BASE_URL}/api/attendance/administrators`, {
      method: "POST",
      headers: makeAuthHeaders(token),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to create administrator");
    setAdmins(prev => [json.administrator, ...prev]);
    // Surface email delivery status so the creating admin knows whether the welcome email arrived
    if (json.email_status && json.email_status !== "sent") {
      console.warn("Admin welcome email status:", json.email_status);
    }
  }

  async function handleToggleStatus(admin: Administrator) {
    setActionLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/attendance/administrators/${admin.id}/status`, {
        method: "PATCH",
        headers: makeAuthHeaders(token),
        body: JSON.stringify({ is_active: !admin.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update status");
      setAdmins(prev => prev.map(a => a.id === admin.id ? json.administrator : a));
      setModal({ type: "none" });
    } catch (err: any) {
      alert(err.message || "Failed to update administrator status");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetPassword(id: number, newPassword: string) {
    const res = await fetch(`${BASE_URL}/api/attendance/administrators/${id}/reset-password`, {
      method: "POST",
      headers: makeAuthHeaders(token),
      body: JSON.stringify({ new_password: newPassword }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed to reset password");
  }

  function SortTh({ label, field, style }: { label: string; field: keyof Administrator; style?: React.CSSProperties }) {
    return (
      <th style={style}>
        <button onClick={() => toggleSort(field)} style={{ display:"inline-flex", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontWeight:700, fontSize:"var(--tx-xs)", letterSpacing:"0.8px", textTransform:"uppercase" }}>
          {label}
          <HiOutlineChevronUpDown style={{ fontSize:13, opacity: sortKey === field ? 1 : 0.4 }} />
        </button>
      </th>
    );
  }

  return (
    <>
      {/* ---- Page header ---- */}
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-eyebrow">System</span>
          <h1 className="page-title">Administrators</h1>
          <p className="page-desc">Manage administrator accounts and access control.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary btn-md" onClick={() => setModal({ type: "add" })}>
            <span className="btn-icon"><HiOutlineUserPlus /></span>
            Add Administrator
          </button>
        </div>
      </div>

      {/* ---- Security notice ---- */}
      <div style={{ padding:"var(--sp-3) var(--sp-4)", background:"var(--accent-subtle)", border:"1px solid var(--accent-border)", borderRadius:"var(--radius-md)", marginBottom:"var(--sp-5)", display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
        <HiOutlineShieldCheck style={{ fontSize:18, color:"var(--accent)", flexShrink:0 }} />
        <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-secondary)" }}>
          Only administrators can create or manage other administrator accounts. There is no public administrator registration.
        </span>
      </div>

      {/* ---- Error banner ---- */}
      {error && (
        <div style={{ padding:"var(--sp-4)", background:"var(--danger-subtle)", border:"1px solid var(--danger-border)", borderRadius:"var(--radius-md)", marginBottom:"var(--sp-5)", display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
          <HiOutlineExclamationTriangle style={{ fontSize:20, color:"var(--danger-text)", flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--danger-text)" }}>Failed to load administrators</div>
            <div style={{ fontSize:"var(--tx-sm)", color:"var(--danger-text)", marginTop:2 }}>{error}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadAdmins}>Retry</button>
        </div>
      )}

      {/* ---- Search ---- */}
      <div className="card card-pad" style={{ marginBottom:"var(--sp-5)" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-muted)", fontSize:15, display:"flex", pointerEvents:"none" }}>
            <HiOutlineMagnifyingGlass />
          </span>
          <input
            className="form-input"
            style={{ paddingLeft:36, width:"100%", maxWidth:480 }}
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className="card">
        <div style={{ padding:"var(--sp-4) var(--sp-6)", borderBottom:"1px solid var(--border-subtle)" }}>
          <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>
            {loading ? "Loading..." : `${rows.length} ${rows.length === 1 ? "administrator" : "administrators"} total`}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Name" field="name" style={{ paddingLeft:"var(--sp-6)" }} />
                <th>Email</th>
                <SortTh label="Status" field="is_active" />
                <SortTh label="Verified" field="is_verified" />
                <SortTh label="Created" field="created_at" />
                <th style={{ textAlign:"right", paddingRight:"var(--sp-6)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ textAlign:"center", padding:"var(--sp-12)", color:"var(--text-muted)" }}>Loading administrators...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign:"center", padding:"var(--sp-12)", color:"var(--text-muted)" }}>
                  {search ? "No administrators match your search." : "No administrators found."}
                </td></tr>
              )}
              {!loading && rows.map((a) => {
                const initials = a.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                const isSelf = user?.id === a.id;
                return (
                  <tr key={a.id}>
                    <td style={{ paddingLeft:"var(--sp-6)" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
                        <div style={{ width:30, height:30, borderRadius:"var(--radius-sm)", background:"var(--primary-subtle)", border:"1px solid var(--primary-border)", color:"var(--primary)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:"var(--tx-xs)", flexShrink:0 }}>
                          {initials}
                        </div>
                        <div>
                          <span style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--text-primary)" }}>{a.name}</span>
                          {isSelf && <span style={{ marginLeft:6, fontSize:"var(--tx-xs)", color:"var(--text-muted)" }}>(you)</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ color:"var(--text-muted)", fontSize:"var(--tx-sm)" }}>{a.email}</td>
                    <td><span className={`badge badge-sm ${a.is_active ? "badge-success" : "badge-neutral"}`}>{a.is_active ? "Active" : "Inactive"}</span></td>
                    <td><span className={`badge badge-sm ${a.is_verified ? "badge-primary" : "badge-neutral"}`}>{a.is_verified ? "Yes" : "No"}</span></td>
                    <td style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>{new Date(a.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign:"right", paddingRight:"var(--sp-6)" }}>
                      <RowMenu
                        admin={a}
                        currentUserId={user?.id}
                        onView={(x) => setModal({ type:"view", admin: x })}
                        onToggleStatus={(x) => setModal({ type:"toggle", admin: x })}
                        onResetPassword={(x) => setModal({ type:"reset", admin: x })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Modals ---- */}
      {modal.type === "add" && (
        <AddAdminModal onClose={() => setModal({ type:"none" })} onSave={handleAdd} />
      )}
      {modal.type === "view" && (
        <ProfileDrawer admin={modal.admin} onClose={() => setModal({ type:"none" })} />
      )}
      {modal.type === "reset" && (
        <ResetPasswordModal admin={modal.admin} onClose={() => setModal({ type:"none" })} onReset={handleResetPassword} />
      )}
      {modal.type === "toggle" && (
        <ConfirmDialog
          title={modal.admin.is_active ? "Deactivate Administrator" : "Activate Administrator"}
          message={
            modal.admin.is_active
              ? `Deactivating ${modal.admin.name} will prevent them from signing in. You can reactivate them at any time.`
              : `Activating ${modal.admin.name} will restore their ability to sign in.`
          }
          confirmLabel={modal.admin.is_active ? "Deactivate" : "Activate"}
          danger={modal.admin.is_active}
          loading={actionLoading}
          onConfirm={() => handleToggleStatus(modal.admin)}
          onCancel={() => setModal({ type:"none" })}
        />
      )}
    </>
  );
}
