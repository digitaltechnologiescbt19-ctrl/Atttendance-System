"use strict";
/**
 * NBI Smart Attendance — Lecturer Controller
 *
 * All handlers here enforce lecturer-scoped data ownership.
 *
 * OWNERSHIP RULE:
 *   authenticated user → users.linked_id → lecturers.id
 *   Every query verifies the resource belongs to that lecturer
 *   through the chain: courses.lecturer_id → sessions.course_id
 *
 * Return codes:
 *   401 — unauthenticated / missing or invalid token  (handled by middleware)
 *   403 — authenticated but not the owner of the resource
 *   404 — resource does not exist
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLecturerCourses = getLecturerCourses;
exports.getLecturerSessions = getLecturerSessions;
exports.getLecturerDashboard = getLecturerDashboard;
exports.createSessionWithOwnershipCheck = createSessionWithOwnershipCheck;
exports.generateQrWithOwnershipCheck = generateQrWithOwnershipCheck;
exports.closeSessionWithOwnershipCheck = closeSessionWithOwnershipCheck;
exports.getSessionRecordsWithOwnershipCheck = getSessionRecordsWithOwnershipCheck;
exports.getLecturerCourseReport = getLecturerCourseReport;
exports.getLecturerStudentHistory = getLecturerStudentHistory;
exports.getLecturerInsights = getLecturerInsights;
const qrcode_1 = __importDefault(require("qrcode"));
const crypto_1 = require("crypto");
const db_1 = __importDefault(require("../database/db"));
/* ------------------------------------------------------------------ */
/*  Internal helper — resolve and verify lecturer identity             */
/*                                                                      */
/*  Reads req.userId (set by authenticate middleware) and looks up     */
/*  users.linked_id.  Returns the lecturers.id value if:               */
/*    - the users row exists                                            */
/*    - the user's role is 'lecturer'                                  */
/*    - linked_id is not null                                           */
/*    - a matching row exists in the lecturers table                    */
/*  Returns null otherwise so the caller can respond with 403.         */
/* ------------------------------------------------------------------ */
async function resolveAuthLecturerId(req) {
    const userId = req.userId;
    const userRole = req.userRole;
    if (!userId || userRole !== "lecturer")
        return null;
    const userRow = await db_1.default.query("SELECT linked_id FROM users WHERE id = $1 AND is_active = TRUE", [userId]);
    if (userRow.rows.length === 0)
        return null;
    const linked = userRow.rows[0].linked_id;
    if (!linked)
        return null;
    // Confirm the lecturers row actually exists
    const lecRow = await db_1.default.query("SELECT id FROM lecturers WHERE id = $1", [linked]);
    if (lecRow.rows.length === 0)
        return null;
    return linked;
}
/* ------------------------------------------------------------------ */
/*  Internal helper — verify a session belongs to the given lecturer  */
/*                                                                      */
/*  Returns the session row if ownership is confirmed, null otherwise. */
/* ------------------------------------------------------------------ */
async function verifySessionOwnership(sessionId, lecturerId) {
    const result = await db_1.default.query(`SELECT s.*
         FROM sessions s
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = $1 AND c.lecturer_id = $2`, [sessionId, lecturerId]);
    return result.rows.length > 0 ? result.rows[0] : null;
}
/* ------------------------------------------------------------------ */
/*  GET /api/attendance/lecturers/:lecturerId/courses                  */
/*                                                                      */
/*  Returns only courses assigned to the authenticated lecturer.       */
/*  Verifies that :lecturerId matches authenticated user's linked_id.  */
/* ------------------------------------------------------------------ */
async function getLecturerCourses(req, res) {
    try {
        const authLecturerId = await resolveAuthLecturerId(req);
        if (!authLecturerId) {
            res.status(403).json({ message: "Access denied. Not a valid lecturer account." });
            return;
        }
        const requestedId = parseInt(String(req.params.lecturerId), 10);
        if (isNaN(requestedId) || requestedId !== authLecturerId) {
            res.status(403).json({ message: "Access denied. You can only access your own courses." });
            return;
        }
        const result = await db_1.default.query(`SELECT
                c.id,
                c.course_code,
                c.course_name,
                c.programme,
                c.created_at,
                l.id              AS lecturer_id,
                l.full_name       AS lecturer_name,
                l.lecturer_number,
                l.department,
                COUNT(DISTINCT sc.student_id)::int AS enrolled_students,
                COUNT(DISTINCT s.id)::int          AS total_sessions
             FROM courses c
             LEFT JOIN lecturers    l  ON c.lecturer_id  = l.id
             LEFT JOIN student_courses sc ON sc.course_id = c.id
             LEFT JOIN sessions     s  ON s.course_id    = c.id
             WHERE c.lecturer_id = $1
             GROUP BY c.id, c.course_code, c.course_name, c.programme,
                      c.created_at, l.id, l.full_name, l.lecturer_number, l.department
             ORDER BY c.course_code ASC`, [authLecturerId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error("getLecturerCourses error:", error);
        res.status(500).json({ message: "Failed to retrieve courses." });
    }
}
/* ------------------------------------------------------------------ */
/*  GET /api/attendance/lecturers/:lecturerId/sessions                 */
/*                                                                      */
/*  Returns only sessions for courses assigned to the authenticated    */
/*  lecturer.  Ownership verified through:                             */
/*    lecturers.id → courses.lecturer_id → sessions.course_id         */
/* ------------------------------------------------------------------ */
async function getLecturerSessions(req, res) {
    try {
        const authLecturerId = await resolveAuthLecturerId(req);
        if (!authLecturerId) {
            res.status(403).json({ message: "Access denied. Not a valid lecturer account." });
            return;
        }
        const requestedId = parseInt(String(req.params.lecturerId), 10);
        if (isNaN(requestedId) || requestedId !== authLecturerId) {
            res.status(403).json({ message: "Access denied. You can only access your own sessions." });
            return;
        }
        const result = await db_1.default.query(`SELECT
                s.id,
                s.course_id,
                s.session_date,
                s.start_time,
                s.end_time,
                s.is_active,
                s.qr_generated_at,
                s.present_window_minutes,
                s.created_at,
                c.course_code,
                c.course_name,
                c.programme,
                COUNT(a.id)::int                                           AS total_checkins,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END)::int     AS present_count,
                COUNT(CASE WHEN a.status = 'late'    THEN 1 END)::int     AS late_count
             FROM sessions s
             JOIN courses c ON s.course_id = c.id
             LEFT JOIN attendance a ON a.session_id = s.id
             WHERE c.lecturer_id = $1
             GROUP BY s.id, s.course_id, s.session_date, s.start_time,
                      s.end_time, s.is_active, s.qr_generated_at,
                      s.present_window_minutes, s.created_at,
                      c.course_code, c.course_name, c.programme
             ORDER BY s.session_date DESC, s.start_time DESC`, [authLecturerId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error("getLecturerSessions error:", error);
        res.status(500).json({ message: "Failed to retrieve sessions." });
    }
}
/* ------------------------------------------------------------------ */
/*  GET /api/attendance/lecturers/:lecturerId/dashboard                */
/*                                                                      */
/*  Returns real, lecturer-scoped dashboard statistics.                */
/* ------------------------------------------------------------------ */
async function getLecturerDashboard(req, res) {
    try {
        const authLecturerId = await resolveAuthLecturerId(req);
        if (!authLecturerId) {
            res.status(403).json({ message: "Access denied. Not a valid lecturer account." });
            return;
        }
        const requestedId = parseInt(String(req.params.lecturerId), 10);
        if (isNaN(requestedId) || requestedId !== authLecturerId) {
            res.status(403).json({ message: "Access denied. You can only access your own dashboard." });
            return;
        }
        // 1. Sessions today
        const todaySessionsResult = await db_1.default.query(`SELECT COUNT(*)::int AS sessions_today
             FROM sessions s
             JOIN courses c ON s.course_id = c.id
             WHERE c.lecturer_id = $1
               AND s.session_date = CURRENT_DATE`, [authLecturerId]);
        // 2. Students present today (attendance records in today's sessions)
        const presentTodayResult = await db_1.default.query(`SELECT COUNT(a.id)::int AS students_present_today
             FROM attendance a
             JOIN sessions s ON a.session_id = s.id
             JOIN courses c ON s.course_id = c.id
             WHERE c.lecturer_id = $1
               AND s.session_date = CURRENT_DATE
               AND a.status IN ('present', 'late')`, [authLecturerId]);
        // 3. Average attendance rate across all this lecturer's sessions
        const avgRateResult = await db_1.default.query(`SELECT
                ROUND(
                    COALESCE(
                        (COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric
                         / NULLIF(COUNT(a.id)::numeric, 0)) * 100,
                        0
                    ), 1
                ) AS average_attendance_rate,
                COUNT(a.id)::int AS total_records
             FROM attendance a
             JOIN sessions s ON a.session_id = s.id
             JOIN courses c ON s.course_id = c.id
             WHERE c.lecturer_id = $1`, [authLecturerId]);
        // 4. Today's/upcoming sessions with details
        const upcomingResult = await db_1.default.query(`SELECT
                s.id, s.session_date, s.start_time, s.end_time,
                s.is_active, s.qr_generated_at, s.present_window_minutes,
                c.course_code, c.course_name,
                COUNT(a.id)::int AS total_checkins
             FROM sessions s
             JOIN courses c ON s.course_id = c.id
             LEFT JOIN attendance a ON a.session_id = s.id
             WHERE c.lecturer_id = $1
               AND s.session_date >= CURRENT_DATE
             GROUP BY s.id, s.session_date, s.start_time, s.end_time,
                      s.is_active, s.qr_generated_at, s.present_window_minutes,
                      c.course_code, c.course_name
             ORDER BY s.session_date ASC, s.start_time ASC
             LIMIT 10`, [authLecturerId]);
        // 5. Recent check-ins across all this lecturer's sessions
        const recentCheckinsResult = await db_1.default.query(`SELECT
                a.id, a.status, a.check_in_time,
                st.full_name AS student_name,
                st.student_number,
                c.course_code, c.course_name,
                s.session_date
             FROM attendance a
             JOIN sessions s ON a.session_id = s.id
             JOIN courses c ON s.course_id = c.id
             JOIN students st ON a.student_id = st.id
             WHERE c.lecturer_id = $1
             ORDER BY a.check_in_time DESC
             LIMIT 20`, [authLecturerId]);
        // 6. Total courses assigned
        const courseCountResult = await db_1.default.query(`SELECT COUNT(*)::int AS total_courses FROM courses WHERE lecturer_id = $1`, [authLecturerId]);
        res.json({
            sessions_today: todaySessionsResult.rows[0].sessions_today,
            students_present_today: presentTodayResult.rows[0].students_present_today,
            average_attendance_rate: parseFloat(avgRateResult.rows[0].average_attendance_rate || "0"),
            total_records: avgRateResult.rows[0].total_records,
            total_courses: courseCountResult.rows[0].total_courses,
            upcoming_sessions: upcomingResult.rows,
            recent_checkins: recentCheckinsResult.rows,
        });
    }
    catch (error) {
        console.error("getLecturerDashboard error:", error);
        res.status(500).json({ message: "Failed to retrieve dashboard data." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/attendance/sessions  (ownership-enforced override)       */
/*                                                                      */
/*  Admins: can create a session for any course (existing behaviour).  */
/*  Lecturers: may only create a session for their own assigned course.*/
/* ------------------------------------------------------------------ */
async function createSessionWithOwnershipCheck(req, res) {
    try {
        const { course_id, session_date, start_time, end_time, present_window_minutes } = req.body;
        if (!course_id || !session_date || !start_time || !end_time) {
            res.status(400).json({
                message: "course_id, session_date, start_time and end_time are required"
            });
            return;
        }
        const userRole = req.userRole;
        if (userRole === "lecturer") {
            // Verify the requesting lecturer owns this course
            const authLecturerId = await resolveAuthLecturerId(req);
            if (!authLecturerId) {
                res.status(403).json({ message: "Access denied. Not a valid lecturer account." });
                return;
            }
            const courseCheck = await db_1.default.query("SELECT id, lecturer_id FROM courses WHERE id = $1", [course_id]);
            if (courseCheck.rows.length === 0) {
                res.status(404).json({ message: "Course not found." });
                return;
            }
            if (courseCheck.rows[0].lecturer_id !== authLecturerId) {
                res.status(403).json({
                    message: "Access denied. You can only create sessions for your own courses."
                });
                return;
            }
        }
        const presentWindow = Number(present_window_minutes ?? 10);
        if (!Number.isInteger(presentWindow) || presentWindow < 1 || presentWindow > 60) {
            res.status(400).json({ message: "present_window_minutes must be a whole number between 1 and 60" });
            return;
        }
        // Ownership check passed (or user is admin) — create the session
        const result = await db_1.default.query(`INSERT INTO sessions
             (course_id, session_date, start_time, end_time, qr_token, is_active, qr_generated_at, present_window_minutes)
             VALUES ($1, $2, $3, $4, $5, true, NULL, $6)
             RETURNING *`, [course_id, session_date, start_time, end_time, (0, crypto_1.randomUUID)(), presentWindow]);
        const session = result.rows[0];
        res.status(201).json({
            message: "Attendance session created successfully",
            session: {
                id: session.id,
                course_id: session.course_id,
                session_date: session.session_date,
                start_time: session.start_time,
                end_time: session.end_time,
                is_active: session.is_active,
                qr_generated_at: session.qr_generated_at,
                present_window_minutes: session.present_window_minutes,
            }
        });
    }
    catch (error) {
        console.error("createSessionWithOwnershipCheck error:", error);
        res.status(500).json({ message: "Failed to create attendance session." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/attendance/sessions/:id/generate-qr  (ownership-enforced)*/
/* ------------------------------------------------------------------ */
async function generateQrWithOwnershipCheck(req, res) {
    try {
        const sessionId = parseInt(String(req.params.id), 10);
        const userRole = req.userRole;
        if (isNaN(sessionId)) {
            res.status(400).json({ message: "Invalid session ID." });
            return;
        }
        // Fetch the session (needed for active check regardless of role)
        const sessionResult = await db_1.default.query("SELECT s.*, c.lecturer_id FROM sessions s JOIN courses c ON s.course_id = c.id WHERE s.id = $1", [sessionId]);
        if (sessionResult.rows.length === 0) {
            res.status(404).json({ message: "Attendance session not found." });
            return;
        }
        const session = sessionResult.rows[0];
        if (userRole === "lecturer") {
            const authLecturerId = await resolveAuthLecturerId(req);
            if (!authLecturerId) {
                res.status(403).json({ message: "Access denied. Not a valid lecturer account." });
                return;
            }
            if (session.lecturer_id !== authLecturerId) {
                res.status(403).json({
                    message: "Access denied. You can only generate QR codes for your own sessions."
                });
                return;
            }
        }
        if (!session.is_active) {
            res.status(400).json({ message: "This attendance session is closed." });
            return;
        }
        const qrToken = (0, crypto_1.randomUUID)();
        const updateResult = await db_1.default.query(`UPDATE sessions
             SET qr_token = $1, qr_generated_at = CURRENT_TIMESTAMP, present_window_minutes = 10
             WHERE id = $2
             RETURNING *`, [qrToken, sessionId]);
        const updated = updateResult.rows[0];
        const qrCode = await qrcode_1.default.toDataURL(qrToken);
        res.json({
            message: "Attendance QR generated successfully",
            session: {
                id: updated.id,
                course_id: updated.course_id,
                session_date: updated.session_date,
                start_time: updated.start_time,
                end_time: updated.end_time,
                is_active: updated.is_active,
                qr_generated_at: updated.qr_generated_at,
                present_window_minutes: updated.present_window_minutes,
            },
            qr_token: qrToken,
            qr_code: qrCode,
        });
    }
    catch (error) {
        console.error("generateQrWithOwnershipCheck error:", error);
        res.status(500).json({ message: "Failed to generate attendance QR." });
    }
}
/* ------------------------------------------------------------------ */
/*  PATCH /api/attendance/sessions/:id/close  (ownership-enforced)     */
/* ------------------------------------------------------------------ */
async function closeSessionWithOwnershipCheck(req, res) {
    try {
        const sessionId = parseInt(String(req.params.id), 10);
        const userRole = req.userRole;
        if (isNaN(sessionId)) {
            res.status(400).json({ message: "Invalid session ID." });
            return;
        }
        // Fetch the session with course ownership info
        const sessionResult = await db_1.default.query("SELECT s.*, c.lecturer_id FROM sessions s JOIN courses c ON s.course_id = c.id WHERE s.id = $1", [sessionId]);
        if (sessionResult.rows.length === 0) {
            res.status(404).json({ message: "Session not found." });
            return;
        }
        const session = sessionResult.rows[0];
        if (userRole === "lecturer") {
            const authLecturerId = await resolveAuthLecturerId(req);
            if (!authLecturerId) {
                res.status(403).json({ message: "Access denied. Not a valid lecturer account." });
                return;
            }
            if (session.lecturer_id !== authLecturerId) {
                res.status(403).json({
                    message: "Access denied. You can only close your own sessions."
                });
                return;
            }
        }
        if (!session.is_active) {
            res.status(400).json({ message: "Session is already closed." });
            return;
        }
        const result = await db_1.default.query("UPDATE sessions SET is_active = false WHERE id = $1 RETURNING *", [sessionId]);
        res.json({
            message: "Session closed successfully",
            session: result.rows[0],
        });
    }
    catch (error) {
        console.error("closeSessionWithOwnershipCheck error:", error);
        res.status(500).json({ message: "Failed to close session." });
    }
}
/* ------------------------------------------------------------------ */
/*  GET /api/attendance/records/by-session/:sessionId  (ownership)     */
/*                                                                      */
/*  Lecturers: may only retrieve records for their own sessions.       */
/*  Admins: unrestricted (existing behaviour).                         */
/* ------------------------------------------------------------------ */
async function getSessionRecordsWithOwnershipCheck(req, res) {
    try {
        const sessionId = parseInt(String(req.params.sessionId), 10);
        const userRole = req.userRole;
        if (isNaN(sessionId)) {
            res.status(400).json({ message: "Invalid session ID." });
            return;
        }
        if (userRole === "lecturer") {
            const authLecturerId = await resolveAuthLecturerId(req);
            if (!authLecturerId) {
                res.status(403).json({ message: "Access denied. Not a valid lecturer account." });
                return;
            }
            // Verify the session belongs to this lecturer's course
            const owned = await verifySessionOwnership(sessionId, authLecturerId);
            if (!owned) {
                // Could be 404 (doesn't exist) or 403 (exists but not theirs).
                // We check existence separately to give the right code.
                const exists = await db_1.default.query("SELECT id FROM sessions WHERE id = $1", [sessionId]);
                if (exists.rows.length === 0) {
                    res.status(404).json({ message: "Session not found." });
                }
                else {
                    res.status(403).json({
                        message: "Access denied. You can only view records for your own sessions."
                    });
                }
                return;
            }
        }
        const result = await db_1.default.query(`SELECT
                attendance.*,
                students.student_number,
                students.full_name,
                sessions.session_date,
                sessions.start_time,
                courses.course_code,
                courses.course_name
             FROM attendance
             JOIN students  ON attendance.student_id  = students.id
             JOIN sessions  ON attendance.session_id  = sessions.id
             JOIN courses   ON sessions.course_id     = courses.id
             WHERE attendance.session_id = $1
             ORDER BY attendance.check_in_time ASC`, [sessionId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error("getSessionRecordsWithOwnershipCheck error:", error);
        res.status(500).json({ message: "Failed to retrieve session records." });
    }
}
/* ------------------------------------------------------------------ */
/*  Lecturer-owned attendance reporting                                 */
/* ------------------------------------------------------------------ */
async function verifyLecturerCourse(req, courseId) {
    const lecturerId = await resolveAuthLecturerId(req);
    if (!lecturerId)
        return null;
    const result = await db_1.default.query("SELECT id FROM courses WHERE id = $1 AND lecturer_id = $2", [courseId, lecturerId]);
    return result.rows.length > 0 ? lecturerId : null;
}
async function getLecturerCourseReport(req, res) {
    try {
        const courseId = parseInt(String(req.params.courseId), 10);
        if (isNaN(courseId)) {
            res.status(400).json({ message: "Invalid course ID." });
            return;
        }
        const requestedLecturerId = parseInt(String(req.params.lecturerId), 10);
        const lecturerId = await verifyLecturerCourse(req, courseId);
        if (!lecturerId || requestedLecturerId !== lecturerId) {
            res.status(403).json({ message: "Access denied. You can only report on your own courses." });
            return;
        }
        const { start_date, end_date } = req.query;
        const params = [courseId];
        const filters = ["s.course_id = $1"];
        if (start_date) {
            params.push(start_date);
            filters.push(`s.session_date >= $${params.length}`);
        }
        if (end_date) {
            params.push(end_date);
            filters.push(`s.session_date <= $${params.length}`);
        }
        const where = filters.join(" AND ");
        const result = await db_1.default.query(`SELECT st.id AS student_id, st.student_number, st.full_name, st.programme,
                    COUNT(DISTINCT s.id)::int AS total_sessions,
                    COUNT(a.id) FILTER (WHERE a.status = 'present')::int AS present,
                    COUNT(a.id) FILTER (WHERE a.status = 'late')::int AS late,
                    (COUNT(DISTINCT s.id) - COUNT(a.id))::int AS absent
             FROM student_courses sc
             JOIN students st ON st.id = sc.student_id
             JOIN sessions s ON s.course_id = sc.course_id
             LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = st.id
             WHERE ${where}
             GROUP BY st.id, st.student_number, st.full_name, st.programme
             ORDER BY st.full_name`, params);
        res.json(result.rows.map((row) => ({
            ...row,
            attendance_rate: Number((row.total_sessions > 0
                ? ((row.present + row.late) / row.total_sessions) * 100
                : 0).toFixed(1)),
        })));
    }
    catch (error) {
        console.error("getLecturerCourseReport error:", error);
        res.status(500).json({ message: "Failed to retrieve course report." });
    }
}
async function getLecturerStudentHistory(req, res) {
    try {
        const courseId = parseInt(String(req.params.courseId), 10);
        const studentId = parseInt(String(req.params.studentId), 10);
        if (isNaN(courseId) || isNaN(studentId)) {
            res.status(400).json({ message: "Invalid course or student ID." });
            return;
        }
        const requestedLecturerId = parseInt(String(req.params.lecturerId), 10);
        const lecturerId = await verifyLecturerCourse(req, courseId);
        if (!lecturerId || requestedLecturerId !== lecturerId) {
            res.status(403).json({ message: "Access denied. You can only view your own course data." });
            return;
        }
        const enrolled = await db_1.default.query("SELECT 1 FROM student_courses WHERE student_id = $1 AND course_id = $2", [studentId, courseId]);
        if (enrolled.rows.length === 0) {
            res.status(403).json({ message: "Student is not enrolled in this course." });
            return;
        }
        const result = await db_1.default.query(`SELECT s.id AS session_id, s.session_date, s.start_time, s.end_time,
                    COALESCE(a.status, 'absent') AS status, a.check_in_time,
                    st.student_number, st.full_name, c.course_code, c.course_name
             FROM sessions s
             JOIN courses c ON c.id = s.course_id
             JOIN students st ON st.id = $2
             LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = $2
             WHERE s.course_id = $1
             ORDER BY s.session_date DESC, s.start_time DESC`, [courseId, studentId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error("getLecturerStudentHistory error:", error);
        res.status(500).json({ message: "Failed to retrieve student attendance history." });
    }
}
/* ------------------------------------------------------------------ */
/*  GET /api/attendance/lecturers/:lecturerId/insights                 */
/*                                                                      */
/*  Returns lecturer-scoped analytics.  All five queries are           */
/*  filtered to courses.lecturer_id = authLecturerId, derived          */
/*  exclusively from the JWT via resolveAuthLecturerId().              */
/*                                                                      */
/*  Metrics returned:                                                   */
/*   - overall      : aggregate present/late/absent/rate               */
/*   - course_rates : per-course breakdown (own courses only)          */
/*   - low_attendance_students : students < 75% (own sessions only)   */
/*   - recent_trends: last 14 days of daily rates (own sessions only)  */
/*  Note: by_programme is intentionally omitted for lecturers because  */
/*  it is institution-wide data.  course_rates serves the same         */
/*  analytical purpose scoped to the lecturer.                         */
/* ------------------------------------------------------------------ */
async function getLecturerInsights(req, res) {
    try {
        console.log("ENTER getLecturerInsights", { params: req.params });
        // Resolve authenticated lecturer — 403 if mismatch or invalid
        const authLecturerId = await resolveAuthLecturerId(req);
        if (!authLecturerId) {
            res.status(403).json({ message: "Access denied. Not a valid lecturer account." });
            return;
        }
        const requestedId = parseInt(String(req.params.lecturerId), 10);
        if (isNaN(requestedId) || requestedId !== authLecturerId) {
            res.status(403).json({
                message: "Access denied. You can only view insights for your own courses."
            });
            return;
        }
        // ── 1. Overall attendance rate (own courses only) ─────────────
        const overallResult = await db_1.default.query(`SELECT
                COUNT(*)                                                      AS total_records,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END)             AS present_count,
                COUNT(CASE WHEN a.status = 'late'    THEN 1 END)             AS late_count,
                COUNT(CASE WHEN a.status = 'absent'  THEN 1 END)             AS absent_count,
                COALESCE(ROUND(
                    (COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric
                     / NULLIF(COUNT(*)::numeric, 0)) * 100, 2
                ), 0)                                                             AS present_rate,
                COALESCE(ROUND(
                    (COUNT(CASE WHEN a.status = 'late' THEN 1 END)::numeric
                     / NULLIF(COUNT(*)::numeric, 0)) * 100, 2
                ), 0)                                                             AS late_rate
             FROM attendance a
             JOIN sessions s  ON a.session_id  = s.id
             JOIN courses  c  ON s.course_id   = c.id
             WHERE c.lecturer_id = $1`, [authLecturerId]);
        // ── 2. Per-course attendance rates (own courses only) ─────────
        const courseRatesResult = await db_1.default.query(`SELECT
                c.course_code,
                c.course_name,
                c.programme,
                COUNT(*)                                                      AS total_attendance,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END)             AS present_count,
                COUNT(CASE WHEN a.status = 'late'    THEN 1 END)             AS late_count,
                COUNT(CASE WHEN a.status = 'absent'  THEN 1 END)             AS absent_count,
                ROUND(
                    (COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric
                     / NULLIF(COUNT(*)::numeric, 0)) * 100, 2
                )                                                             AS attendance_rate
             FROM courses c
             JOIN sessions   s  ON c.id        = s.course_id
             JOIN attendance a  ON s.id         = a.session_id
             WHERE c.lecturer_id = $1
             GROUP BY c.id, c.course_code, c.course_name, c.programme
             ORDER BY attendance_rate ASC`, [authLecturerId]);
        // ── 3. Low-attendance students (own sessions only, < 75%) ────
        const lowAttendanceResult = await db_1.default.query(`SELECT
                st.id,
                st.student_number,
                st.full_name,
                st.programme,
                COUNT(*)                                                      AS total_sessions_attended,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END)             AS present_count,
                COUNT(CASE WHEN a.status = 'late'    THEN 1 END)             AS late_count,
                COUNT(CASE WHEN a.status = 'absent'  THEN 1 END)             AS absent_count,
                ROUND(
                    (COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric
                     / NULLIF(COUNT(*)::numeric, 0)) * 100, 2
                )                                                             AS attendance_rate,
                c.course_code,
                c.course_name
             FROM students st
             JOIN attendance a  ON st.id        = a.student_id
             JOIN sessions   s  ON a.session_id = s.id
             JOIN courses    c  ON s.course_id  = c.id
             WHERE c.lecturer_id = $1
             GROUP BY st.id, st.student_number, st.full_name, st.programme,
                      c.id, c.course_code, c.course_name
             HAVING COUNT(*) > 0 AND
                    ROUND(
                        (COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric
                         / NULLIF(COUNT(*)::numeric, 0)) * 100, 2
                    ) < 75
             ORDER BY attendance_rate ASC
             LIMIT 10`, [authLecturerId]);
        // ── 4. Recent trends — last 14 days (own sessions only) ──────
        const trendsResult = await db_1.default.query(`SELECT
                s.session_date,
                COUNT(*)                                                      AS total_records,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END)             AS present_count,
                COUNT(CASE WHEN a.status = 'late'    THEN 1 END)             AS late_count,
                ROUND(
                    (COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric
                     / NULLIF(COUNT(*)::numeric, 0)) * 100, 2
                )                                                             AS present_rate
             FROM attendance a
             JOIN sessions s  ON a.session_id = s.id
             JOIN courses  c  ON s.course_id  = c.id
             WHERE c.lecturer_id = $1
               AND s.session_date >= CURRENT_DATE - INTERVAL '14 days'
             GROUP BY s.session_date
             ORDER BY s.session_date DESC`, [authLecturerId]);
        // Ensure overall fields are returned as non-null strings to match frontend expectations
        const rawOverall = overallResult.rows[0] || {};
        const overallSafe = {
            total_records: String(rawOverall.total_records ?? "0"),
            present_count: String(rawOverall.present_count ?? "0"),
            late_count: String(rawOverall.late_count ?? "0"),
            absent_count: String(rawOverall.absent_count ?? "0"),
            present_rate: rawOverall.present_rate !== null && rawOverall.present_rate !== undefined ? String(rawOverall.present_rate) : "0",
            late_rate: rawOverall.late_rate !== null && rawOverall.late_rate !== undefined ? String(rawOverall.late_rate) : "0",
        };
        console.log("DEBUG getLecturerInsights overallSafe:", overallSafe);
        res.json({
            overall: overallSafe,
            course_rates: courseRatesResult.rows,
            low_attendance_students: lowAttendanceResult.rows,
            recent_trends: trendsResult.rows,
            // by_programme deliberately excluded — institution-wide metric
            // not meaningful at lecturer scope
        });
    }
    catch (error) {
        console.error("getLecturerInsights error:", error);
        res.status(500).json({ message: "Failed to retrieve insights." });
    }
}
