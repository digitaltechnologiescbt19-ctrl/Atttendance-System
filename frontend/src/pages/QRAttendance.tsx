import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowPath,
  HiOutlineClock,
  HiOutlineNoSymbol,
  HiOutlinePlus,
  HiOutlineQrCode,
  HiOutlineXMark,
} from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";
import type { AttendanceRecord, Course, Session } from "../types/attendance";
import { getSessionWindow } from "../types/attendance";

const API_URL = import.meta.env.VITE_API_URL ?? "";

type Notice = { type: "success" | "error"; text: string } | null;

function authHeaders(token: string | null): HeadersInit {
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function safeDate(value?: string | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function safeTime(value?: string | null): string {
  if (!value) return "Time unavailable";
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "Time unavailable";
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function sessionRange(session: Session): string {
  return `${safeTime(session.start_time)} - ${safeTime(session.end_time)}`;
}

function StatusBadge({ session }: { session: Session }) {
  if (!session.is_active) return <span className="badge badge-sm badge-neutral">Closed</span>;
  return <span className={`badge badge-sm ${getSessionWindow(session) === "open-present" ? "badge-success" : "badge-warning"}`}>{getSessionWindow(session) === "open-present" ? "Open" : "Open - Late window"}</span>;
}

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <div style={{ padding: "var(--sp-3) var(--sp-4)", marginBottom: "var(--sp-5)", borderRadius: "var(--radius-md)", background: notice.type === "success" ? "var(--success-subtle)" : "var(--danger-subtle)", border: `1px solid ${notice.type === "success" ? "var(--success-border)" : "var(--danger-border)"}`, color: notice.type === "success" ? "var(--success-text)" : "var(--danger-text)" }}>{notice.text}</div>;
}

function Countdown({ session }: { session: Session }) {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    function calculate() {
      const end = new Date(`${session.session_date.slice(0, 10)}T${session.end_time}`);
      const remaining = end.getTime() - Date.now();
      setSeconds(Number.isNaN(end.getTime()) ? null : Math.max(0, Math.ceil(remaining / 1000)));
    }
    calculate();
    const timer = window.setInterval(calculate, 1000);
    return () => window.clearInterval(timer);
  }, [session.session_date, session.end_time]);
  if (seconds === null) return <span>Time unavailable</span>;
  if (seconds === 0) return <span>Session ended</span>;
  return <span>Session ends in {Math.floor(seconds / 60).toString().padStart(2, "0")}:{(seconds % 60).toString().padStart(2, "0")}</span>;
}

