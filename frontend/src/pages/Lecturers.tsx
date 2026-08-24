import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  HiOutlineUserPlus,
  HiOutlineArrowDownTray,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineXMark,
  HiOutlineEllipsisVertical,
  HiOutlineEye,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineChevronUpDown,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";

import * as lecturersService from "../services/lecturersService";
import type { Lecturer } from "../services/lecturersService";

/* ------------------------------------------------------------------ */
/*  Domain data                                                          */
/* ------------------------------------------------------------------ */

const DEPARTMENTS = [
  "Computer Science",
  "Software Engineering",
  "Information Technology",
  "Data Science",
  "Cybersecurity",
  "Artificial Intelligence",
  "Mathematics",
  "Engineering",
  "Business Administration",
  "General Studies",
];

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type LecturerStatus = "Active" | "Inactive";

interface UILecturer extends Lecturer {
  status: LecturerStatus;
  account_status?: string;
}

/* ------------------------------------------------------------------ */
/*  Row action menu                                                     */
/* ------------------------------------------------------------------ */

interface RowMenuProps {
  lecturer: UILecturer;
  onView:   (l: UILecturer) => void;
  onEdit:   (l: UILecturer) => void;
  onDelete: (l: UILecturer) => void;
}

function RowMenu({ lecturer, onView, onEdit, onDelete }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <div className="dropdown" style={{ right: 0, left: "auto", minWidth: 170 }}>
          <button className="dropdown-item" onClick={() => { onView(lecturer);   setOpen(false); }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <HiOutlineEye style={{ fontSize: 15 }} /> View Profile
            </span>
          </button>
          <button className="dropdown-item" onClick={() => { onEdit(lecturer);   setOpen(false); }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <HiOutlinePencilSquare style={{ fontSize: 15 }} /> Edit
            </span>
          </button>
          <div className="dropdown-divider" />
          <button className="dropdown-item danger" onClick={() => { onDelete(lecturer); setOpen(false); }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <HiOutlineTrash style={{ fontSize: 15 }} /> Delete
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add / Edit Lecturer Modal                                           */
/* ------------------------------------------------------------------ */

interface LecturerModalProps {
  mode: "add" | "edit";
  initial?: UILecturer;
  onClose: () => void;
  onSave:  (data: { lecturer_number: string; full_name: string; email: string; department: string }) => Promise<void>;
}

function LecturerModal({ mode, initial, onClose, onSave }: LecturerModalProps) {
  const [lecturerNumber, setLecturerNumber] = useState(initial?.lecturer_number || "");
  const [fullName, setFullName] = useState(initial?.full_name || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [department, setDepartment] = useState(initial?.department || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lecturerNumber || !fullName || !email || !department) return;

    setError("");
    setSaving(true);

    try {
      await onSave({ lecturer_number: lecturerNumber, full_name: fullName, email, department });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save lecturer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "var(--bg-overlay)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "var(--sp-4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card card-pad"
        style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Modal header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"var(--sp-6)" }}>
          <div>
            <h2 style={{ fontSize:"var(--tx-lg)", fontWeight:700, color:"var(--text-primary)" }}>
              {mode === "add" ? "Add Lecturer" : "Edit Lecturer"}
            </h2>
            <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>
              {mode === "add" ? "Add a new lecturer to the system." : "Update lecturer information."}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ padding:"6px 8px" }} onClick={onClose} disabled={saving}>
            <span className="btn-icon"><HiOutlineXMark /></span>
          </button>
        </div>

        {error && (
          <div style={{
            padding: "var(--sp-3) var(--sp-4)",
            background: "var(--danger-subtle)",
            border: "1px solid var(--danger-border)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--sp-4)",
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-3)",
          }}>
            <HiOutlineExclamationTriangle style={{ fontSize: 18, color: "var(--danger-text)", flexShrink: 0 }} />
            <span style={{ fontSize: "var(--tx-sm)", color: "var(--danger-text)" }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display:"grid", gap:"var(--sp-4)" }}>
            <div className="form-group">
              <label className="form-label">Lecturer Number <span style={{ color:"var(--danger-text)" }}>*</span></label>
              <input
                className="form-input"
                placeholder="e.g. LEC001"
                value={lecturerNumber}
                onChange={(e) => setLecturerNumber(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Full Name <span style={{ color:"var(--danger-text)" }}>*</span></label>
              <input
                className="form-input"
                placeholder="e.g. Dr. Kwame Nkrumah"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email <span style={{ color:"var(--danger-text)" }}>*</span></label>
              <input
                className="form-input"
                type="email"
                placeholder="lecturer@nbi.edu.gh"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Department <span style={{ color:"var(--danger-text)" }}>*</span></label>
              <select
                className="form-input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                disabled={saving}
              >
                <option value="">Select department</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:"var(--sp-3)", marginTop:"var(--sp-6)" }}>
            <button type="button" className="btn btn-ghost btn-md" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-md" disabled={saving}>
              {saving ? "Saving..." : mode === "add" ? "Add Lecturer" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lecturer Profile Drawer                                             */
/* ------------------------------------------------------------------ */

function ProfileDrawer({ lecturer, onClose }: { lecturer: UILecturer; onClose: () => void }) {
  const initials = lecturer.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
          width: "100%", maxWidth: 400, height: "100vh",
          borderRadius: 0, borderLeft: "1px solid var(--border-default)",
          overflowY: "auto", display: "flex", flexDirection: "column",
        }}
      >
        {/* Drawer header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"var(--sp-6)", borderBottom:"1px solid var(--border-subtle)", flexShrink:0 }}>
          <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>Lecturer Profile</h3>
          <button className="btn btn-ghost btn-sm" style={{ padding:"6px 8px" }} onClick={onClose}>
            <span className="btn-icon"><HiOutlineXMark /></span>
          </button>
        </div>

        <div style={{ padding:"var(--sp-6)", flex:1 }}>
          {/* Avatar + name */}
          <div style={{ display:"flex", alignItems:"center", gap:"var(--sp-4)", marginBottom:"var(--sp-6)" }}>
            <div style={{
              width:56, height:56, borderRadius:"var(--radius-lg)",
              background:"var(--primary-subtle)", border:"1px solid var(--primary-border)",
              color:"var(--primary)", display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:700, fontSize:"var(--tx-lg)", flexShrink:0,
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>
                {lecturer.full_name}
              </div>
              <div style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginTop:2 }}>
                {lecturer.lecturer_number}
              </div>
              <div style={{ marginTop:"var(--sp-2)" }}>
                <span className={`badge badge-sm ${lecturer.status === "Active" ? "badge-success" : "badge-neutral"}`}>
                  {lecturer.status}
                </span>
                {lecturer.account_status === "pending_activation" && (
                  <span className="badge badge-sm badge-warning" style={{ marginLeft: 6 }}>
                    Pending Activation
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Info rows */}
          {[
            { label: "Department", value: lecturer.department || "—" },
            { label: "Email",      value: lecturer.email      || "—" },
            { label: "Joined",     value: lecturer.created_at ? new Date(lecturer.created_at).toLocaleDateString() : "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"var(--sp-3) 0", borderBottom:"1px solid var(--border-subtle)" }}>
              <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", flexShrink:0, marginRight:"var(--sp-4)" }}>{label}</span>
              <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-primary)", fontWeight:500, textAlign:"right", wordBreak:"break-all" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confirm dialog                                                      */
/* ------------------------------------------------------------------ */

interface ConfirmProps {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel, loading }: ConfirmProps) {
  return (
    <div
      style={{
        position:"fixed", inset:0, zIndex:600,
        background:"var(--bg-overlay)",
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:"var(--sp-4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div className="card card-pad" style={{ width:"100%", maxWidth:400 }}>
        <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-3)" }}>{title}</h3>
        <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-secondary)", lineHeight:1.6, marginBottom:"var(--sp-6)" }}>{message}</p>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:"var(--sp-3)" }}>
          <button className="btn btn-ghost btn-md" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={`btn btn-md ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={loading}>
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Lecturers page                                                 */
/* ------------------------------------------------------------------ */

export default function Lecturers() {
  /* --- data state --- */
  const [lecturers, setLecturers] = useState<UILecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* --- filters --- */
  const [search,      setSearch]      = useState("");
  const [fDepartment, setFDepartment] = useState("");

  /* --- modals / drawers --- */
  type ModalState =
    | { type: "none" }
    | { type: "add" }
    | { type: "edit";   lecturer: UILecturer }
    | { type: "view";   lecturer: UILecturer }
    | { type: "delete"; lecturer: UILecturer };

  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [actionLoading, setActionLoading] = useState(false);

  /* --- sort --- */
  const [sortKey, setSortKey] = useState<keyof UILecturer>("lecturer_number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: keyof UILecturer) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  /* --- load lecturers on mount --- */
  useEffect(() => {
    loadLecturers();
  }, []);

  async function loadLecturers() {
    try {
      setLoading(true);
      setError("");
      const data = await lecturersService.getLecturers();
      // Add UI-only status field (default to Active for now)
      setLecturers(data.map(l => ({ ...l, status: "Active" as LecturerStatus })));
    } catch (err: any) {
      setError(err.message || "Failed to load lecturers");
    } finally {
      setLoading(false);
    }
  }

  /* --- filtered + sorted rows --- */
  const rows = useMemo(() => {
    let list = [...lecturers];
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((l) =>
      l.lecturer_number.toLowerCase().includes(q) ||
      l.full_name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.department.toLowerCase().includes(q)
    );
    if (fDepartment) list = list.filter((l) => l.department === fDepartment);

    list.sort((a, b) => {
      const av = String(a[sortKey]).toLowerCase();
      const bv = String(b[sortKey]).toLowerCase();
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [lecturers, search, fDepartment, sortKey, sortDir]);

  const filtersActive = !!(search || fDepartment);

  function clearFilters() { setSearch(""); setFDepartment(""); }

  /* --- actions --- */
  async function handleAdd(data: { lecturer_number: string; full_name: string; email: string; department: string }) {
    const result = await lecturersService.createLecturer(data);
    setLecturers((prev) => [{ ...result.lecturer, status: "Active" }, ...prev]);
  }

  async function handleEdit(lecturer: UILecturer, data: { lecturer_number: string; full_name: string; email: string; department: string }) {
    const result = await lecturersService.updateLecturer(lecturer.id, data);
    setLecturers((prev) => prev.map((l) => l.id === lecturer.id ? { ...result.lecturer, status: l.status } : l));
  }

  async function handleDelete(lecturer: UILecturer) {
    setActionLoading(true);
    try {
      await lecturersService.deleteLecturer(lecturer.id);
      setLecturers((prev) => prev.filter((l) => l.id !== lecturer.id));
      setModal({ type: "none" });
    } catch (err: any) {
      alert(err.message || "Failed to delete lecturer");
    } finally {
      setActionLoading(false);
    }
  }

  /* --- sort header --- */
  function SortTh({ label, field, style }: { label: string; field: keyof UILecturer; style?: React.CSSProperties }) {
    return (
      <th style={style}>
        <button
          onClick={() => toggleSort(field)}
          style={{ display:"inline-flex", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer",
            color:"var(--text-muted)", fontWeight:700, fontSize:"var(--tx-xs)", letterSpacing:"0.8px", textTransform:"uppercase" }}
        >
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
          <span className="page-eyebrow">Management</span>
          <h1 className="page-title">Lecturers</h1>
          <p className="page-desc">Manage academic staff, departments and assigned courses.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost btn-md" disabled>
            <span className="btn-icon"><HiOutlineArrowDownTray /></span>
            Export
          </button>
          <button className="btn btn-primary btn-md" onClick={() => setModal({ type: "add" })}>
            <span className="btn-icon"><HiOutlineUserPlus /></span>
            Add Lecturer
          </button>
        </div>
      </div>

      {/* ---- Error banner ---- */}
      {error && (
        <div style={{
          padding: "var(--sp-4)",
          background: "var(--danger-subtle)",
          border: "1px solid var(--danger-border)",
          borderRadius: "var(--radius-md)",
          marginBottom: "var(--sp-5)",
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
        }}>
          <HiOutlineExclamationTriangle style={{ fontSize: 20, color: "var(--danger-text)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--tx-sm)", fontWeight: 600, color: "var(--danger-text)" }}>
              Failed to load lecturers
            </div>
            <div style={{ fontSize: "var(--tx-sm)", color: "var(--danger-text)", marginTop: 2 }}>
              {error}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadLecturers}>
            Retry
          </button>
        </div>
      )}

      {/* ---- Filters ---- */}
      <div className="card card-pad" style={{ marginBottom:"var(--sp-5)" }}>
        {/* Search row */}
        <div style={{ position:"relative", marginBottom:"var(--sp-4)" }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-muted)", fontSize:15, display:"flex", pointerEvents:"none" }}>
            <HiOutlineMagnifyingGlass />
          </span>
          <input
            className="form-input"
            style={{ paddingLeft:36, width:"100%", maxWidth:480 }}
            placeholder="Search by name, lecturer number, email or department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter row */}
        <div style={{ display:"flex", gap:"var(--sp-3)", flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:"var(--tx-sm)", color:"var(--text-muted)", flexShrink:0 }}>
            <HiOutlineFunnel style={{ fontSize:15 }} /> Filters
          </span>

          <select className="form-input" style={{ minWidth:170 }} value={fDepartment} onChange={(e) => setFDepartment(e.target.value)}>
            <option value="">All Departments</option>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>

          {filtersActive && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <span className="btn-icon"><HiOutlineXMark /></span>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className="card">
        {/* Table meta */}
        <div style={{ padding:"var(--sp-4) var(--sp-6)", borderBottom:"1px solid var(--border-subtle)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>
            {loading ? "Loading..." : `${rows.length} ${rows.length === 1 ? "lecturer" : "lecturers"}${filtersActive ? " matching filters" : " total"}`}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Lecturer Number" field="lecturer_number" style={{ paddingLeft:"var(--sp-6)" }} />
                <SortTh label="Full Name"        field="full_name" />
                <SortTh label="Department"       field="department" />
                <th>Email</th>
                <SortTh label="Status" field="status" />
                <th style={{ textAlign:"right", paddingRight:"var(--sp-6)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign:"center", padding:"var(--sp-12)", color:"var(--text-muted)" }}>
                    Loading lecturers...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign:"center", padding:"var(--sp-12)", color:"var(--text-muted)" }}>
                    {filtersActive ? "No lecturers match the current filters." : "No lecturers found. Add your first lecturer to get started."}
                  </td>
                </tr>
              )}
              {!loading && rows.map((l) => {
                const initials = l.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <tr key={l.id}>
                    <td style={{ paddingLeft:"var(--sp-6)", fontFamily:"monospace", fontSize:"var(--tx-sm)", color:"var(--text-secondary)", fontWeight:500 }}>
                      {l.lecturer_number}
                    </td>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
                        <div style={{
                          width:30, height:30, borderRadius:"var(--radius-sm)",
                          background:"var(--primary-subtle)", border:"1px solid var(--primary-border)",
                          color:"var(--primary)", display:"flex", alignItems:"center", justifyContent:"center",
                          fontWeight:700, fontSize:"var(--tx-xs)", flexShrink:0,
                        }}>
                          {initials}
                        </div>
                        <span style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--text-primary)", whiteSpace:"nowrap" }}>
                          {l.full_name}
                        </span>
                      </div>
                    </td>
                    <td style={{ whiteSpace:"nowrap" }}>{l.department || "—"}</td>
                    <td style={{ color:"var(--text-muted)", whiteSpace:"nowrap" }}>{l.email}</td>
                    <td>
                      <span className={`badge badge-sm ${l.status === "Active" ? "badge-success" : "badge-neutral"}`}>
                        {l.status}
                      </span>
                      {l.account_status === "pending_activation" && (
                        <span className="badge badge-sm badge-warning" style={{ marginLeft: 6 }}>
                          Pending Activation
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign:"right", paddingRight:"var(--sp-6)" }}>
                      <RowMenu
                        lecturer={l}
                        onView={(x)   => setModal({ type:"view",   lecturer: x })}
                        onEdit={(x)   => setModal({ type:"edit",   lecturer: x })}
                        onDelete={(x) => setModal({ type:"delete", lecturer: x })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Modals / Drawers ---- */}
      {modal.type === "add" && (
        <LecturerModal
          mode="add"
          onClose={() => setModal({ type:"none" })}
          onSave={handleAdd}
        />
      )}
      {modal.type === "edit" && (
        <LecturerModal
          mode="edit"
          initial={modal.lecturer}
          onClose={() => setModal({ type:"none" })}
          onSave={(data) => handleEdit(modal.lecturer, data)}
        />
      )}
      {modal.type === "view" && (
        <ProfileDrawer lecturer={modal.lecturer} onClose={() => setModal({ type:"none" })} />
      )}
      {modal.type === "delete" && (
        <ConfirmDialog
          title="Delete Lecturer"
          message={`This will permanently remove ${modal.lecturer.full_name} (${modal.lecturer.lecturer_number}) from the system. This action cannot be undone.`}
          confirmLabel="Delete Lecturer"
          danger
          loading={actionLoading}
          onConfirm={() => handleDelete(modal.lecturer)}
          onCancel={() => setModal({ type:"none" })}
        />
      )}
    </>
  );
}
