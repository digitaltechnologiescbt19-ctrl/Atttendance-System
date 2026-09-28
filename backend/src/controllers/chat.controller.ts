/**
 * NBI Smart Attendance — AI Assistant Controller
 * Secure, Role-Aware, Tool-Assisted Backend Engine with Side-Effect Confirmations & Database Persistence
 */

import { Request, Response } from "express";
import pool from "../database/db";

interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

interface UserContext {
  userId: number;
  email: string;
  name: string;
  role: "admin" | "lecturer" | "student";
  linkedId: number | null;
}

/* ------------------------------------------------------------------ */
/*  Database Persistence for Chat Messages                            */
/* ------------------------------------------------------------------ */

let chatTableChecked = false;
async function ensureChatTableExists() {
  if (chatTableChecked) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        action_required JSONB DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id_created ON chat_messages(user_id, created_at);
    `);
    await pool.query(`
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS action_required JSONB DEFAULT NULL;
    `);
    chatTableChecked = true;
  } catch (err) {
    console.error("Error creating chat_messages table:", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Get Chat History Endpoint (Account-Scoped)                        */
/* ------------------------------------------------------------------ */

export async function getChatHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized request." });
      return;
    }

    await ensureChatTableExists();

    const result = await pool.query(
      `SELECT id, role, content, action_required, created_at as timestamp
       FROM chat_messages
       WHERE user_id = $1
       ORDER BY id ASC`,
      [userId]
    );

    res.json({
      messages: result.rows.map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        action_required: row.action_required,
        timestamp: row.timestamp,
      })),
    });
  } catch (error) {
    console.error("getChatHistory error:", error);
    res.status(500).json({ message: "Failed to load chat history." });
  }
}

/* ------------------------------------------------------------------ */
/*  Clear Chat History Endpoint (Account-Scoped)                      */
/* ------------------------------------------------------------------ */

export async function clearChatHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized request." });
      return;
    }

    await ensureChatTableExists();

    await pool.query("DELETE FROM chat_messages WHERE user_id = $1", [userId]);

    res.json({ message: "Chat history cleared successfully." });
  } catch (error) {
    console.error("clearChatHistory error:", error);
    res.status(500).json({ message: "Failed to clear chat history." });
  }
}

/* ------------------------------------------------------------------ */
/*  Delete Single Message Endpoint                                    */
/* ------------------------------------------------------------------ */

export async function deleteChatMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const { id } = req.params;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized request." });
      return;
    }
    await ensureChatTableExists();
    await pool.query("DELETE FROM chat_messages WHERE id = $1 AND user_id = $2", [id, userId]);
    res.json({ message: "Message deleted successfully." });
  } catch (error) {
    console.error("deleteChatMessage error:", error);
    res.status(500).json({ message: "Failed to delete message." });
  }
}

/* ------------------------------------------------------------------ */
/*  Edit User Message Endpoint                                        */
/* ------------------------------------------------------------------ */

export async function editChatMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { content } = req.body as { content?: string };
    if (!userId) {
      res.status(401).json({ message: "Unauthorized request." });
      return;
    }
    if (!content || !content.trim()) {
      res.status(400).json({ message: "Updated message content is required." });
      return;
    }

    await ensureChatTableExists();

    const check = await pool.query(
      "SELECT id FROM chat_messages WHERE id = $1 AND user_id = $2 AND role = 'user'",
      [id, userId]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ message: "User message not found." });
      return;
    }

    await pool.query("DELETE FROM chat_messages WHERE id >= $1 AND user_id = $2", [id, userId]);

    req.body.message = content.trim();
    await handleChatMessage(req, res);
  } catch (error) {
    console.error("editChatMessage error:", error);
    res.status(500).json({ message: "Failed to edit message." });
  }
}

/* ------------------------------------------------------------------ */
/*  Authorization & User Context Resolver                             */
/* ------------------------------------------------------------------ */

async function getAuthenticatedUser(userId: number): Promise<UserContext> {
  const res = await pool.query(
    "SELECT id, email, name, role, linked_id FROM users WHERE id = $1 AND is_active = TRUE",
    [userId]
  );
  if (res.rows.length === 0) {
    throw new Error("User account not found or inactive.");
  }
  const u = res.rows[0];
  return {
    userId: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    linkedId: u.linked_id ?? null,
  };
}

/* ------------------------------------------------------------------ */
/*  Backend Tool Declarations & Authorization Enforcement            */
/* ------------------------------------------------------------------ */

async function toolGetMyProfile(ctx: UserContext) {
  let profileDetails: Record<string, unknown> = {};

  if (ctx.role === "student" && ctx.linkedId) {
    const s = await pool.query(
      "SELECT id, student_number, full_name, email, programme FROM students WHERE id = $1",
      [ctx.linkedId]
    );
    profileDetails = s.rows[0] || {};
  } else if (ctx.role === "lecturer" && ctx.linkedId) {
    const l = await pool.query(
      "SELECT id, lecturer_number, full_name, email, department FROM lecturers WHERE id = $1",
      [ctx.linkedId]
    );
    profileDetails = l.rows[0] || {};
  }

  return {
    userId: ctx.userId,
    name: ctx.name,
    email: ctx.email,
    role: ctx.role,
    linkedId: ctx.linkedId,
    domainProfile: profileDetails,
  };
}

async function toolGetMyCourses(ctx: UserContext) {
  if (ctx.role === "student") {
    if (!ctx.linkedId) return { error: "No student profile linked." };
    const res = await pool.query(
      `SELECT c.id, c.course_code as code, c.course_name as title, c.programme, l.full_name as lecturer_name
       FROM courses c
       JOIN student_courses sc ON sc.course_id = c.id
       LEFT JOIN lecturers l ON c.lecturer_id = l.id
       WHERE sc.student_id = $1
       ORDER BY c.course_code ASC`,
      [ctx.linkedId]
    );
    return { role: "student", courses: res.rows };
  }

  if (ctx.role === "lecturer") {
    if (!ctx.linkedId) return { error: "No lecturer profile linked." };
    const res = await pool.query(
      `SELECT id, course_code as code, course_name as title, programme
       FROM courses
       WHERE lecturer_id = $1
       ORDER BY course_code ASC`,
      [ctx.linkedId]
    );
    return { role: "lecturer", courses: res.rows };
  }

  if (ctx.role === "admin") {
    const res = await pool.query(
      `SELECT c.id, c.course_code as code, c.course_name as title, c.programme, l.full_name as lecturer_name
       FROM courses c
       LEFT JOIN lecturers l ON c.lecturer_id = l.id
       ORDER BY c.course_code ASC`
    );
    return { role: "admin", courses: res.rows };
  }

  return { error: "Invalid role." };
}

async function toolGetMyAttendance(ctx: UserContext) {
  if (ctx.role !== "student") {
    return {
      error: "Access Denied: Personal attendance records are only applicable to student accounts. Use course attendance tools instead.",
    };
  }

  if (!ctx.linkedId) return { error: "No student profile linked." };

  const summaryRes = await pool.query(
    `SELECT 
       COUNT(*) FILTER (WHERE status = 'present') as present_count,
       COUNT(*) FILTER (WHERE status = 'late') as late_count,
       COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
       COUNT(*) as total_records
     FROM attendance
     WHERE student_id = $1`,
    [ctx.linkedId]
  );

  const summary = summaryRes.rows[0] || {};
  const present = Number(summary.present_count || 0);
  const late = Number(summary.late_count || 0);
  const absent = Number(summary.absent_count || 0);
  const total = Number(summary.total_records || 0);
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  const recordsRes = await pool.query(
    `SELECT a.id, a.check_in_time as scanned_at, a.status, c.course_code, c.course_name as course_title, s.session_date
     FROM attendance a
     JOIN sessions s ON a.session_id = s.id
     JOIN courses c ON s.course_id = c.id
     WHERE a.student_id = $1
     ORDER BY a.check_in_time DESC
     LIMIT 10`,
    [ctx.linkedId]
  );

  return {
    studentId: ctx.linkedId,
    studentName: ctx.name,
    attendanceRate: `${percentage}%`,
    summary: { present, late, absent, total },
    recentRecords: recordsRes.rows,
  };
}

async function toolGetMySchedule(ctx: UserContext) {
  if (ctx.role === "student" && ctx.linkedId) {
    const res = await pool.query(
      `SELECT s.id, c.course_code as code, c.course_name as title, s.session_date, s.start_time, s.end_time, s.status, s.window_type
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       JOIN student_courses sc ON sc.course_id = c.id
       WHERE sc.student_id = $1 AND s.session_date >= CURRENT_DATE
       ORDER BY s.session_date ASC, s.start_time ASC
       LIMIT 10`,
      [ctx.linkedId]
    );
    return { role: "student", schedule: res.rows };
  }

  if (ctx.role === "lecturer" && ctx.linkedId) {
    const res = await pool.query(
      `SELECT s.id, c.course_code as code, c.course_name as title, s.session_date, s.start_time, s.end_time, s.status, s.window_type
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE c.lecturer_id = $1 AND s.session_date >= CURRENT_DATE
       ORDER BY s.session_date ASC, s.start_time ASC
       LIMIT 10`,
      [ctx.linkedId]
    );
    return { role: "lecturer", schedule: res.rows };
  }

  if (ctx.role === "admin") {
    const res = await pool.query(
      `SELECT s.id, c.course_code as code, c.course_name as title, s.session_date, s.start_time, s.end_time, s.status, l.full_name as lecturer_name
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       LEFT JOIN lecturers l ON c.lecturer_id = l.id
       WHERE s.session_date >= CURRENT_DATE
       ORDER BY s.session_date ASC, s.start_time ASC
       LIMIT 15`
    );
    return { role: "admin", schedule: res.rows };
  }

  return { schedule: [] };
}

async function toolGetCourseAttendance(ctx: UserContext, courseId: number) {
  if (ctx.role === "student") {
    return { error: "Access Denied: Students are not authorized to view course-wide attendance reports." };
  }

  if (ctx.role === "lecturer") {
    const check = await pool.query(
      "SELECT id FROM courses WHERE id = $1 AND lecturer_id = $2",
      [courseId, ctx.linkedId]
    );
    if (check.rows.length === 0) {
      return { error: `Access Denied: You are not the assigned lecturer for course ID ${courseId}.` };
    }
  }

  const courseRes = await pool.query("SELECT id, course_code as code, course_name as title FROM courses WHERE id = $1", [courseId]);
  if (courseRes.rows.length === 0) return { error: "Course not found." };

  const statsRes = await pool.query(
    `SELECT 
       COUNT(a.id) FILTER (WHERE a.status = 'present') as present_count,
       COUNT(a.id) FILTER (WHERE a.status = 'late') as late_count,
       COUNT(a.id) FILTER (WHERE a.status = 'absent') as absent_count,
       COUNT(a.id) as total_attendance_logs
     FROM attendance a
     JOIN sessions s ON a.session_id = s.id
     WHERE s.course_id = $1`,
    [courseId]
  );

  const sessionsRes = await pool.query(
    `SELECT id, session_date, start_time, end_time, is_active
     FROM sessions WHERE course_id = $1
     ORDER BY session_date DESC LIMIT 5`,
    [courseId]
  );

  return {
    course: courseRes.rows[0],
    stats: statsRes.rows[0],
    recentSessions: sessionsRes.rows,
  };
}

async function toolGetCourseStudents(ctx: UserContext, courseId: number) {
  if (ctx.role === "student") {
    return { error: "Access Denied: Students are not authorized to view student class rosters." };
  }

  if (ctx.role === "lecturer") {
    const check = await pool.query(
      "SELECT id FROM courses WHERE id = $1 AND lecturer_id = $2",
      [courseId, ctx.linkedId]
    );
    if (check.rows.length === 0) {
      return { error: `Access Denied: You are not authorized to view students in course ID ${courseId}.` };
    }
  }

  const res = await pool.query(
    `SELECT st.id, st.student_number, st.full_name, st.email, st.programme
     FROM students st
     JOIN student_courses sc ON sc.student_id = st.id
     WHERE sc.course_id = $1
     ORDER BY st.full_name ASC`,
    [courseId]
  );

  return { courseId, totalEnrolled: res.rows.length, students: res.rows };
}

async function toolGetInstitutionSummary(ctx: UserContext) {
  if (ctx.role !== "admin") {
    return { error: "Access Denied: Institution-wide attendance summaries are restricted to Administrators." };
  }

  const res = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM students) as total_students,
      (SELECT COUNT(*) FROM lecturers) as total_lecturers,
      (SELECT COUNT(*) FROM courses) as total_courses,
      (SELECT COUNT(*) FROM sessions) as total_sessions,
      (SELECT COUNT(*) FROM attendance) as total_checkins,
      (SELECT COUNT(*) FROM users WHERE account_status = 'pending_activation') as pending_activations
  `);

  return { institutionSummary: res.rows[0] };
}

