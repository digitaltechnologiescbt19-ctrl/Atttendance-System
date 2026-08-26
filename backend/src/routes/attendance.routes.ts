import { Router } from "express";
import { randomUUID } from "crypto";
import QRCode from "qrcode";
import pool from "../database/db";

import {
    createStudent,
    getStudents,
    getStudent,
    updateStudent,
    deleteStudent,
    createLecturer,
    getLecturers,
    getLecturer,
    updateLecturer,
    deleteLecturer,
    createCourse,
    getCourses,
    getCourse,
    updateCourse,
    deleteCourse,
    markAttendance,
    getAttendance,
    getStudentAttendance,
    getStudentTodaysSessions,
    getStudentUpcomingSessions,
    getDashboardSummary,
    getAttendanceReport,
    getAttendanceStats,
    getStudentReport,
    getAttendanceInsights,
    getAdministrators,
    createAdministrator,
    updateAdministratorStatus,
    resetAdministratorPassword,
} from "../controllers/attendance.controller";

import {
    getLecturerCourses,
    getLecturerSessions,
    getLecturerDashboard,
    getLecturerInsights,
    createSessionWithOwnershipCheck,
    generateQrWithOwnershipCheck,
    closeSessionWithOwnershipCheck,
    getSessionRecordsWithOwnershipCheck,
    getLecturerCourseReport,
    getLecturerStudentHistory,
} from "../controllers/lecturer.controller";

import { authenticate, requireRole, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

/*
 * ATTENDANCE API TEST
 * GET /api/attendance
 */
router.get("/", (_req, res) => {
    res.json({
        message: "Attendance API is working"
    });
});


/*
 * =========================
 * DASHBOARD SUMMARY
 * =========================
 */

// Get real dashboard summary statistics
router.get("/dashboard-summary", authenticate, getDashboardSummary);


/*
 * =========================
 * STUDENTS
 * =========================
 */

// Create student (admin only)
router.post("/students",    authenticate, requireRole("admin"), createStudent);

// Get all students (admin only)
router.get("/students",     authenticate, requireRole("admin"), getStudents);

// Get one student (admin or the student themself)
router.get("/students/:id", authenticate, getStudent);

// Update student (admin only)
router.put("/students/:id", authenticate, requireRole("admin"), updateStudent);

// Delete student (admin only)
router.delete("/students/:id", authenticate, requireRole("admin"), deleteStudent);


/*
 * =========================
 * LECTURERS
 * =========================
 */

// Create lecturer
router.post("/lecturers",    authenticate, createLecturer);

// Get all lecturers
router.get("/lecturers",     authenticate, getLecturers);

// Get one lecturer
router.get("/lecturers/:id", authenticate, getLecturer);

// Update lecturer
router.put("/lecturers/:id", authenticate, updateLecturer);

// Delete lecturer
router.delete("/lecturers/:id", authenticate, deleteLecturer);


/*
 * =========================
 * LECTURER-SCOPED ROUTES
 * Requires: authenticated + role === "lecturer"
 * The controller verifies :lecturerId matches the
 * authenticated user's linked_id — frontend cannot spoof it.
 * =========================
 */

// Get courses assigned to the authenticated lecturer
router.get("/lecturers/:lecturerId/courses",   authenticate, requireRole("lecturer"), getLecturerCourses);

// Get sessions for the authenticated lecturer's courses
router.get("/lecturers/:lecturerId/sessions",  authenticate, requireRole("lecturer"), getLecturerSessions);

// Get lecturer-scoped dashboard statistics
router.get("/lecturers/:lecturerId/dashboard", authenticate, requireRole("lecturer"), getLecturerDashboard);

// Get lecturer-scoped insights and analytics
router.get("/lecturers/:lecturerId/insights",  authenticate, requireRole("lecturer"), getLecturerInsights);
router.get("/lecturers/:lecturerId/courses/:courseId/report", authenticate, requireRole("lecturer"), getLecturerCourseReport);
router.get("/lecturers/:lecturerId/courses/:courseId/students/:studentId", authenticate, requireRole("lecturer"), getLecturerStudentHistory);


/*
 * =========================
 * COURSES
 * =========================
 */

// Create course
router.post("/courses",    authenticate, createCourse);

// Get all courses
router.get("/courses",     authenticate, getCourses);

// Get one course
router.get("/courses/:id", authenticate, getCourse);

// Update course
router.put("/courses/:id", authenticate, updateCourse);

// Delete course
router.delete("/courses/:id", authenticate, deleteCourse);


/*
 * =========================
 * ATTENDANCE RECORDS
 * =========================
 */

// Mark attendance
router.post("/mark", authenticate, markAttendance);

// Get all attendance
router.get("/records", authenticate, getAttendance);

// Get attendance for one student
router.get("/students/:studentId/attendance", authenticate, getStudentAttendance);

// Get today's sessions for one student
router.get("/students/:studentId/sessions/today", authenticate, getStudentTodaysSessions);

// Get upcoming sessions for one student
router.get("/students/:studentId/sessions/upcoming", authenticate, getStudentUpcomingSessions);

// Get the authenticated student's report; identity is derived from the JWT.
router.get("/students/me/report", authenticate, getStudentReport);
/*
 * =========================
 * STUDENT COURSE ENROLLMENT
 * =========================
 */

// Enroll a student in a course
// Admins may enroll any student. Students may self-enroll (server derives their own id).
router.post("/enrollments", authenticate, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const role = authReq.userRole;
        let { student_id, course_id } = req.body;

        if (!student_id || !course_id) {
            return res.status(400).json({
                message: "student_id and course_id are required"
            });
        }

        // If the caller is a student, force student_id to the authenticated user's linked_id
        if (role === "student") {
            const userRow = await pool.query(
                "SELECT linked_id FROM users WHERE id = $1 AND is_active = TRUE",
                [authReq.userId]
            );
            if (userRow.rows.length === 0 || !userRow.rows[0].linked_id) {
                return res.status(403).json({ message: "Access denied" });
            }
            student_id = String(userRow.rows[0].linked_id);
        } else if (role !== "admin") {
            // Only admin or student may enroll
            return res.status(403).json({ message: "Access denied" });
        }

        const result = await pool.query(
            `
            INSERT INTO student_courses
            (student_id, course_id)
            VALUES ($1, $2)
            RETURNING *
            `,
            [student_id, course_id]
        );

        res.status(201).json({
            message: "Student enrolled successfully",
            enrollment: result.rows[0]
        });

    } catch (error: any) {
        console.error("Enrollment error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "Student is already enrolled in this course"
            });
        }

        if (error.code === "23503") {
            return res.status(404).json({
                message: "Student or course not found"
            });
        }

        res.status(500).json({
            message: "Failed to enroll student"
        });
    }
});