interface CreateProps { courses: Course[]; token: string | null; onClose: () => void; onCreated: (session: Session) => void; }
function CreateSession({ courses, token, onClose, onCreated }: CreateProps) {
  const [courseId, setCourseId] = useState(courses[0]?.id?.toString() ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("08:00");
  const [duration, setDuration] = useState("60");
  const [presentWindow, setPresentWindow] = useState("10");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!courseId) { setError("Select a course first."); return; }
    const [hours, minutes] = startTime.split(":").map(Number);
    const end = new Date(2000, 0, 1, hours, minutes + Number(duration));
    const endTime = `${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`;
    setSaving(true); setError("");
    try {
      const response = await fetch(`${API_URL}/api/attendance/sessions`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({ course_id: Number(courseId), session_date: date, start_time: startTime, end_time: endTime, present_window_minutes: Number(presentWindow) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not create session.");
      const course = courses.find((item) => item.id === Number(courseId));
      onCreated({ ...data.session, course_code: course?.course_code ?? "", course_name: course?.course_name ?? "", qr_token: null });
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not create session."); }
    finally { setSaving(false); }
  }
  return <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "var(--bg-overlay)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--sp-4)" }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="card card-pad" style={{ width: "100%", maxWidth: 520 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--sp-5)" }}><div><span className="page-eyebrow">New session</span><h2 style={{ fontSize: "var(--tx-lg)", color: "var(--text-primary)" }}>Create attendance session</h2><p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", marginTop: "var(--sp-1)" }}>Set the class window, then display the generated QR code.</p></div><button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><HiOutlineXMark /></button></div>{error && <NoticeBanner notice={{ type: "error", text: error }} />}<form onSubmit={submit}><div style={{ display: "grid", gap: "var(--sp-4)" }}><div className="form-group"><label className="form-label">Course</label><select className="form-input" value={courseId} onChange={(event) => setCourseId(event.target.value)} required><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.course_code} - {course.course_name}</option>)}</select></div><div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-4)" }}><div className="form-group"><label className="form-label">Start time</label><input className="form-input" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></div><div className="form-group"><label className="form-label">Session duration</label><select className="form-input" value={duration} onChange={(event) => setDuration(event.target.value)}><option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">1 hour 30 minutes</option><option value="120">2 hours</option><option value="180">3 hours</option></select></div></div><div className="form-group"><label className="form-label">Present window</label><select className="form-input" value={presentWindow} onChange={(event) => setPresentWindow(event.target.value)}><option value="5">First 5 minutes</option><option value="10">First 10 minutes</option><option value="15">First 15 minutes</option><option value="20">First 20 minutes</option></select></div><div style={{ padding: "var(--sp-3) var(--sp-4)", background: "var(--bg-surface-raised)", borderRadius: "var(--radius-md)", color: "var(--text-muted)", fontSize: "var(--tx-sm)", lineHeight: 1.7 }}><strong style={{ color: "var(--text-primary)" }}>Attendance timing</strong><br />First {presentWindow} minutes: <span style={{ color: "var(--success-text)" }}>Present</span><br />Remaining session window: <span style={{ color: "var(--warning-text)" }}>Late</span><br />After session closes: <span style={{ color: "var(--danger-text)" }}>Absent</span></div></div><div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-3)", marginTop: "var(--sp-6)" }}><button type="button" className="btn btn-ghost btn-md" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-md" type="submit" disabled={saving || courses.length === 0}>{saving ? "Creating..." : "Create session"}</button></div></form></div></div>;
}

