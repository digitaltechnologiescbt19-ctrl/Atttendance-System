import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  HiOutlinePlus,
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

import * as coursesService from "../services/coursesService";
import * as lecturersService from "../services/lecturersService";
import type { Course } from "../services/coursesService";
import type { Lecturer } from "../services/lecturersService";

/* ------------------------------------------------------------------ */
/*  Domain data                                                          */
/* ------------------------------------------------------------------ */

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
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type CourseStatus = "Active" | "Inactive";

interface UICourse extends Course {
  status: CourseStatus;
}

/* ------------------------------------------------------------------ */
/*  Row action menu                                                     */
/* ------------------------------------------------------------------ */

interface RowMenuProps {
  course: UICourse;
  onView:   (c: UICourse) => void;
  onEdit:   (c: UICourse) => void;
  onDelete: (c: UICourse) => void;
}

function RowMenu({ course, onView, onEdit, onDelete }: RowMenuProps) {
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
          <button className="dropdown-item" onClick={() => { onView(course);   setOpen(false); }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <HiOutlineEye style={{ fontSize: 15 }} /> View Details
            </span>
          </button>
          <button className="dropdown-item" onClick={() => { onEdit(course);   setOpen(false); }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <HiOutlinePencilSquare style={{ fontSize: 15 }} /> Edit
            </span>
          </button>
          <div className="dropdown-divider" />
          <button className="dropdown-item danger" onClick={() => { onDelete(course); setOpen(false); }}>
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
/*  Add / Edit Course Modal                                             */
/* ------------------------------------------------------------------ */

interface CourseModalProps {
  mode: "add" | "edit";
  initial?: UICourse;
  lecturers: Lecturer[];
  onClose: () => void;
  onSave:  (data: { course_code: string; course_name: string; programme: string; lecturer_id?: number | null }) => Promise<void>;
}

function CourseModal({ mode, initial, lecturers, onClose, onSave }: CourseModalProps) {
  const [courseCode, setCourseCode] = useState(initial?.course_code || "");
  const [courseName, setCourseName] = useState(initial?.course_name || "");
  const [programme, setProgramme] = useState(initial?.programme || "");
  const [lecturerId, setLecturerId] = useState<string>(initial?.lecturer_id?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseCode || !courseName || !programme) return;

    setError("");
    setSaving(true);

    try {
      await onSave({
        course_code: courseCode,
        course_name: courseName,
        programme,
        lecturer_id: lecturerId ? parseInt(lecturerId) : null
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save course");
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
              {mode === "add" ? "Add Course" : "Edit Course"}
            </h2>
            <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>
              {mode === "add" ? "Add a new course to the system." : "Update course information."}
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
              <label className="form-label">Course Code <span style={{ color:"var(--danger-text)" }}>*</span></label>
              <input
                className="form-input"
                placeholder="e.g. CSC101"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Course Name <span style={{ color:"var(--danger-text)" }}>*</span></label>
              <input
                className="form-input"
                placeholder="e.g. Introduction to Computer Science"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Programme <span style={{ color:"var(--danger-text)" }}>*</span></label>
              <select
                className="form-input"
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                required
                disabled={saving}
              >
                <option value="">Select programme</option>
                {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Lecturer (Optional)</label>
              <select
                className="form-input"
                value={lecturerId}
                onChange={(e) => setLecturerId(e.target.value)}
                disabled={saving}
              >
                <option value="">No lecturer assigned</option>
                {lecturers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name} ({l.lecturer_number})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:"var(--sp-3)", marginTop:"var(--sp-6)" }}>
            <button type="button" className="btn btn-ghost btn-md" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-md" disabled={saving}>
              {saving ? "Saving..." : mode === "add" ? "Add Course" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Course Details Drawer                                               */
/* ------------------------------------------------------------------ */

function DetailsDrawer({ course, onClose }: { course: UICourse; onClose: () => void }) {
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
          <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>Course Details</h3>
          <button className="btn btn-ghost btn-sm" style={{ padding:"6px 8px" }} onClick={onClose}>
            <span className="btn-icon"><HiOutlineXMark /></span>
          </button>
        </div>

        <div style={{ padding:"var(--sp-6)", flex:1 }}>
          {/* Course code badge */}
          <div style={{ marginBottom:"var(--sp-6)" }}>
            <div style={{
              display: "inline-block",
              padding: "var(--sp-2) var(--sp-3)",
              background: "var(--accent-subtle)",
              border: "1px solid var(--accent-border)",
              borderRadius: "var(--radius-md)",
              color: "var(--accent)",
              fontFamily: "monospace",
              fontSize: "var(--tx-sm)",
              fontWeight: 700,
            }}>
              {course.course_code}
            </div>
            <div style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)", marginTop:"var(--sp-3)" }}>
              {course.course_name}
            </div>
            <div style={{ marginTop:"var(--sp-2)" }}>
              <span className={`badge badge-sm ${course.status === "Active" ? "badge-success" : "badge-neutral"}`}>
                {course.status}
              </span>
            </div>
          </div>

          {/* Info rows */}
          {[
            { label: "Programme", value: course.programme || "—" },
            { label: "Lecturer",  value: course.lecturer_name ? `${course.lecturer_name} (${course.lecturer_number})` : "Not assigned" },
            { label: "Created",   value: course.created_at ? new Date(course.created_at).toLocaleDateString() : "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"var(--sp-3) 0", borderBottom:"1px solid var(--border-subtle)" }}>
              <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", flexShrink:0, marginRight:"var(--sp-4)" }}>{label}</span>
              <span style={{ fontSize:"var(--tx-sm)", color:"var(--text-primary)", fontWeight:500, textAlign:"right", wordBreak:"break-word" }}>{value}</span>
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
/*  Main Courses page                                                   */
/* ------------------------------------------------------------------ */

export default function Courses() {
  /* --- data state --- */
  const [courses, setCourses] = useState<UICourse[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* --- filters --- */
  const [search,      setSearch]      = useState("");
  const [fProgramme,  setFProgramme]  = useState("");

  /* --- modals / drawers --- */
  type ModalState =
    | { type: "none" }
    | { type: "add" }
    | { type: "edit";   course: UICourse }
    | { type: "view";   course: UICourse }
    | { type: "delete"; course: UICourse };

  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [actionLoading, setActionLoading] = useState(false);

  /* --- sort --- */
  const [sortKey, setSortKey] = useState<keyof UICourse>("course_code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: keyof UICourse) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  /* --- load data on mount --- */
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [coursesData, lecturersData] = await Promise.all([
        coursesService.getCourses(),
        lecturersService.getLecturers()
      ]);
      // Add UI-only status field (default to Active for now)
      setCourses(coursesData.map(c => ({ ...c, status: "Active" as CourseStatus })));
      setLecturers(lecturersData);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  /* --- filtered + sorted rows --- */
  const rows = useMemo(() => {
    let list = [...courses];
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((c) =>
      c.course_code.toLowerCase().includes(q) ||
      c.course_name.toLowerCase().includes(q) ||
      c.programme.toLowerCase().includes(q)
    );
    if (fProgramme) list = list.filter((c) => c.programme === fProgramme);

    list.sort((a, b) => {
      const av = String(a[sortKey]).toLowerCase();
      const bv = String(b[sortKey]).toLowerCase();
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [courses, search, fProgramme, sortKey, sortDir]);

  const filtersActive = !!(search || fProgramme);

  function clearFilters() { setSearch(""); setFProgramme(""); }

  /* --- actions --- */
  async function handleAdd(data: { course_code: string; course_name: string; programme: string; lecturer_id?: number | null }) {
    const result = await coursesService.createCourse(data);
    setCourses((prev) => [{ ...result.course, status: "Active" }, ...prev]);
  }

  async function handleEdit(course: UICourse, data: { course_code: string; course_name: string; programme: string; lecturer_id?: number | null }) {
    const result = await coursesService.updateCourse(course.id, data);
    setCourses((prev) => prev.map((c) => c.id === course.id ? { ...result.course, status: c.status } : c));
  }

  async function handleDelete(course: UICourse) {
    setActionLoading(true);
    try {
      await coursesService.deleteCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      setModal({ type: "none" });
    } catch (err: any) {
      alert(err.message || "Failed to delete course");
    } finally {
      setActionLoading(false);
    }
  }

  /* --- sort header --- */
  function SortTh({ label, field, style }: { label: string; field: keyof UICourse; style?: React.CSSProperties }) {
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
          <span className="page-eyebrow">Academic</span>
          <h1 className="page-title">Courses</h1>
          <p className="page-desc">Manage courses, modules and assigned lecturers.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost btn-md" disabled>
            <span className="btn-icon"><HiOutlineArrowDownTray /></span>
            Export
          </button>
          <button className="btn btn-primary btn-md" onClick={() => setModal({ type: "add" })}>
            <span className="btn-icon"><HiOutlinePlus /></span>
            Add Course
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
              Failed to load courses
            </div>
            <div style={{ fontSize: "var(--tx-sm)", color: "var(--danger-text)", marginTop: 2 }}>
              {error}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadData}>
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
            placeholder="Search by course code, name or programme…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter row */}
        <div style={{ display:"flex", gap:"var(--sp-3)", flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:"var(--tx-sm)", color:"var(--text-muted)", flexShrink:0 }}>
            <HiOutlineFunnel style={{ fontSize:15 }} /> Filters
          </span>

          <select className="form-input" style={{ minWidth:170 }} value={fProgramme} onChange={(e) => setFProgramme(e.target.value)}>
            <option value="">All Programmes</option>
            {PROGRAMMES.map((p) => <option key={p}>{p}</option>)}
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
            {loading ? "Loading..." : `${rows.length} ${rows.length === 1 ? "course" : "courses"}${filtersActive ? " matching filters" : " total"}`}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Course Code" field="course_code" style={{ paddingLeft:"var(--sp-6)" }} />
                <SortTh label="Course Name" field="course_name" />
                <SortTh label="Programme"   field="programme" />
                <th>Lecturer</th>
                <SortTh label="Status" field="status" />
                <th style={{ textAlign:"right", paddingRight:"var(--sp-6)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign:"center", padding:"var(--sp-12)", color:"var(--text-muted)" }}>
                    Loading courses...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign:"center", padding:"var(--sp-12)", color:"var(--text-muted)" }}>
                    {filtersActive ? "No courses match the current filters." : "No courses found. Add your first course to get started."}
                  </td>
                </tr>
              )}
              {!loading && rows.map((c) => (
                <tr key={c.id}>
                  <td style={{ paddingLeft:"var(--sp-6)", fontFamily:"monospace", fontSize:"var(--tx-sm)", color:"var(--text-secondary)", fontWeight:600 }}>
                    {c.course_code}
                  </td>
                  <td>
                    <span style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--text-primary)" }}>
                      {c.course_name}
                    </span>
                  </td>
                  <td style={{ whiteSpace:"nowrap" }}>{c.programme || "—"}</td>
                  <td style={{ color:"var(--text-muted)", whiteSpace:"nowrap" }}>
                    {c.lecturer_name || "Not assigned"}
                  </td>
                  <td>
                    <span className={`badge badge-sm ${c.status === "Active" ? "badge-success" : "badge-neutral"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ textAlign:"right", paddingRight:"var(--sp-6)" }}>
                    <RowMenu
                      course={c}
                      onView={(x)   => setModal({ type:"view",   course: x })}
                      onEdit={(x)   => setModal({ type:"edit",   course: x })}
                      onDelete={(x) => setModal({ type:"delete", course: x })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Modals / Drawers ---- */}
      {modal.type === "add" && (
        <CourseModal
          mode="add"
          lecturers={lecturers}
          onClose={() => setModal({ type:"none" })}
          onSave={handleAdd}
        />
      )}
      {modal.type === "edit" && (
        <CourseModal
          mode="edit"
          initial={modal.course}
          lecturers={lecturers}
          onClose={() => setModal({ type:"none" })}
          onSave={(data) => handleEdit(modal.course, data)}
        />
      )}
      {modal.type === "view" && (
        <DetailsDrawer course={modal.course} onClose={() => setModal({ type:"none" })} />
      )}
      {modal.type === "delete" && (
        <ConfirmDialog
          title="Delete Course"
          message={`This will permanently remove ${modal.course.course_name} (${modal.course.course_code}) from the system. This action cannot be undone.`}
          confirmLabel="Delete Course"
          danger
          loading={actionLoading}
          onConfirm={() => handleDelete(modal.course)}
          onCancel={() => setModal({ type:"none" })}
        />
      )}
    </>
  );
}
