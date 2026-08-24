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
  HiOutlineAcademicCap,
  HiOutlineCheckCircle,
} from "react-icons/hi2";

import * as studentsService from "../services/studentsService";
import * as coursesService from "../services/coursesService";
import type { Student } from "../services/studentsService";
import type { Course } from "../services/coursesService";

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

type StudentStatus = "Active" | "Inactive";

interface UIStudent extends Student {
  status: StudentStatus;
  account_status?: string;
}

/* ------------------------------------------------------------------ */
/*  Row action menu                                                     */
/* ------------------------------------------------------------------ */

interface RowMenuProps {
  student: UIStudent;
  onView:   (s: UIStudent) => void;
  onEdit:   (s: UIStudent) => void;
  onEnroll: (s: UIStudent) => void;
  onDelete: (s: UIStudent) => void;
}

function RowMenu({ student, onView, onEdit, onEnroll, onDelete }: RowMenuProps) {
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
          <button className="dropdown-item" onClick={() => { onView(student);   setOpen(false); }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <HiOutlineEye style={{ fontSize: 15 }} /> View Profile
            </span>
          </button>
          <button className="dropdown-item" onClick={() => { onEdit(student);   setOpen(false); }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <HiOutlinePencilSquare style={{ fontSize: 15 }} /> Edit
            </span>
          </button>
          <button className="dropdown-item" onClick={() => { onEnroll(student); setOpen(false); }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <HiOutlineAcademicCap style={{ fontSize: 15 }} /> Manage Courses
            </span>
          </button>
          <div className="dropdown-divider" />
          <button className="dropdown-item danger" onClick={() => { onDelete(student); setOpen(false); }}>
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
/*  Add / Edit Student Modal                                            */
/* ------------------------------------------------------------------ */

interface StudentModalProps {
  mode: "add" | "edit";
  initial?: UIStudent;
  onClose: () => void;
  onSave:  (data: { student_number: string; full_name: string; email: string; programme: string }) => Promise<void>;
}

function StudentModal({ mode, initial, onClose, onSave }: StudentModalProps) {
  const [studentNumber, setStudentNumber] = useState(initial?.student_number || "");
  const [fullName, setFullName] = useState(initial?.full_name || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [programme, setProgramme] = useState(initial?.programme || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentNumber || !fullName || !email || !programme) return;

    setError("");
    setSaving(true);

    try {
      await onSave({ student_number: studentNumber, full_name: fullName, email, programme });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save student");
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
              {mode === "add" ? "Add Student" : "Edit Student"}
            </h2>
            <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>
              {mode === "add" ? "Enrol a new student into the system." : "Update student information."}
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
              <label className="form-label">Student Number <span style={{ color:"var(--danger-text)" }}>*</span></label>
              <input
                className="form-input"
                placeholder="e.g. NBI-2024-001"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Full Name <span style={{ color:"var(--danger-text)" }}>*</span></label>
              <input
                className="form-input"
                placeholder="e.g. Kwame Asante"
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
                placeholder="student@nbi.edu.gh"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
          </div>

          {/* Actions */}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:"var(--sp-3)", marginTop:"var(--sp-6)" }}>
            <button type="button" className="btn btn-ghost btn-md" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-md" disabled={saving}>
              {saving ? "Saving..." : mode === "add" ? "Add Student" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Enrollment Modal — manage student ↔ course relationships           */
/* ------------------------------------------------------------------ */

interface EnrolledCourse {
  id: number;
  course_code: string;
  course_name: string;
  programme: string;
}

function EnrollmentModal({ student, onClose }: { student: UIStudent; onClose: () => void }) {
  const [enrolled, setEnrolled]         = useState<EnrolledCourse[]>([]);
  const [allCourses, setAllCourses]     = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [successMsg, setSuccessMsg]     = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [courses, enrolledRes] = await Promise.all([
          coursesService.getCourses(),
          fetch(`/api/attendance/students/${student.id}/courses`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("nbi-auth-token") || sessionStorage.getItem("nbi-auth-token") || ""}`,
            },
          }).then(r => r.json()).catch(() => []),
        ]);
        setAllCourses(courses);
        setEnrolled(Array.isArray(enrolledRes) ? enrolledRes : []);
      } catch (err: any) {
        setError(err.message || "Failed to load courses");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [student.id]);

  const enrolledIds = new Set(enrolled.map(c => c.id));
  const availableCourses = allCourses.filter(c => !enrolledIds.has(c.id));

  async function handleEnroll() {
    if (!selectedCourse) return;
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const token = localStorage.getItem("nbi-auth-token") || sessionStorage.getItem("nbi-auth-token") || "";
      const res = await fetch("/api/attendance/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ student_id: student.id, course_id: parseInt(selectedCourse) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Enrollment failed");
      // Add course to enrolled list
      const course = allCourses.find(c => c.id === parseInt(selectedCourse));
      if (course) setEnrolled(prev => [...prev, course]);
      setSelectedCourse("");
      setSuccessMsg(`Enrolled in ${course?.course_name || "course"}.`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to enroll");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, background:"var(--bg-overlay)", display:"flex", justifyContent:"flex-end" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width:"100%", maxWidth:480, height:"100vh", borderRadius:0, borderLeft:"1px solid var(--border-default)", overflowY:"auto", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"var(--sp-6)", borderBottom:"1px solid var(--border-subtle)", flexShrink:0 }}>
          <div>
            <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>Course Enrolment</h3>
            <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginTop:"var(--sp-1)" }}>{student.full_name} · {student.student_number}</p>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ padding:"6px 8px" }} onClick={onClose}><span className="btn-icon"><HiOutlineXMark /></span></button>
        </div>

        <div style={{ padding:"var(--sp-5) var(--sp-6)", flex:1 }}>
          {error && (
            <div style={{ padding:"var(--sp-3) var(--sp-4)", background:"var(--danger-subtle)", border:"1px solid var(--danger-border)", borderRadius:"var(--radius-md)", marginBottom:"var(--sp-4)", display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
              <HiOutlineExclamationTriangle style={{ fontSize:16, color:"var(--danger-text)", flexShrink:0 }} />
              <span style={{ fontSize:"var(--tx-sm)", color:"var(--danger-text)" }}>{error}</span>
            </div>
          )}
          {successMsg && (
            <div style={{ padding:"var(--sp-3) var(--sp-4)", background:"var(--success-subtle)", border:"1px solid var(--success-border)", borderRadius:"var(--radius-md)", marginBottom:"var(--sp-4)", display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
              <HiOutlineCheckCircle style={{ fontSize:16, color:"var(--success-text)", flexShrink:0 }} />
              <span style={{ fontSize:"var(--tx-sm)", color:"var(--success-text)" }}>{successMsg}</span>
            </div>
          )}

          {/* Enrol in new course */}
          <div style={{ marginBottom:"var(--sp-6)" }}>
            <h4 style={{ fontSize:"var(--tx-sm)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-3)" }}>Enrol in a Course</h4>
            {loading ? (
              <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>Loading courses...</p>
            ) : availableCourses.length === 0 ? (
              <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>No available courses to enrol in.</p>
            ) : (
              <div style={{ display:"flex", gap:"var(--sp-3)" }}>
                <select className="form-input" style={{ flex:1 }} value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} disabled={saving}>
                  <option value="">Select a course</option>
                  {availableCourses.map(c => (
                    <option key={c.id} value={c.id}>{c.course_code} — {c.course_name}</option>
                  ))}
                </select>
                <button className="btn btn-primary btn-md" onClick={handleEnroll} disabled={!selectedCourse || saving}>
                  {saving ? "Enrolling..." : "Enrol"}
                </button>
              </div>
            )}
          </div>

          {/* Currently enrolled courses */}
          <div>
            <h4 style={{ fontSize:"var(--tx-sm)", fontWeight:700, color:"var(--text-primary)", marginBottom:"var(--sp-3)" }}>
              Enrolled Courses ({enrolled.length})
            </h4>
            {loading ? (
              <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>Loading...</p>
            ) : enrolled.length === 0 ? (
              <p style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)" }}>Not enrolled in any courses yet.</p>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"var(--sp-2)" }}>
                {enrolled.map(c => (
                  <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"var(--sp-3) var(--sp-4)", background:"var(--bg-subtle)", borderRadius:"var(--radius-md)", border:"1px solid var(--border-subtle)" }}>
                    <div>
                      <div style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--text-primary)" }}>{c.course_name}</div>
                      <div style={{ fontSize:"var(--tx-xs)", color:"var(--text-muted)", fontFamily:"monospace", marginTop:2 }}>{c.course_code}</div>
                    </div>
                    <span className="badge badge-sm badge-success">Enrolled</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Student Profile Drawer                                              */
/* ------------------------------------------------------------------ */

function ProfileDrawer({ student, onClose }: { student: UIStudent; onClose: () => void }) {
  const initials = student.full_name
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
          <h3 style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>Student Profile</h3>
          <button className="btn btn-ghost btn-sm" style={{ padding:"6px 8px" }} onClick={onClose}>
            <span className="btn-icon"><HiOutlineXMark /></span>
          </button>
        </div>

        <div style={{ padding:"var(--sp-6)", flex:1 }}>
          {/* Avatar + name */}
          <div style={{ display:"flex", alignItems:"center", gap:"var(--sp-4)", marginBottom:"var(--sp-6)" }}>
            <div style={{
              width:56, height:56, borderRadius:"var(--radius-lg)",
              background:"var(--accent-subtle)", border:"1px solid var(--accent-border)",
              color:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:700, fontSize:"var(--tx-lg)", flexShrink:0,
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize:"var(--tx-md)", fontWeight:700, color:"var(--text-primary)" }}>
                {student.full_name}
              </div>
              <div style={{ fontSize:"var(--tx-sm)", color:"var(--text-muted)", marginTop:2 }}>
                {student.student_number}
              </div>
              <div style={{ marginTop:"var(--sp-2)" }}>
                <span className={`badge badge-sm ${student.status === "Active" ? "badge-success" : "badge-neutral"}`}>
                  {student.status}
                </span>
                {student.account_status === "pending_activation" && (
                  <span className="badge badge-sm badge-warning" style={{ marginLeft: 6 }}>
                    Pending Activation
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Info rows */}
          {[
            { label: "Programme", value: student.programme || "—" },
            { label: "Email",     value: student.email     || "—" },
            { label: "Joined",    value: student.created_at ? new Date(student.created_at).toLocaleDateString() : "—" },
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
/*  Main Students page                                                  */
/* ------------------------------------------------------------------ */

export default function Students() {
  /* --- data state --- */
  const [students, setStudents] = useState<UIStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* --- filters --- */
  const [search,    setSearch]    = useState("");
  const [fProgramme,setFProgramme]= useState("");

  /* --- modals / drawers --- */
  type ModalState =
    | { type: "none" }
    | { type: "add" }
    | { type: "edit";   student: UIStudent }
    | { type: "view";   student: UIStudent }
    | { type: "enroll"; student: UIStudent }
    | { type: "delete"; student: UIStudent };

  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [actionLoading, setActionLoading] = useState(false);

  /* --- sort --- */
  const [sortKey, setSortKey] = useState<keyof UIStudent>("student_number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: keyof UIStudent) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  /* --- load students on mount --- */
  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    try {
      setLoading(true);
      setError("");
      const data = await studentsService.getStudents();
      // Add UI-only status field (default to Active for now)
      setStudents(data.map(s => ({ ...s, status: "Active" as StudentStatus })));
    } catch (err: any) {
      setError(err.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  }

  /* --- filtered + sorted rows --- */
  const rows = useMemo(() => {
    let list = [...students];
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((s) =>
      s.student_number.toLowerCase().includes(q) ||
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
    if (fProgramme) list = list.filter((s) => s.programme === fProgramme);

    list.sort((a, b) => {
      const av = String(a[sortKey]).toLowerCase();
      const bv = String(b[sortKey]).toLowerCase();
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [students, search, fProgramme, sortKey, sortDir]);

  const filtersActive = !!(search || fProgramme);

  function clearFilters() { setSearch(""); setFProgramme(""); }

  /* --- actions --- */
  async function handleAdd(data: { student_number: string; full_name: string; email: string; programme: string }) {
    const result = await studentsService.createStudent(data);
    setStudents((prev) => [{ ...result.student, status: "Active" }, ...prev]);
  }

  async function handleEdit(student: UIStudent, data: { student_number: string; full_name: string; email: string; programme: string }) {
    const result = await studentsService.updateStudent(student.id, data);
    setStudents((prev) => prev.map((s) => s.id === student.id ? { ...result.student, status: s.status } : s));
  }

  async function handleDelete(student: UIStudent) {
    setActionLoading(true);
    try {
      await studentsService.deleteStudent(student.id);
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
      setModal({ type: "none" });
    } catch (err: any) {
      alert(err.message || "Failed to delete student");
    } finally {
      setActionLoading(false);
    }
  }

  /* --- sort header --- */
  function SortTh({ label, field, style }: { label: string; field: keyof UIStudent; style?: React.CSSProperties }) {
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
          <span className="page-eyebrow">Administration</span>
          <h1 className="page-title">Students</h1>
          <p className="page-desc">Manage student records and monitor attendance eligibility.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost btn-md" disabled>
            <span className="btn-icon"><HiOutlineArrowDownTray /></span>
            Export
          </button>
          <button className="btn btn-primary btn-md" onClick={() => setModal({ type: "add" })}>
            <span className="btn-icon"><HiOutlineUserPlus /></span>
            Add Student
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
              Failed to load students
            </div>
            <div style={{ fontSize: "var(--tx-sm)", color: "var(--danger-text)", marginTop: 2 }}>
              {error}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadStudents}>
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
            placeholder="Search by student name, number or email…"
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
            {loading ? "Loading..." : `${rows.length} ${rows.length === 1 ? "student" : "students"}${filtersActive ? " matching filters" : " total"}`}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Student Number" field="student_number" style={{ paddingLeft:"var(--sp-6)" }} />
                <SortTh label="Full Name"      field="full_name" />
                <SortTh label="Programme"      field="programme" />
                <th>Email</th>
                <SortTh label="Status" field="status" />
                <th style={{ textAlign:"right", paddingRight:"var(--sp-6)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign:"center", padding:"var(--sp-12)", color:"var(--text-muted)" }}>
                    Loading students...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign:"center", padding:"var(--sp-12)", color:"var(--text-muted)" }}>
                    {filtersActive ? "No students match the current filters." : "No students registered yet. Add your first student to get started."}
                  </td>
                </tr>
              )}
              {!loading && rows.map((s) => {
                const initials = s.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <tr key={s.id}>
                    <td style={{ paddingLeft:"var(--sp-6)", fontFamily:"monospace", fontSize:"var(--tx-sm)", color:"var(--text-secondary)", fontWeight:500 }}>
                      {s.student_number}
                    </td>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:"var(--sp-3)" }}>
                        <div style={{
                          width:30, height:30, borderRadius:"var(--radius-sm)",
                          background:"var(--accent-subtle)", border:"1px solid var(--accent-border)",
                          color:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center",
                          fontWeight:700, fontSize:"var(--tx-xs)", flexShrink:0,
                        }}>
                          {initials}
                        </div>
                        <span style={{ fontSize:"var(--tx-sm)", fontWeight:600, color:"var(--text-primary)", whiteSpace:"nowrap" }}>
                          {s.full_name}
                        </span>
                      </div>
                    </td>
                    <td style={{ whiteSpace:"nowrap" }}>{s.programme || "—"}</td>
                    <td style={{ color:"var(--text-muted)", whiteSpace:"nowrap" }}>{s.email}</td>
                    <td>
                      <span className={`badge badge-sm ${s.status === "Active" ? "badge-success" : "badge-neutral"}`}>
                        {s.status}
                      </span>
                      {s.account_status === "pending_activation" && (
                        <span className="badge badge-sm badge-warning" style={{ marginLeft: 6 }}>
                          Pending Activation
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign:"right", paddingRight:"var(--sp-6)" }}>
                      <RowMenu
                        student={s}
                        onView={(x)   => setModal({ type:"view",   student: x })}
                        onEdit={(x)   => setModal({ type:"edit",   student: x })}
                        onEnroll={(x) => setModal({ type:"enroll", student: x })}
                        onDelete={(x) => setModal({ type:"delete", student: x })}
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
        <StudentModal
          mode="add"
          onClose={() => setModal({ type:"none" })}
          onSave={handleAdd}
        />
      )}
      {modal.type === "edit" && (
        <StudentModal
          mode="edit"
          initial={modal.student}
          onClose={() => setModal({ type:"none" })}
          onSave={(data) => handleEdit(modal.student, data)}
        />
      )}
      {modal.type === "view" && (
        <ProfileDrawer student={modal.student} onClose={() => setModal({ type:"none" })} />
      )}
      {modal.type === "enroll" && (
        <EnrollmentModal student={modal.student} onClose={() => setModal({ type:"none" })} />
      )}
      {modal.type === "delete" && (
        <ConfirmDialog
          title="Delete Student"
          message={`This will permanently remove ${modal.student.full_name} (${modal.student.student_number}) from the system. This action cannot be undone.`}
          confirmLabel="Delete Student"
          danger
          loading={actionLoading}
          onConfirm={() => handleDelete(modal.student)}
          onCancel={() => setModal({ type:"none" })}
        />
      )}
    </>
  );
}