interface LiveProps { session: Session; qr: string; records: AttendanceRecord[]; onBack: () => void; onRefreshQr: () => Promise<void>; onRefreshRecords: () => Promise<void>; onCloseSession: () => Promise<void>; }
function LiveSession({ session, qr, records, onBack, onRefreshQr, onRefreshRecords, onCloseSession }: LiveProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const present = records.filter((record) => record.status === "present").length;
  const late = records.filter((record) => record.status === "late").length;
  useEffect(() => {
    if (!session.is_active) return;
    const timer = window.setInterval(() => void onRefreshRecords(), 5000);
    return () => window.clearInterval(timer);
  }, [onRefreshRecords, session.is_active]);
  async function refreshQr() { setRefreshing(true); try { await onRefreshQr(); setNotice({ type: "success", text: "QR code refreshed." }); } catch { setNotice({ type: "error", text: "Could not refresh the QR code." }); } finally { setRefreshing(false); } }
  async function closeSession() { setClosing(true); try { await onCloseSession(); setNotice({ type: "success", text: "Session closed." }); } catch { setNotice({ type: "error", text: "Could not close the session." }); } finally { setClosing(false); } }
  return <><div className="page-header"><div className="page-header-left"><button className="btn btn-ghost btn-sm" onClick={onBack}><HiOutlineArrowLeft /> Back to QR Attendance</button><div style={{ marginTop: "var(--sp-4)" }}><span className="page-eyebrow">Live session</span><h1 className="page-title">{session.course_code || "Course"} <span style={{ color: "var(--text-muted)" }}>Â·</span> {session.course_name || "Attendance"}</h1><p className="page-desc">{safeDate(session.session_date)} Â· {sessionRange(session)}</p></div></div><div className="page-header-actions" style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}><span className="badge badge-sm badge-success">{session.is_active ? "Session open" : "Session closed"}</span>{session.is_active && <span style={{ color: "var(--text-secondary)", fontSize: "var(--tx-sm)" }}><HiOutlineClock /> <Countdown session={session} /></span>}{session.is_active && <button className="btn btn-danger btn-md" onClick={() => void closeSession()} disabled={closing}>{closing ? "Closing..." : "Close session"}</button>}</div></div><NoticeBanner notice={notice} /><div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 0.9fr) minmax(0, 1.4fr)", gap: "var(--sp-6)", alignItems: "start" }} className="qr-live-grid"><section className="card card-pad" style={{ textAlign: "center" }}><div className="card-title">Student check-in</div><p className="card-subtitle" style={{ marginBottom: "var(--sp-5)" }}>Students scan this QR code using the NBI Smart Attendance app.</p><div style={{ display: "inline-block", background: "#fff", padding: "var(--sp-4)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}><img src={qr} alt="Attendance QR code" style={{ display: "block", width: 280, height: 280, maxWidth: "100%" }} /></div>{session.is_active && <div style={{ marginTop: "var(--sp-5)", color: "var(--text-secondary)", fontSize: "var(--tx-sm)" }}><HiOutlineClock /> <Countdown session={session} /></div>}<div style={{ display: "flex", justifyContent: "center", marginTop: "var(--sp-4)" }}><button className="btn btn-ghost btn-sm" onClick={() => void refreshQr()} disabled={refreshing}><HiOutlineArrowPath /> {refreshing ? "Refreshing..." : "Regenerate QR"}</button></div><div style={{ marginTop: "var(--sp-5)", paddingTop: "var(--sp-4)", borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontSize: "var(--tx-xs)", lineHeight: 1.7 }}>First {session.present_window_minutes || 10} minutes: <span style={{ color: "var(--success-text)" }}>Present</span><br />Remaining open time: <span style={{ color: "var(--warning-text)" }}>Late</span><br />After close: <span style={{ color: "var(--danger-text)" }}>Absent</span></div></section><section className="card card-pad"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}><div><div className="card-title">Live check-ins</div><div className="card-subtitle">New scans appear automatically.</div></div><button className="btn btn-ghost btn-sm" onClick={() => void onRefreshRecords()}><HiOutlineArrowPath /> Refresh</button></div><div style={{ display: "flex", gap: "var(--sp-5)", flexWrap: "wrap", padding: "var(--sp-3) 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", marginBottom: "var(--sp-4)" }}><strong style={{ color: "var(--success-text)" }}>Present {present}</strong><strong style={{ color: "var(--warning-text)" }}>Late {late}</strong><strong style={{ color: "var(--text-primary)" }}>Total checked in {records.length}</strong></div>{records.length === 0 ? <div style={{ padding: "var(--sp-8) var(--sp-3)", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--tx-sm)" }}><HiOutlineNoSymbol style={{ fontSize: 26, marginBottom: "var(--sp-2)" }} /><div>No students have checked in yet. New scans will appear here in real time.</div></div> : <div className="table-wrap"><table><thead><tr><th>Student</th><th>Student number</th><th>Check-in time</th><th>Status</th></tr></thead><tbody>{records.slice().reverse().map((record) => <tr key={record.id}><td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{record.full_name || "Unknown student"}</td><td>{record.student_number || "-"}</td><td>{record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "-"}</td><td><span className={`badge badge-sm ${record.status === "present" ? "badge-success" : record.status === "late" ? "badge-warning" : "badge-danger"}`}>{record.status}</span></td></tr>)}</tbody></table></div>}</section></div></>;
}