// Get courses enrolled by a student
// Admin may fetch any student's courses. A student may fetch only their own courses.
router.get("/students/:studentId/courses", authenticate, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const role = authReq.userRole;
        const callerId = authReq.userId;
        const { studentId } = req.params;

        if (role === "student") {
            const userRow = await pool.query(
                "SELECT linked_id FROM users WHERE id = $1 AND is_active = TRUE",
                [callerId]
            );
            if (userRow.rows.length === 0 || String(userRow.rows[0].linked_id) !== String(studentId)) {
                return res.status(403).json({ message: "Access denied" });
            }
        } else if (role !== "admin") {
            // For non-admin, non-student roles (e.g., lecturer) deny here — lecturers should use lecturer-scoped courses
            return res.status(403).json({ message: "Access denied" });
        }

        const result = await pool.query(
            `
            SELECT
                courses.id,
                courses.course_code,
                courses.course_name,
                courses.programme
            FROM student_courses
            JOIN courses
                ON student_courses.course_id = courses.id
            WHERE student_courses.student_id = $1
            ORDER BY courses.course_code ASC
            `,
            [studentId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Get student courses error:", error);

        res.status(500).json({
            message: "Failed to retrieve student courses"
        });
    }
});

/*
 * =========================
 * ATTENDANCE SESSIONS
 * POST /sessions — ownership-checked (lecturers: own courses only)
 * POST /sessions/:id/generate-qr — ownership-checked
 * PATCH /sessions/:id/close — ownership-checked
 * =========================
 */