async function toolCreateAttendanceSession(ctx: UserContext, args: Record<string, any>) {
  if (ctx.role !== "lecturer" && ctx.role !== "admin") {
    return { error: "Access Denied: Only Lecturers and Admins can create attendance sessions." };
  }
  const { course_id, session_date, start_time, end_time, present_window_minutes } = args;
  if (!course_id || !session_date || !start_time || !end_time) {
    return { error: "course_id, session_date, start_time, and end_time are required parameters." };
  }

  if (ctx.role === "lecturer") {
    const courseCheck = await pool.query("SELECT id FROM courses WHERE id = $1 AND lecturer_id = $2", [course_id, ctx.linkedId]);
    if (courseCheck.rows.length === 0) {
      return { error: "Access Denied: You are not the assigned lecturer for this course." };
    }
  }

  const { randomUUID } = await import("crypto");
  const qrToken = randomUUID();

  const res = await pool.query(
    `INSERT INTO sessions (course_id, session_date, start_time, end_time, present_window_minutes, is_active, qr_token, qr_generated_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6, NOW())
     RETURNING *`,
    [course_id, session_date, start_time, end_time, present_window_minutes || 30, qrToken]
  );

  return { success: true, session: res.rows[0] };
}

async function toolCloseAttendanceSession(ctx: UserContext, args: Record<string, any>) {
  if (ctx.role !== "lecturer" && ctx.role !== "admin") {
    return { error: "Access Denied: Only Lecturers and Admins can close attendance sessions." };
  }
  const { session_id } = args;
  if (!session_id) return { error: "session_id is required." };

  if (ctx.role === "lecturer") {
    const check = await pool.query(
      "SELECT s.id FROM sessions s JOIN courses c ON s.course_id = c.id WHERE s.id = $1 AND c.lecturer_id = $2",
      [session_id, ctx.linkedId]
    );
    if (check.rows.length === 0) {
      return { error: "Access Denied: You are not authorized to close this session." };
    }
  }

  await pool.query("UPDATE sessions SET is_active = FALSE WHERE id = $1", [session_id]);
  return { success: true, message: `Attendance session #${session_id} has been closed.` };
}