function StudentScanner() {
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const token = localStorage.getItem("nbi-auth-token") || sessionStorage.getItem("nbi-auth-token");
  async function stop() { if (scannerRef.current) { try { await scannerRef.current.stop(); } catch { /* already stopped */ } scannerRef.current.clear(); scannerRef.current = null; } setScanning(false); }
  async function submit(payload: string) { let qrToken = payload.trim(); try { const parsed = JSON.parse(qrToken) as { qr_token?: string }; if (parsed.qr_token) qrToken = parsed.qr_token; } catch { /* raw token */ } setSubmitting(true); try { const response = await fetch(`${API_URL}/api/attendance/mark`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({ qr_token: qrToken }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "This QR code could not be verified."); setNotice({ type: "success", text: data.message || "Attendance marked successfully." }); } catch (err: unknown) { setNotice({ type: "error", text: err instanceof Error ? err.message : "This QR code could not be verified." }); } finally { setSubmitting(false); } }
  async function start() { setNotice(null); const scanner = new Html5Qrcode("student-qr-reader"); scannerRef.current = scanner; try { await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, async (text) => { await stop(); await submit(text); }, () => undefined); setScanning(true); } catch (err: unknown) { scannerRef.current = null; setNotice({ type: "error", text: err instanceof Error ? err.message : "Camera access was not granted." }); } }
  useEffect(() => {
    return () => { if (scannerRef.current) void scannerRef.current.stop().catch(() => undefined); };
  }, []);
  return <><div className="page-header"><div className="page-header-left"><span className="page-eyebrow">Student attendance</span><h1 className="page-title">Scan attendance</h1><p className="page-desc">Scan your lecturer&apos;s QR code to mark your attendance.</p></div></div><NoticeBanner notice={notice} /><div className="card card-pad" style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}><div className="card-title">Camera scanner</div><p className="card-subtitle" style={{ marginBottom: "var(--sp-5)" }}>Allow camera access, then place the QR code inside the frame.</p><div id="student-qr-reader" style={{ width: "100%", maxWidth: 440, margin: "0 auto", overflow: "hidden", borderRadius: "var(--radius-md)" }} />{!scanning && <div style={{ marginTop: "var(--sp-5)" }}><button className="btn btn-primary btn-md" onClick={() => void start()} disabled={submitting}><HiOutlineQrCode /> {submitting ? "Recording..." : "Start camera"}</button></div>}{scanning && <div style={{ marginTop: "var(--sp-5)" }}><button className="btn btn-ghost btn-md" onClick={() => void stop()}>Stop camera</button></div>}</div></>;
}

export default function QRAttendance() {
  const { user, token } = useAuth();
  if (user?.role === "student") return <StudentScanner />;
  return <LecturerAttendance token={token} />;
}