// Create attendance session (lecturer: own courses only; admin: unrestricted)
router.post("/sessions", authenticate, createSessionWithOwnershipCheck);

// Generate QR (lecturer: own sessions only; admin: unrestricted)
router.post("/sessions/:id/generate-qr", authenticate, generateQrWithOwnershipCheck);

// Get all sessions (institution-wide — admin + lecturer use same endpoint;
// frontend is responsible for showing only relevant sessions via the
// /lecturers/:id/sessions endpoint when role is lecturer)
router.get("/sessions", authenticate, async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                sessions.*,
                courses.course_code,
                courses.course_name
            FROM sessions
            JOIN courses
                ON sessions.course_id = courses.id
            ORDER BY sessions.id DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error("Get sessions error:", error);
        res.status(500).json({ message: "Failed to retrieve sessions" });
    }
});

// Close session (lecturer: own sessions only; admin: unrestricted)
router.patch("/sessions/:id/close", authenticate, closeSessionWithOwnershipCheck);


/*
 * GET ATTENDANCE RECORDS — optional session_id filter
 * GET /api/attendance/records?session_id=<id>
 *
 * Extends the existing getAttendance handler with an optional
 * query parameter so the frontend can fetch records per session.
 * Falls back to returning all records when no session_id is given,
 * preserving backward compatibility.
 */
// Get attendance records for a specific session (ownership-checked for lecturers)
router.get("/records/by-session/:sessionId", authenticate, getSessionRecordsWithOwnershipCheck);


/*
 * =========================
 * REPORTS AND ANALYTICS
 * =========================
 */

// Get attendance report with filters
router.get("/reports/attendance", authenticate, getAttendanceReport);

// Get attendance statistics
router.get("/reports/stats", authenticate, getAttendanceStats);

// Get attendance insights and analytics (institution-wide) — admin only
router.get("/insights", authenticate, requireRole("admin"), getAttendanceInsights);


/*
 * =========================
 * ADMINISTRATOR MANAGEMENT
 * Protected — admin role only
 * =========================
 */

// Get all administrators
router.get("/administrators", authenticate, requireRole("admin"), getAdministrators);

// Create administrator
router.post("/administrators", authenticate, requireRole("admin"), createAdministrator);

// Activate / deactivate an administrator
router.patch("/administrators/:id/status", authenticate, requireRole("admin"), updateAdministratorStatus);

// Reset an administrator's password
router.post("/administrators/:id/reset-password", authenticate, requireRole("admin"), resetAdministratorPassword);


/*
 * =========================
 * SYSTEM SETTINGS
 * Protected — admin role only for writes; any authenticated user for reads
 * =========================
 */

// Get a setting by key
router.get("/settings/:key", authenticate, async (req, res) => {
    try {
        const { key } = req.params;
        const result = await pool.query(
            "SELECT key, value FROM system_settings WHERE key = $1",
            [key]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Setting not found" });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Get setting error:", error);
        res.status(500).json({ message: "Failed to retrieve setting" });
    }
});

// Get all settings
router.get("/settings", authenticate, async (_req, res) => {
    try {
        const result = await pool.query(
            "SELECT key, value FROM system_settings ORDER BY key"
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Get settings error:", error);
        res.status(500).json({ message: "Failed to retrieve settings" });
    }
});

// Update a setting (admin only)
router.put("/settings/:key", authenticate, requireRole("admin"), async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;

        if (value === undefined || value === null) {
            return res.status(400).json({ message: "value is required" });
        }

        const userId = (req as any).userId;

        const result = await pool.query(
            `INSERT INTO system_settings (key, value, updated_by, updated_at)
             VALUES ($1, $2::jsonb, $3, NOW())
             ON CONFLICT (key) DO UPDATE
             SET value = $2::jsonb, updated_by = $3, updated_at = NOW()
             RETURNING key, value`,
            [key, JSON.stringify(value), userId]
        );

        res.json({
            message: "Setting saved successfully",
            setting: result.rows[0]
        });
    } catch (error) {
        console.error("Update setting error:", error);
        res.status(500).json({ message: "Failed to save setting" });
    }
});


export default router;