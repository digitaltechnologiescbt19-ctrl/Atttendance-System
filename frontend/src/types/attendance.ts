/**
 * NBI Smart Attendance System — Shared Attendance Types
 *
 * This file is the single source of truth for all attendance-related
 * data structures used across the frontend.
 *
 * All pages, components and API calls must import from here.
 * Never duplicate these types inline in individual components.
 */

/* ------------------------------------------------------------------ */
/*  Enumerations                                                        */
/* ------------------------------------------------------------------ */

/**
 * The attendance status for a single student in a single session.
 *
 * Business rules (enforced server-side):
 *   PRESENT  — scan recorded within the first present_window_minutes
 *              (currently 10 minutes from qr_generated_at)
 *   LATE     — scan recorded after present_window_minutes but before
 *              the session closes
 *   ABSENT   — no scan recorded when the session closed
 *
 * NOT_YET_SCANNED is a UI-only state used while a session is still
 * open for enrolled students who have not yet checked in.
 */
export type AttendanceStatus = "present" | "late" | "absent" | "not_yet_scanned";

/** Session lifecycle state. */
export type SessionStatus = "open" | "closed";

/* ------------------------------------------------------------------ */
/*  Core domain records                                                 */
/* ------------------------------------------------------------------ */

/**
 * A single attendance check-in record.
 * Mirrors the `attendance` table in PostgreSQL.
 */
export interface AttendanceRecord {
  id: number;
  student_id: number;
  session_id: number;
  status: "present" | "late" | "absent";
  /** ISO-8601 timestamp — exact moment the QR was scanned */
  check_in_time: string;
  /** Populated via JOIN when fetched with student details */
  student_number?: string;
  full_name?: string;
  /** Populated via JOIN when fetched with session/course details */
  session_date?: string;
  start_time?: string;
  end_time?: string;
  course_code?: string;
  course_name?: string;
}

/**
 * An attendance session.
 * Mirrors the `sessions` table joined with `courses`.
 */
export interface Session {
  id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  session_date: string;          // ISO date "YYYY-MM-DD"
  start_time: string;            // "HH:MM:SS"
  end_time: string;              // "HH:MM:SS"
  is_active: boolean;
  /** UUID token embedded in the QR code */
  qr_token: string | null;
  /** When the QR was last generated — used to calculate present/late */
  qr_generated_at: string | null; // ISO-8601 timestamp
  /** Minutes from qr_generated_at during which scans are PRESENT (default 10) */
  present_window_minutes: number;
}

/**
 * Full QR generation response from POST /sessions/:id/generate-qr
 */
export interface QRGenerateResponse {
  message: string;
  session: Session;
  /** Raw UUID token — embedded in the QR */
  qr_token: string;
  /** data: URI — base64-encoded PNG ready for <img src> */
  qr_code: string;
}

/**
 * Payload for creating a new session.
 * Sent to POST /api/attendance/sessions
 */
export interface CreateSessionPayload {
  course_id: number;
  session_date: string;   // "YYYY-MM-DD"
  start_time: string;     // "HH:MM"
  end_time: string;       // "HH:MM"
  present_window_minutes?: number;
}

/**
 * Payload for marking attendance.
 * Sent to POST /api/attendance/mark
 */
export interface MarkAttendancePayload {
  student_id: number;
  session_id: number;
  qr_token: string;
}

/**
 * Course record (from the `courses` table).
 */
export interface Course {
  id: number;
  course_code: string;
  course_name: string;
  programme?: string;
}

/* ------------------------------------------------------------------ */
/*  Derived / aggregate types used by UI                               */
/* ------------------------------------------------------------------ */

/**
 * Live attendance summary for a single open session.
 * Computed on the frontend from AttendanceRecord[] or
 * returned directly by a future summary endpoint.
 */
export interface SessionAttendanceSummary {
  session_id: number;
  total_enrolled: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  /** Students still open (session active, not yet scanned) */
  not_yet_scanned_count: number;
  attendance_percentage: number; // (present + late) / total_enrolled * 100
}

/**
 * A student row inside the live attendance feed for an open session.
 */
export interface LiveAttendanceRow {
  student_id: number;
  student_number: string;
  full_name: string;
  status: AttendanceStatus;
  check_in_time: string | null; // null if not yet scanned
}

/* ------------------------------------------------------------------ */
/*  Utility functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Determines the current window status of a session.
 *   - "open-present"  — session open, within present_window_minutes
 *   - "open-late"     — session open, past present window
 *   - "closed"        — session closed (is_active === false)
 */
export function getSessionWindow(
  session: Session
): "open-present" | "open-late" | "closed" {
  if (!session.is_active) return "closed";
  if (!session.qr_generated_at) return "open-present"; // QR not yet generated

  const generatedAt = new Date(session.qr_generated_at).getTime();
  const nowMs = Date.now();
  const elapsed = (nowMs - generatedAt) / (1000 * 60); // minutes

  return elapsed <= session.present_window_minutes ? "open-present" : "open-late";
}

/**
 * Formats a "HH:MM:SS" or "HH:MM" time string to "h:MM AM/PM".
 */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/**
 * Formats an ISO date string "YYYY-MM-DD" to a readable date.
 */
export function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Returns the minutes elapsed since the QR was generated.
 * Returns null if qr_generated_at is not set.
 */
export function minutesSinceQR(session: Session): number | null {
  if (!session.qr_generated_at) return null;
  return (Date.now() - new Date(session.qr_generated_at).getTime()) / (1000 * 60);
}

/**
 * Computes a SessionAttendanceSummary from raw attendance records
 * for a given session. totalEnrolled must be passed separately.
 */
export function computeSummary(
  sessionId: number,
  records: AttendanceRecord[],
  totalEnrolled: number
): SessionAttendanceSummary {
  const sessionRecords = records.filter((r) => r.session_id === sessionId);
  const present = sessionRecords.filter((r) => r.status === "present").length;
  const late    = sessionRecords.filter((r) => r.status === "late").length;
  const absent  = sessionRecords.filter((r) => r.status === "absent").length;
  const scanned = present + late + absent;
  const notYet  = Math.max(0, totalEnrolled - scanned);

  return {
    session_id: sessionId,
    total_enrolled: totalEnrolled,
    present_count: present,
    late_count: late,
    absent_count: absent,
    not_yet_scanned_count: notYet,
    attendance_percentage:
      totalEnrolled > 0
        ? Math.round(((present + late) / totalEnrolled) * 100)
        : 0,
  };
}