function LecturerAttendance({ token }: { token: string | null }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [liveSession, setLiveSession] = useState<Session | null>(null);
  const [qr, setQr] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const lecturerId = useAuth().user?.linked_id ?? null;
  async function load() {
    if (!lecturerId) { setLoading(false); return; }
    try {
      const [sessionsResponse, coursesResponse] = await Promise.all([
        fetch(`${API_URL}/api/attendance/lecturers/${lecturerId}/sessions`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/api/attendance/lecturers/${lecturerId}/courses`, { headers: authHeaders(token) }),
      ]);
      if (!sessionsResponse.ok) throw new Error("Could not load attendance sessions.");
      const sessionData = await sessionsResponse.json();
      const courseData = coursesResponse.ok ? await coursesResponse.json() : [];
      setSessions(Array.isArray(sessionData) ? sessionData : []);
      setCourses(Array.isArray(courseData) ? courseData : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load attendance sessions.");
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [lecturerId, token]);
  async function openLive(session: Session) { try { const response = await fetch(`${API_URL}/api/attendance/sessions/${session.id}/generate-qr`, { method: "POST", headers: authHeaders(token) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not generate QR."); setLiveSession({ ...session, ...data.session }); setQr(data.qr_code); await refreshRecords(session.id); } catch (err: unknown) { setNotice({ type: "error", text: err instanceof Error ? err.message : "Could not open session." }); } }
  async function refreshRecords(sessionId: number) { const response = await fetch(`${API_URL}/api/attendance/records/by-session/${sessionId}`, { headers: authHeaders(token) }); if (response.ok) { const data = await response.json(); setRecords(Array.isArray(data) ? data : []); } }
  async function refreshQr() { if (!liveSession) return; const response = await fetch(`${API_URL}/api/attendance/sessions/${liveSession.id}/generate-qr`, { method: "POST", headers: authHeaders(token) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not refresh QR."); setQr(data.qr_code); setLiveSession({ ...liveSession, ...data.session }); }
  async function closeSession() { if (!liveSession) return; const response = await fetch(`${API_URL}/api/attendance/sessions/${liveSession.id}/close`, { method: "PATCH", headers: authHeaders(token) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not close session."); setLiveSession({ ...liveSession, ...data.session, is_active: false }); setSessions((items) => items.map((item) => item.id === liveSession.id ? { ...item, is_active: false } : item)); }
  if (liveSession && qr) return <LiveSession session={liveSession} qr={qr} records={records} onBack={() => { setLiveSession(null); setQr(""); void load(); }} onRefreshQr={refreshQr} onRefreshRecords={() => refreshRecords(liveSession.id)} onCloseSession={closeSession} />;
  if (!lecturerId) return <div className="empty-state"><div className="empty-title">No lecturer profile linked</div><div className="empty-desc">Contact an administrator to link your lecturer profile.</div></div>;
  const active = sessions.filter((session) => session.is_active);
  const recent = sessions.filter((session) => !session.is_active);
  return <><div className="page-header"><div className="page-header-left"><span className="page-eyebrow">Attendance</span><h1 className="page-title">QR Attendance</h1><p className="page-desc">Create a session, display its QR code, and monitor check-ins live.</p></div><div className="page-header-actions"><button className="btn btn-primary btn-md" onClick={() => setShowCreate(true)}><HiOutlinePlus /> New attendance session</button></div></div><NoticeBanner notice={notice} />{error && <NoticeBanner notice={{ type: "error", text: error }} />}{loading ? <div className="card card-pad">Loading attendance sessions...</div> : <><section style={{ marginBottom: "var(--sp-6)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--sp-3)" }}><div><h2 style={{ fontSize: "var(--tx-md)", color: "var(--text-primary)" }}>Active session{active.length === 1 ? "" : "s"}</h2><p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)" }}>Your currently open attendance windows.</p></div></div>{active.length === 0 ? <div className="card card-pad" style={{ borderStyle: "dashed" }}><div className="empty-state" style={{ padding: "var(--sp-6) 0" }}><HiOutlineQrCode className="empty-icon" /><div className="empty-title">No active session right now</div><div className="empty-desc">Start a session when your class is ready to check in.</div></div></div> : <div style={{ display: "grid", gap: "var(--sp-3)" }}>{active.map((session) => <SessionRow key={session.id} session={session} onOpen={() => void openLive(session)} />)}</div>}</section><section><div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--sp-3)" }}><div><h2 style={{ fontSize: "var(--tx-md)", color: "var(--text-primary)" }}>Recent sessions</h2><p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)" }}>Review closed attendance windows and their check-ins.</p></div></div>{recent.length === 0 ? <div className="card card-pad" style={{ borderStyle: "dashed" }}><div className="empty-state" style={{ padding: "var(--sp-6) 0" }}><HiOutlineClock className="empty-icon" /><div className="empty-title">Your recent sessions will appear here</div><div className="empty-desc">Completed sessions remain available for review.</div></div></div> : <div style={{ display: "grid", gap: "var(--sp-3)" }}>{recent.map((session) => <SessionRow key={session.id} session={session} onOpen={() => void openLive(session)} />)}</div>}</section></>}{showCreate && <CreateSession courses={courses} token={token} onClose={() => setShowCreate(false)} onCreated={(session) => { setShowCreate(false); void openLive(session); }} />}</>;
}

function SessionRow({ session, onOpen }: { session: Session; onOpen: () => void }) {
  return <div className="card card-pad" style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.4fr) minmax(130px, 1fr) minmax(130px, 1fr) auto", gap: "var(--sp-4)", alignItems: "center" }}><div><div style={{ color: "var(--text-primary)", fontWeight: 700 }}>{session.course_code || "Course"}</div><div style={{ color: "var(--text-muted)", fontSize: "var(--tx-sm)", marginTop: 2 }}>{session.course_name || "Course title unavailable"}</div></div><div><div style={{ color: "var(--text-muted)", fontSize: "var(--tx-xs)" }}>Date</div><div style={{ color: "var(--text-secondary)", fontSize: "var(--tx-sm)" }}>{safeDate(session.session_date)}</div></div><div><div style={{ color: "var(--text-muted)", fontSize: "var(--tx-xs)" }}>Time</div><div style={{ color: "var(--text-secondary)", fontSize: "var(--tx-sm)" }}>{sessionRange(session)}</div></div><div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", justifyContent: "flex-end" }}><StatusBadge session={session} /><button className="btn btn-secondary btn-sm" onClick={onOpen}><HiOutlineQrCode /> View session</button></div></div>;
}