async function toolCreateCourse(ctx: UserContext, args: Record<string, any>) {
  if (ctx.role !== "admin") {
    return { error: "Access Denied: Only Administrators can create courses." };
  }
  const { course_code, course_name, programme, lecturer_id } = args;
  if (!course_code || !course_name || !programme) {
    return { error: "course_code, course_name, and programme are required." };
  }

  try {
    const res = await pool.query(
      `INSERT INTO courses (course_code, course_name, programme, lecturer_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [course_code, course_name, programme, lecturer_id || null]
    );
    return { success: true, course: res.rows[0] };
  } catch (err: any) {
    if (err.code === "23505") {
      const existing = await pool.query("SELECT * FROM courses WHERE course_code = $1", [course_code]);
      return { success: true, course: existing.rows[0] };
    }
    return { error: "Failed to create course: " + (err.message || "Database error") };
  }
}

async function toolGetStudents(ctx: UserContext) {
  if (ctx.role !== "admin") return { error: "Access Denied: Admin role required." };
  const res = await pool.query("SELECT id, student_number, full_name, email, programme FROM students ORDER BY full_name ASC LIMIT 50");
  return { totalStudents: res.rows.length, students: res.rows };
}

async function toolGetLecturers(ctx: UserContext) {
  if (ctx.role !== "admin") return { error: "Access Denied: Admin role required." };
  const res = await pool.query("SELECT id, lecturer_number, full_name, email, department FROM lecturers ORDER BY full_name ASC");
  return { totalLecturers: res.rows.length, lecturers: res.rows };
}

async function toolReopenAttendanceSession(ctx: UserContext, args: Record<string, any>) {
  if (ctx.role !== "lecturer" && ctx.role !== "admin") {
    return { error: "Access Denied: Only Lecturers and Admins can reopen attendance sessions." };
  }
  const sessionId = Number(args.session_id);
  if (!sessionId) return { error: "session_id is required." };

  if (ctx.role === "lecturer") {
    const check = await pool.query(
      "SELECT s.id FROM sessions s JOIN courses c ON s.course_id = c.id WHERE s.id = $1 AND c.lecturer_id = $2",
      [sessionId, ctx.linkedId]
    );
    if (check.rows.length === 0) {
      return { error: "Access Denied: You are not authorized to modify this session." };
    }
  }

  const extendMinutes = Number(args.extend_minutes || 30);
  const now = new Date();
  const endTimeStr = new Date(now.getTime() + extendMinutes * 60000).toTimeString().slice(0, 5);

  const res = await pool.query(
    `UPDATE sessions 
     SET is_active = TRUE, end_time = $2, session_date = CURRENT_DATE 
     WHERE id = $1 
     RETURNING *`,
    [sessionId, endTimeStr]
  );

  if (res.rows.length === 0) return { error: "Session not found." };
  return {
    success: true,
    message: `Attendance Session #${sessionId} has been reopened until ${endTimeStr} (${extendMinutes} mins).`,
    session: res.rows[0],
  };
}

async function toolExtendAttendanceSession(ctx: UserContext, args: Record<string, any>) {
  if (ctx.role !== "lecturer" && ctx.role !== "admin") {
    return { error: "Access Denied: Only Lecturers and Admins can extend attendance sessions." };
  }
  const sessionId = Number(args.session_id);
  if (!sessionId) return { error: "session_id is required." };

  if (ctx.role === "lecturer") {
    const check = await pool.query(
      "SELECT s.id FROM sessions s JOIN courses c ON s.course_id = c.id WHERE s.id = $1 AND c.lecturer_id = $2",
      [sessionId, ctx.linkedId]
    );
    if (check.rows.length === 0) {
      return { error: "Access Denied: You are not authorized to modify this session." };
    }
  }

  const extendMinutes = Number(args.extend_minutes || 30);
  const now = new Date();
  const endTimeStr = new Date(now.getTime() + extendMinutes * 60000).toTimeString().slice(0, 5);

  const res = await pool.query(
    `UPDATE sessions 
     SET is_active = TRUE, end_time = $2 
     WHERE id = $1 
     RETURNING *`,
    [sessionId, endTimeStr]
  );

  if (res.rows.length === 0) return { error: "Session not found." };
  return {
    success: true,
    message: `Attendance Session #${sessionId} has been extended by ${extendMinutes} minutes (until ${endTimeStr}).`,
    session: res.rows[0],
  };
}

async function toolDiagnoseSessionIssue(ctx: UserContext, args: Record<string, any>) {
  if (ctx.role !== "lecturer" && ctx.role !== "admin") {
    return { error: "Access Denied: Session diagnosis is restricted to Lecturers and Admins." };
  }

  let sessionRes;
  if (args.session_id) {
    sessionRes = await pool.query(
      `SELECT s.id, s.course_id, s.session_date, s.start_time, s.end_time, s.is_active, c.course_code, c.course_name
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE s.id = $1`,
      [Number(args.session_id)]
    );
  } else if (ctx.role === "lecturer" && ctx.linkedId) {
    sessionRes = await pool.query(
      `SELECT s.id, s.course_id, s.session_date, s.start_time, s.end_time, s.is_active, c.course_code, c.course_name
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE c.lecturer_id = $1
       ORDER BY s.id DESC LIMIT 1`,
      [ctx.linkedId]
    );
  } else {
    sessionRes = await pool.query(
      `SELECT s.id, s.course_id, s.session_date, s.start_time, s.end_time, s.is_active, c.course_code, c.course_name
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       ORDER BY s.id DESC LIMIT 1`
    );
  }

  if (sessionRes.rows.length === 0) {
    return {
      issueFound: false,
      diagnosis: "No active or recent attendance session was found for your assigned courses.",
    };
  }

  const s = sessionRes.rows[0];
  const now = new Date();
  const currentTimeStr = now.toTimeString().slice(0, 5);

  if (!s.is_active) {
    return {
      issueFound: true,
      courseCode: s.course_code,
      courseName: s.course_name,
      sessionId: s.id,
      issue: `Attendance session #${s.id} for ${s.course_code} (${s.course_name}) is currently closed (is_active = false).`,
      recommendation: "Reopen the session for 30 minutes to allow student check-ins.",
      proposedTool: "reopen_attendance_session",
      proposedArgs: { session_id: s.id, extend_minutes: 30 },
      proposedDescription: `Reopen Session #${s.id} (${s.course_code}) for 30 minutes`,
    };
  }

  if (s.end_time && s.end_time < currentTimeStr) {
    return {
      issueFound: true,
      courseCode: s.course_code,
      courseName: s.course_name,
      sessionId: s.id,
      issue: `Attendance session #${s.id} for ${s.course_code} expired at ${s.end_time} (Current time: ${currentTimeStr}).`,
      recommendation: "Extend the session window by 30 minutes.",
      proposedTool: "extend_attendance_session",
      proposedArgs: { session_id: s.id, extend_minutes: 30 },
      proposedDescription: `Extend Session #${s.id} (${s.course_code}) by 30 minutes`,
    };
  }

  return {
    issueFound: false,
    courseCode: s.course_code,
    courseName: s.course_name,
    sessionId: s.id,
    diagnosis: `Session #${s.id} for ${s.course_code} is active and operating normally until ${s.end_time}.`,
  };
}

async function toolDiagnoseSystemIssue(ctx: UserContext) {
  if (ctx.role !== "admin") return { error: "Access Denied: Admin role required." };

  const pendingUsers = await pool.query("SELECT COUNT(*) FROM users WHERE account_status = 'pending_activation'");
  const coursesNoLec = await pool.query("SELECT COUNT(*) FROM courses WHERE lecturer_id IS NULL");
  const unlinkedUsers = await pool.query("SELECT COUNT(*) FROM users WHERE linked_id IS NULL AND role != 'admin'");
  const expiredToday = await pool.query("SELECT COUNT(*) FROM sessions WHERE session_date = CURRENT_DATE AND is_active = FALSE");

  return {
    systemHealth: "Operational",
    pendingActivations: Number(pendingUsers.rows[0].count),
    unassignedCourses: Number(coursesNoLec.rows[0].count),
    unlinkedProfiles: Number(unlinkedUsers.rows[0].count),
    closedSessionsToday: Number(expiredToday.rows[0].count),
  };
}

export interface ToolMeta {
  name: string;
  description: string;
  allowedRoles: Array<"admin" | "lecturer" | "student">;
  readOnly: boolean;
  sideEffect: boolean;
  confirmationRequired: boolean;
  execute: (ctx: UserContext, args: Record<string, any>) => Promise<any>;
}

export const AVAILABLE_TOOLS: Record<string, ToolMeta> = {
  get_my_profile: {
    name: "get_my_profile",
    description: "Fetch current authenticated user profile details",
    allowedRoles: ["student", "lecturer", "admin"],
    readOnly: true,
    sideEffect: false,
    confirmationRequired: false,
    execute: async (ctx) => toolGetMyProfile(ctx),
  },
  get_my_courses: {
    name: "get_my_courses",
    description: "Fetch courses linked to the authenticated user",
    allowedRoles: ["student", "lecturer", "admin"],
    readOnly: true,
    sideEffect: false,
    confirmationRequired: false,
    execute: async (ctx) => toolGetMyCourses(ctx),
  },
  get_my_attendance: {
    name: "get_my_attendance",
    description: "Fetch personal student attendance records and percentage",
    allowedRoles: ["student"],
    readOnly: true,
    sideEffect: false,
    confirmationRequired: false,
    execute: async (ctx) => toolGetMyAttendance(ctx),
  },
  get_my_schedule: {
    name: "get_my_schedule",
    description: "Fetch upcoming class and lecture schedule",
    allowedRoles: ["student", "lecturer", "admin"],
    readOnly: true,
    sideEffect: false,
    confirmationRequired: false,
    execute: async (ctx) => toolGetMySchedule(ctx),
  },
  get_course_attendance: {
    name: "get_course_attendance",
    description: "Fetch course-wide attendance summary for authorized course",
    allowedRoles: ["lecturer", "admin"],
    readOnly: true,
    sideEffect: false,
    confirmationRequired: false,
    execute: async (ctx, args) => toolGetCourseAttendance(ctx, Number(args.course_id || 0)),
  },
  get_course_students: {
    name: "get_course_students",
    description: "Fetch student roster for authorized course",
    allowedRoles: ["lecturer", "admin"],
    readOnly: true,
    sideEffect: false,
    confirmationRequired: false,
    execute: async (ctx, args) => toolGetCourseStudents(ctx, Number(args.course_id || 0)),
  },
  get_institution_attendance_summary: {
    name: "get_institution_attendance_summary",
    description: "Fetch institution-wide metrics and stats for administrators",
    allowedRoles: ["admin"],
    readOnly: true,
    sideEffect: false,
    confirmationRequired: false,
    execute: async (ctx) => toolGetInstitutionSummary(ctx),
  },
  get_students: {
    name: "get_students",
    description: "Fetch student directory for administrators",
    allowedRoles: ["admin"],
    readOnly: true,
    sideEffect: false,
    confirmationRequired: false,
    execute: async (ctx) => toolGetStudents(ctx),
  },
  get_lecturers: {
    name: "get_lecturers",
    description: "Fetch lecturer directory for administrators",
    allowedRoles: ["admin"],
    readOnly: true,
    sideEffect: false,
    confirmationRequired: false,
    execute: async (ctx) => toolGetLecturers(ctx),
  },
  create_attendance_session: {
    name: "create_attendance_session",
    description: "Create a new lecture attendance session",
    allowedRoles: ["lecturer", "admin"],
    readOnly: false,
    sideEffect: true,
    confirmationRequired: true,
    execute: async (ctx, args) => toolCreateAttendanceSession(ctx, args),
  },
  close_attendance_session: {
    name: "close_attendance_session",
    description: "Close an active attendance session",
    allowedRoles: ["lecturer", "admin"],
    readOnly: false,
    sideEffect: true,
    confirmationRequired: true,
    execute: async (ctx, args) => toolCloseAttendanceSession(ctx, args),
  },
  reopen_attendance_session: {
    name: "reopen_attendance_session",
    description: "Reopen a closed attendance session",
    allowedRoles: ["lecturer", "admin"],
    readOnly: false,
    sideEffect: true,
    confirmationRequired: true,
    execute: async (ctx, args) => toolReopenAttendanceSession(ctx, args),
  },
  extend_attendance_session: {
    name: "extend_attendance_session",
    description: "Extend duration of an attendance session",
    allowedRoles: ["lecturer", "admin"],
    readOnly: false,
    sideEffect: true,
    confirmationRequired: true,
    execute: async (ctx, args) => toolExtendAttendanceSession(ctx, args),
  },
  diagnose_session_issue: {
    name: "diagnose_session_issue",
    description: "Diagnose session status or scan acceptance issues",
    allowedRoles: ["lecturer", "admin"],
    readOnly: true,
    sideEffect: false,
    confirmationRequired: false,
    execute: async (ctx, args) => toolDiagnoseSessionIssue(ctx, args),
  },
  diagnose_system_issue: {
    name: "diagnose_system_issue",
    description: "Diagnose overall system health and pending activations",
    allowedRoles: ["admin"],
    readOnly: true,
    sideEffect: false,
    confirmationRequired: false,
    execute: async (ctx) => toolDiagnoseSystemIssue(ctx),
  },
  create_course: {
    name: "create_course",
    description: "Create a new course entry in the system",
    allowedRoles: ["admin"],
    readOnly: false,
    sideEffect: true,
    confirmationRequired: true,
    execute: async (ctx, args) => toolCreateCourse(ctx, args),
  },
};

async function executeTool(name: string, args: Record<string, any>, ctx: UserContext) {
  const tool = AVAILABLE_TOOLS[name];
  if (!tool) {
    return { error: `Unknown tool '${name}'` };
  }
  if (!tool.allowedRoles.includes(ctx.role)) {
    return { error: `Access Denied: Tool '${name}' is not authorized for your role (${ctx.role.toUpperCase()}).` };
  }
  return await tool.execute(ctx, args);
}

/* ------------------------------------------------------------------ */
/*  Main Chat Message Handler                                         */
/* ------------------------------------------------------------------ */

export async function handleChatMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized request." });
      return;
    }

    await ensureChatTableExists();
    const ctx = await getAuthenticatedUser(userId);

    const { message, confirm_action } = req.body as {
      message?: string;
      confirm_action?: { tool: string; args: Record<string, any> };
    };

    // 1. CONFIRMATION EXECUTION WORKFLOW
    if (confirm_action) {
      const toolResult: any = await executeTool(confirm_action.tool, confirm_action.args, ctx);

      let replyText = "";
      if (toolResult.error) {
        replyText = `⚠️ **Action Execution Failed**: ${toolResult.error}`;
      } else if (toolResult.session) {
        replyText = `✓ **Attendance Session Action Executed Successfully!**\n` +
          `- **Session ID**: #${toolResult.session.id}\n` +
          `- **Status**: ${toolResult.session.is_active ? "ACTIVE" : "CLOSED"}\n` +
          `- **Date**: ${toolResult.session.session_date ? String(toolResult.session.session_date).slice(0, 10) : "Today"}\n` +
          `- **Time**: ${toolResult.session.start_time || "N/A"} - ${toolResult.session.end_time || "N/A"}`;
      } else if (toolResult.course) {
        replyText = `✓ **Course Created Successfully!**\n` +
          `- **Course Code**: ${toolResult.course.course_code}\n` +
          `- **Course Name**: ${toolResult.course.course_name}\n` +
          `- **Programme**: ${toolResult.course.programme}`;
      } else if (toolResult.message) {
        replyText = `✓ **Action Completed**: ${toolResult.message}`;
      } else {
        replyText = `✓ **Action Completed Successfully!**`;
      }

      await pool.query(
        "INSERT INTO chat_messages (user_id, role, content, action_required, created_at) VALUES ($1, 'assistant', $2, NULL, NOW())",
        [ctx.userId, replyText]
      );

      res.json({
        reply: replyText,
        timestamp: new Date().toISOString(),
        provider: "NBI-Action-Executor",
      });
      return;
    }

    if (!message || !message.trim()) {
      res.status(400).json({ message: "Message is required." });
      return;
    }

    const userPrompt = message.trim();

    // Fetch conversation context (last 10 messages for this user)
    const historyRows = await pool.query(
      `SELECT role, content FROM chat_messages
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 10`,
      [ctx.userId]
    );

    // Save incoming user message to database
    await pool.query(
      "INSERT INTO chat_messages (user_id, role, content, action_required, created_at) VALUES ($1, 'user', $2, NULL, NOW())",
      [ctx.userId, userPrompt]
    );

    const history = historyRows.rows.reverse();
    const q = userPrompt.toLowerCase();

    // 2. DETECT DIAGNOSIS & MUTATING INTENTS FOR SIDE-EFFECT CONFIRMATIONS
    let pendingAction: { tool: string; args: Record<string, any>; description: string } | null = null;
    let pendingReply = "";

    const isDiagnoseIntent = /\b(diagnose|expired|issue|problem|broken|fix)\b/i.test(userPrompt) || q.includes("accepting scans") || q.includes("can't scan") || q.includes("cant scan") || q.includes("session isn't") || q.includes("why is session") || q.includes("why isn't");
    const isSessionCreateIntent = /\b(create|start|open|new)\b/i.test(userPrompt) && /\bsessions?\b/i.test(userPrompt);
    const isSessionCloseIntent = /\b(close|end|stop|terminate)\b/i.test(userPrompt) && /\bsessions?\b/i.test(userPrompt);
    const isCourseCreateIntent = /\b(create|add|new)\b/i.test(userPrompt) && /\bcourses?\b/i.test(userPrompt);

    if (isDiagnoseIntent && (ctx.role === "lecturer" || ctx.role === "admin")) {
      const diag: any = await toolDiagnoseSessionIssue(ctx, {});
      if (diag.issueFound && diag.proposedTool) {
        pendingAction = {
          tool: diag.proposedTool,
          args: diag.proposedArgs,
          description: diag.proposedDescription,
        };
        pendingReply = `🔍 **Attendance Session Diagnostic Report**:\n\n` +
          `I analyzed your session state for **${diag.courseCode}** (Session #${diag.sessionId}):\n` +
          `- **Identified Issue**: ${diag.issue}\n` +
          `- **Recommended Fix**: ${diag.recommendation}\n\n` +
          `Would you like me to perform this fix now?`;
      } else {
        pendingReply = `🔍 **Attendance Session Diagnostic Report**:\n\n${diag.diagnosis || "All attendance sessions for your assigned courses are running normally."}`;
      }
    } else if (isSessionCreateIntent) {
      if (ctx.role !== "lecturer" && ctx.role !== "admin") {
        pendingReply = "⚠️ Access Denied: Only Lecturers and Administrators can create attendance sessions.";
      } else {
        let targetCourseId = 1;
        if (ctx.role === "lecturer" && ctx.linkedId) {
          const lecCourses = await pool.query("SELECT id FROM courses WHERE lecturer_id = $1 LIMIT 1", [ctx.linkedId]);
          if (lecCourses.rows.length > 0) targetCourseId = lecCourses.rows[0].id;
        }
        pendingAction = {
          tool: "create_attendance_session",
          args: {
            course_id: targetCourseId,
            session_date: new Date().toISOString().slice(0, 10),
            start_time: "09:00",
            end_time: "11:00",
            present_window_minutes: 30,
          },
          description: `Create Attendance Session for Course ID #${targetCourseId} (30 mins)`,
        };
        pendingReply = `I am ready to create an attendance session for Course ID **#${targetCourseId}** today from **09:00 to 11:00** (Present window: 30 minutes).\n\nPlease confirm to proceed.`;
      }
    } else if (isSessionCloseIntent) {
      if (ctx.role !== "lecturer" && ctx.role !== "admin") {
        pendingReply = "⚠️ Access Denied: Only Lecturers and Administrators can close attendance sessions.";
      } else {
        pendingAction = {
          tool: "close_attendance_session",
          args: { session_id: 1 },
          description: "Close Active Attendance Session",
        };
        pendingReply = `I am ready to close the active attendance session. Please confirm to proceed.`;
      }
    } else if (isCourseCreateIntent) {
      if (ctx.role !== "admin") {
        pendingReply = "⚠️ Access Denied: Only Administrators can create courses.";
      } else {
        pendingAction = {
          tool: "create_course",
          args: { course_code: "CSC205", course_name: "Software Engineering Principles", programme: "Computer Science" },
          description: "Create New Course CSC205",
        };
        pendingReply = `I am ready to create a new course **CSC205: Software Engineering Principles** for **Computer Science**.\n\nPlease confirm to proceed.`;
      }
    }

    if (pendingReply && (pendingAction || pendingReply.includes("Access Denied") || pendingReply.includes("Diagnostic Report"))) {
      await pool.query(
        "INSERT INTO chat_messages (user_id, role, content, action_required, created_at) VALUES ($1, 'assistant', $2, $3, NOW())",
        [ctx.userId, pendingReply, pendingAction ? JSON.stringify(pendingAction) : null]
      );
      res.json({
        reply: pendingReply,
        action_required: pendingAction,
        timestamp: new Date().toISOString(),
        provider: "NBI-Agent-Diagnosis-Engine",
      });
      return;
    }

    // 3. READ-ONLY TOOL DISPATCH & FAST ENGINE (With 1000ms AbortController for Gemini)
    const systemPrompt = `You are the NBI AI Assistant, a unified, intelligent, role-aware assistant built for the NBI Smart Attendance System.
The authenticated user is: Name: "${ctx.name}", Email: "${ctx.email}", Role: "${ctx.role.toUpperCase()}", Linked ID: ${ctx.linkedId}.

CRITICAL SECURITY & BEHAVIORAL RULES:
1. Identify yourself as the NBI AI Assistant. Understand your role-aware capabilities:
   - ADMIN: Help monitor institution-wide attendance, courses, lecturers, student rosters, and attendance trends.
   - LECTURER: Help review assigned courses, class timetables, student check-ins, and course reports.
   - STUDENT: Help check personal attendance percentage, class timetable, and enrolled courses.
2. For greetings or general inquiries, respond warmly according to the user's role without unprompted error messages.
3. For specific data queries, call backend tools to retrieve exact database metrics.
4. Server-side authorization rules will evaluate tool requests. If a tool returns an "Access Denied" error message, respect the restriction strictly.
5. Respond in clean, readable Markdown with bullet points or bold titles.`;

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    let finalReply = "";
    let provider = "NBI-Role-Tool-Engine";

    if (apiKey) {
      const contents: any[] = [];
      for (const msg of history) {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
      contents.push({
        role: "user",
        parts: [{ text: `${systemPrompt}\n\nUser Question: ${userPrompt}` }],
      });

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);

        const initialRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (initialRes.ok) {
          const data = (await initialRes.json()) as any;
          const directText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (directText) {
            finalReply = directText;
            provider = "Google-Gemini";
          }
        }
      } catch (netErr) {
        console.warn("External Gemini API call timed out or failed, utilizing native NBI Tool Engine:", netErr);
      }
    }

    // Fast Native NBI Tool Engine Fallback (~15ms execution)
    if (!finalReply) {
      const isGreeting = q === "hi" || q === "hello" || q === "hey" || q.startsWith("hi ") || q.startsWith("hello ") || q.includes("what can you do") || q.includes("help");

      if (isGreeting) {
        if (ctx.role === "admin") {
          finalReply = `Hello **${ctx.name}**!\n\n` +
            `Welcome to the NBI AI Assistant. I am here to help you manage and monitor institution-wide attendance operations.\n\n` +
            `I can assist you with:\n` +
            `- 📊 **Institution Attendance**: Overall attendance rates and session metrics\n` +
            `- 📚 **Courses**: Course listings and assigned lecturers\n` +
            `- 👨‍🏫 **Lecturers**: Faculty directory and course assignments\n` +
            `- 🎓 **Students**: Enrolled student rosters and account statuses\n` +
            `- 📈 **Attendance Reports & Trends**: Institution-wide attendance analytics\n\n` +
            `How can I help you today?`;
        } else if (ctx.role === "lecturer") {
          finalReply = `Hello **${ctx.name}**!\n\n` +
            `Welcome to the NBI AI Assistant. I can help you manage your courses and track student attendance.\n\n` +
            `You can ask me about:\n` +
            `- 📚 **My Courses**: Assigned courses and enrolled students\n` +
            `- ⏰ **Lectures & Schedule**: Session timetables and active QR windows\n` +
            `- 👥 **Class Attendance**: Student attendance history for your courses\n\n` +
            `How can I assist you today?`;
        } else {
          finalReply = `Hello **${ctx.name}**!\n\n` +
            `Welcome to the NBI AI Assistant. I can help you keep track of your classes and attendance record.\n\n` +
            `You can ask me about:\n` +
            `- 📊 **My Attendance**: Overall attendance rate and check-in summary\n` +
            `- 📅 **Class Timetable**: Upcoming lectures and session schedules\n` +
            `- 📝 **My Courses**: Enrolled courses and lecturer details\n\n` +
            `How can I help you today?`;
        }
      } else if (q.includes("lowest") || q.includes("worst") || q.includes("lowest attendance")) {
        if (ctx.role === "student" && ctx.linkedId) {
          const lowestRes = await pool.query(
            `SELECT c.course_code, c.course_name,
                    COUNT(*) FILTER (WHERE a.status = 'present') as present,
                    COUNT(*) FILTER (WHERE a.status = 'late') as late,
                    COUNT(*) FILTER (WHERE a.status = 'absent') as absent,
                    COUNT(*) as total
             FROM attendance a
             JOIN sessions s ON a.session_id = s.id
             JOIN courses c ON s.course_id = c.id
             WHERE a.student_id = $1
             GROUP BY c.course_code, c.course_name
             ORDER BY (COUNT(*) FILTER (WHERE a.status = 'present' OR a.status = 'late')::float / NULLIF(COUNT(*), 0)) ASC
             LIMIT 1`,
            [ctx.linkedId]
          );

          if (lowestRes.rows.length > 0) {
            const row = lowestRes.rows[0];
            const total = Number(row.total || 0);
            const attended = Number(row.present || 0) + Number(row.late || 0);
            const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
            finalReply = `Your lowest course attendance is **${row.course_code} - ${row.course_name}** at **${pct}%** (${attended}/${total} sessions attended).`;
          } else {
            finalReply = `You currently have no course attendance records recorded.`;
          }
        } else if (ctx.role === "lecturer" && ctx.linkedId) {
          finalReply = `To view lowest student attendance for a course, specify the course code or ID (e.g., "Show attendance for CS101").`;
        } else {
          finalReply = `As an Administrator, you can view course reports or low attendance alerts from the Reports & Insights dashboard.`;
        }
      } else {
        let toolData: any = {};
        if (q.includes("profile") || q.includes("who am i") || q.includes("my account")) {
          toolData = await executeTool("get_my_profile", {}, ctx);
        } else if (q.includes("class") || q.includes("timetable") || q.includes("schedule") || q.includes("next")) {
          toolData = await executeTool("get_my_schedule", {}, ctx);
        } else if (ctx.role === "lecturer" && q.includes("attendance") && (q.includes("course") || q.includes("csc") || q.includes("cs"))) {
          let targetCourseId = 1;
          if (ctx.linkedId) {
            const cRes = await pool.query("SELECT id FROM courses WHERE lecturer_id = $1 LIMIT 1", [ctx.linkedId]);
            if (cRes.rows.length > 0) targetCourseId = cRes.rows[0].id;
          }
          toolData = await executeTool("get_course_attendance", { course_id: targetCourseId }, ctx);
        } else if (q.includes("course") || q.includes("subject")) {
          toolData = await executeTool("get_my_courses", {}, ctx);
        } else if (q.includes("summary") || q.includes("institute") || q.includes("total students") || q.includes("overview") || q.includes("metric") || q.includes("trend")) {
          if (ctx.role === "admin") {
            toolData = await executeTool("get_institution_attendance_summary", {}, ctx);
          } else {
            toolData = await executeTool("get_my_attendance", {}, ctx);
          }
        } else {
          if (ctx.role === "admin") {
            toolData = await executeTool("get_institution_attendance_summary", {}, ctx);
          } else if (ctx.role === "lecturer") {
            toolData = await executeTool("get_my_courses", {}, ctx);
          } else {
            toolData = await executeTool("get_my_attendance", {}, ctx);
          }
        }

        finalReply = `Hello **${ctx.name}** (${ctx.role.toUpperCase()})!\n\n`;
        if (toolData.error) {
          finalReply += `⚠️ **Notice**: ${toolData.error}\n\nHow else can I assist with your attendance system tasks?`;
        } else if (toolData.attendanceRate) {
          finalReply += `Here is your current attendance summary:\n` +
                   `- **Attendance Rate**: ${toolData.attendanceRate}\n` +
                   `- **Present**: ${toolData.summary.present} sessions\n` +
                   `- **Late**: ${toolData.summary.late} sessions\n` +
                   `- **Absent**: ${toolData.summary.absent} sessions\n` +
                   `- **Total Sessions**: ${toolData.summary.total}`;
        } else if (toolData.courses) {
          finalReply += `You have **${toolData.courses.length} courses** in the system:\n` +
                   toolData.courses.map((c: any) => `- **${c.code}**: ${c.title}`).join("\n");
        } else if (toolData.schedule) {
          if (toolData.schedule.length === 0) {
            finalReply += `You have no upcoming sessions scheduled at this time.`;
          } else {
            finalReply += `Your upcoming schedule:\n` +
                     toolData.schedule.map((s: any) => `- **${s.code} - ${s.title}**: ${s.session_date.toString().slice(0, 10)} (${s.start_time} - ${s.end_time})`).join("\n");
          }
        } else if (toolData.institutionSummary) {
          const s = toolData.institutionSummary;
          finalReply += `**NBI Institute Overview**:\n` +
                   `- **Registered Students**: ${s.total_students}\n` +
                   `- **Lecturers**: ${s.total_lecturers}\n` +
                   `- **Courses**: ${s.total_courses}\n` +
                   `- **Sessions Recorded**: ${s.total_sessions}\n` +
                   `- **Accounts Pending Activation**: ${s.pending_activations}`;
        } else {
          finalReply += `I am your NBI AI Assistant. You can ask me about your schedule, attendance, assigned courses, or overall system metrics.`;
        }
      }
    }

    // Save generated assistant response to database
    await pool.query(
      "INSERT INTO chat_messages (user_id, role, content, action_required, created_at) VALUES ($1, 'assistant', $2, NULL, NOW())",
      [ctx.userId, finalReply]
    );

    res.json({
      reply: finalReply,
      timestamp: new Date().toISOString(),
      provider,
    });

  } catch (error: any) {
    console.error("Chat Error:", error);
    res.status(500).json({ message: "Unable to process message right now. Please try again." });
  }
}
