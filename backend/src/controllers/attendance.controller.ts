import { Request, Response } from "express";
import pool from "../database/db";
import bcryptLib from "bcryptjs";
import { sendTempPasswordEmail, sendActivationOtpEmail } from "../services/email.service";


// CREATE STUDENT
export const createStudent = async (req: Request, res: Response) => {
    try {
        // Only admins may create students
        const callerRole = (req as any).userRole as string | undefined;
        if (callerRole !== "admin") {
            return res.status(403).json({ message: "Access denied" });
        }
        const {
            student_number,
            full_name,
            email,
            programme
        } = req.body;

        if (!student_number || !full_name || !email || !programme) {
            return res.status(400).json({
                message: "All student fields are required"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Enforce email uniqueness across both tables
        const emailCheck = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [normalizedEmail]
        );
        if (emailCheck.rows.length > 0) {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        // Begin transaction: insert into students + users atomically
        const client = await pool.connect();
        let student;
        let newUser;
        try {
            await client.query("BEGIN");

            // 1. Insert into students domain table
            const studentResult = await client.query(
                `INSERT INTO students (student_number, full_name, email, programme)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [student_number, full_name, normalizedEmail, programme]
            );
            student = studentResult.rows[0];

            // 2. Create users entry in pending_activation state (NO password)
            const userResult = await client.query(
                `INSERT INTO users
                 (email, name, role, linked_id,
                  is_verified, is_active, account_status, password_hash, temp_password_used)
                 VALUES ($1, $2, 'student', $3,
                         FALSE, TRUE, 'pending_activation', NULL, FALSE)
                 RETURNING id, email, name, role, linked_id, account_status`,
                [normalizedEmail, full_name, student.id]
            );
            newUser = userResult.rows[0];

            await client.query("COMMIT");
        } catch (txErr) {
            await client.query("ROLLBACK");
            throw txErr;
        } finally {
            client.release();
        }

        res.status(201).json({
            message: "Student registered successfully. They can now activate their account using their email address.",
            student: {
                ...student,
                account_status: newUser.account_status,
                user_id:        newUser.id,
            }
        });

    } catch (error: any) {
        console.error("Create student error:", error);
        if (error.code === "23505") {
            return res.status(409).json({
                message: "A student with this student number or email already exists."
            });
        }
        res.status(500).json({
            message: "Failed to create student"
        });
    }
};


// GET ALL STUDENTS
export const getStudents = async (_req: Request, res: Response) => {
    try {
        // Only admins may list students
        const callerRole = (_req as any).userRole as string | undefined;
        if (callerRole !== "admin") {
            return res.status(403).json({ message: "Access denied" });
        }
        const result = await pool.query(
            "SELECT * FROM students ORDER BY id ASC"
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Get students error:", error);

        res.status(500).json({
            message: "Failed to retrieve students"
        });
    }
};


// GET ONE STUDENT
export const getStudent = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // DEBUG
        // removed temporary debug logging
        // Authorization: allow admin or the student themself. For students, verify ownership via users.linked_id
        const authReq = req as any;
        const callerRole = authReq.userRole as string | undefined;
        const callerUserId = authReq.userId as number | undefined;

        if (callerRole === "student") {
            // resolve linked_id
            const userRow = await pool.query(
                "SELECT linked_id FROM users WHERE id = $1 AND is_active = TRUE",
                [callerUserId]
            );
            // removed temporary debug logging
            if (userRow.rows.length === 0) {
                return res.status(403).json({ message: "Access denied" });
            }
            const linkedId = String(userRow.rows[0].linked_id);
            if (linkedId !== String(id)) {
                return res.status(403).json({ message: "Access denied" });
            }
        }

        const result = await pool.query(
            "SELECT * FROM students WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Student not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Get student error:", error);

        res.status(500).json({
            message: "Failed to retrieve student"
        });
    }
};


// UPDATE STUDENT
export const updateStudent = async (req: Request, res: Response) => {
    try {
        // Admin only
        const callerRole = (req as any).userRole as string | undefined;
        if (callerRole !== "admin") {
            return res.status(403).json({ message: "Access denied" });
        }
        const { id } = req.params;

        const {
            student_number,
            full_name,
            email,
            programme
        } = req.body;

        const result = await pool.query(
            `
            UPDATE students
            SET
                student_number = $1,
                full_name = $2,
                email = $3,
                programme = $4
            WHERE id = $5
            RETURNING *
            `,
            [
                student_number,
                full_name,
                email,
                programme,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Student not found"
            });
        }

        res.json({
            message: "Student updated successfully",
            student: result.rows[0]
        });

    } catch (error) {
        console.error("Update student error:", error);

        res.status(500).json({
            message: "Failed to update student"
        });
    }
};


// DELETE STUDENT
export const deleteStudent = async (req: Request, res: Response) => {
    try {
        // Admin only
        const callerRole = (req as any).userRole as string | undefined;
        if (callerRole !== "admin") {
            return res.status(403).json({ message: "Access denied" });
        }
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM students WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Student not found"
            });
        }

        res.json({
            message: "Student deleted successfully",
            student: result.rows[0]
        });

    } catch (error) {
        console.error("Delete student error:", error);

        res.status(500).json({
            message: "Failed to delete student"
        });
    }
};
// CREATE ATTENDANCE RECORD
// MARK ATTENDANCE
export const markAttendance = async (req: Request, res: Response) => {
    try {
        let {
            student_id,
            session_id,
            qr_token
        } = req.body;

        const authReq = req as any;
        const callerRole = authReq.userRole as string | undefined;
        const callerUserId = authReq.userId as number | undefined;

        // Students may submit only the QR payload. Their identity and session
        // are resolved server-side from the authenticated account and token.
        if (callerRole === "student") {
            if (req.body.student_id !== undefined || req.body.session_id !== undefined) {
                return res.status(403).json({ message: "Student identity and session are determined from the QR code and authenticated account" });
            }
            if (!callerUserId) return res.status(403).json({ message: "Access denied" });
            const userRow = await pool.query(
                "SELECT linked_id FROM users WHERE id = $1 AND role = 'student' AND is_active = TRUE",
                [callerUserId]
            );
            if (userRow.rows.length === 0 || !userRow.rows[0].linked_id) {
                return res.status(403).json({ message: "Access denied" });
            }
            student_id = String(userRow.rows[0].linked_id);
        }

        if (!qr_token) {
            return res.status(400).json({ message: "qr_token is required" });
        }

        // If session_id was not provided, try to resolve it by qr_token
        let session: any = null;
        if (session_id) {
            const sessionResult = await pool.query(
                `SELECT * FROM sessions WHERE id = $1`,
                [session_id]
            );
            if (sessionResult.rows.length === 0) {
                return res.status(404).json({ message: "Attendance session not found" });
            }
            session = sessionResult.rows[0];
        } else {
            const byToken = await pool.query(
                `SELECT * FROM sessions WHERE qr_token = $1 ORDER BY id DESC LIMIT 1`,
                [qr_token]
            );
            if (byToken.rows.length === 0) {
                return res.status(404).json({ message: "Attendance session not found for this QR token" });
            }
            session = byToken.rows[0];
            session_id = session.id;
        }

        // Check whether session is active
        if (!session.is_active) {
            return res.status(400).json({
                message: "This attendance session is closed"
            });
        }

        // Check QR token
        if (session.qr_token !== qr_token) {
            return res.status(403).json({
                message: "Invalid attendance QR code"
            });
        }

        // QR must have been generated
        if (!session.qr_generated_at) {
            return res.status(400).json({
                message: "Attendance QR has not been generated"
            });
        }


        // If caller is a student and did not provide student_id, resolve to their linked student id
        // Validate student exists now that we have an id
        const studentResult = await pool.query(`SELECT * FROM students WHERE id = $1`, [student_id]);
        if (studentResult.rows.length === 0) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Ensure the student is enrolled in the course for this session
        const courseCheck = await pool.query(
            `SELECT sc.* FROM student_courses sc JOIN sessions s ON sc.course_id = s.course_id WHERE sc.student_id = $1 AND s.id = $2`,
            [student_id, session_id]
        );
        if (courseCheck.rows.length === 0) {
            return res.status(403).json({ message: "Student is not enrolled in this course" });
        }

        // Calculate time since QR generation
        const generatedAt = new Date(
            session.qr_generated_at
        ).getTime();

        const now = Date.now();

        const minutesSinceGeneration =
            (now - generatedAt) / (1000 * 60);

        // First 10 minutes = PRESENT
        // After 10 minutes = LATE
        const status =
            minutesSinceGeneration <=
            session.present_window_minutes
                ? "present"
                : "late";

        // Prevent duplicate attendance
        const existing = await pool.query(
            `
            SELECT *
            FROM attendance
            WHERE student_id = $1
            AND session_id = $2
            `,
            [student_id, session_id]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                message: "Attendance already recorded",
                attendance: existing.rows[0]
            });
        }

        // Record attendance
        const result = await pool.query(
            `
            INSERT INTO attendance
            (
                student_id,
                session_id,
                status,
                check_in_time
            )
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            RETURNING *
            `,
            [
                student_id,
                session_id,
                status
            ]
        );

        res.status(201).json({
            message:
                status === "present"
                    ? "Attendance marked present"
                    : "Attendance marked late",

            attendance: result.rows[0]
        });

    } catch (error) {
        console.error("Mark attendance error:", error);

        res.status(500).json({
            message: "Failed to mark attendance"
        });
    }
};

// GET ALL ATTENDANCE RECORDS
export const getAttendance = async (
    _req: Request,
    res: Response
) => {
    try {
        const result = await pool.query(
            `
            SELECT
                attendance.*,
                students.student_number,
                students.full_name,
                sessions.session_date,
                sessions.start_time,
                courses.course_code,
                courses.course_name
            FROM attendance
            JOIN students
                ON attendance.student_id = students.id
            JOIN sessions
                ON attendance.session_id = sessions.id
            JOIN courses
                ON sessions.course_id = courses.id
            ORDER BY attendance.check_in_time DESC
            `
        );

        res.json(result.rows);

    } catch (error) {
        console.error(
            "Get attendance error:",
            error
        );

        res.status(500).json({
            message: "Failed to retrieve attendance"
        });
    }
};


// GET ATTENDANCE FOR ONE STUDENT
export const getStudentAttendance = async (
    req: Request,
    res: Response
) => {
    try {
        const { studentId } = req.params;
        const authReq = req as any;
        if (authReq.userRole === "student") {
            const userResult = await pool.query(
                "SELECT linked_id FROM users WHERE id = $1 AND role = 'student' AND is_active = TRUE",
                [authReq.userId]
            );
            if (userResult.rows.length === 0 || String(userResult.rows[0].linked_id) !== String(studentId)) {
                return res.status(403).json({ message: "Access denied" });
            }
        } else if (authReq.userRole !== "admin" && authReq.userRole !== "lecturer") {
            return res.status(403).json({ message: "Access denied" });
        }

        const result = await pool.query(
            `
            SELECT
                attendance.*,
                sessions.session_date,
                sessions.start_time,
                sessions.end_time,
                courses.course_code,
                courses.course_name
            FROM attendance
            JOIN sessions
                ON attendance.session_id = sessions.id
            JOIN courses
                ON sessions.course_id = courses.id
            WHERE attendance.student_id = $1
            ORDER BY attendance.check_in_time DESC
            `,
            [studentId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error(
            "Get student attendance error:",
            error
        );

        res.status(500).json({
            message: "Failed to retrieve student attendance"
        });
    }
};


// GET TODAY'S SESSIONS FOR A STUDENT
export const getStudentTodaysSessions = async (
    req: Request,
    res: Response
) => {
    try {
        const { studentId } = req.params;
        const authReq = req as any;
        
        // Authorization: student can only access their own data
        if (authReq.userRole === "student") {
            const userResult = await pool.query(
                "SELECT linked_id FROM users WHERE id = $1 AND role = 'student' AND is_active = TRUE",
                [authReq.userId]
            );
            if (userResult.rows.length === 0 || String(userResult.rows[0].linked_id) !== String(studentId)) {
                return res.status(403).json({ message: "Access denied" });
            }
        } else if (authReq.userRole !== "admin" && authReq.userRole !== "lecturer") {
            return res.status(403).json({ message: "Access denied" });
        }

        const result = await pool.query(
            `
            SELECT
                s.id,
                s.course_id,
                s.session_date,
                s.start_time,
                s.end_time,
                s.is_active,
                s.qr_generated_at,
                c.course_code,
                c.course_name,
                c.programme,
                COALESCE(a.status, NULL) as attendance_status,
                a.check_in_time
            FROM student_courses sc
            JOIN sessions s ON s.course_id = sc.course_id
            JOIN courses c ON c.id = s.course_id
            LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = sc.student_id
            WHERE sc.student_id = $1 
              AND s.session_date = CURRENT_DATE
            ORDER BY s.start_time ASC
            `,
            [studentId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Get student today's sessions error:", error);
        res.status(500).json({
            message: "Failed to retrieve today's sessions"
        });
    }
};


// GET UPCOMING SESSIONS FOR A STUDENT
export const getStudentUpcomingSessions = async (
    req: Request,
    res: Response
) => {
    try {
        const { studentId } = req.params;
        const authReq = req as any;
        
        // Authorization: student can only access their own data
        if (authReq.userRole === "student") {
            const userResult = await pool.query(
                "SELECT linked_id FROM users WHERE id = $1 AND role = 'student' AND is_active = TRUE",
                [authReq.userId]
            );
            if (userResult.rows.length === 0 || String(userResult.rows[0].linked_id) !== String(studentId)) {
                return res.status(403).json({ message: "Access denied" });
            }
        } else if (authReq.userRole !== "admin" && authReq.userRole !== "lecturer") {
            return res.status(403).json({ message: "Access denied" });
        }

        const result = await pool.query(
            `
            SELECT
                s.id,
                s.course_id,
                s.session_date,
                s.start_time,
                s.end_time,
                s.is_active,
                s.qr_generated_at,
                c.course_code,
                c.course_name,
                c.programme,
                COALESCE(a.status, NULL) as attendance_status,
                a.check_in_time
            FROM student_courses sc
            JOIN sessions s ON s.course_id = sc.course_id
            JOIN courses c ON c.id = s.course_id
            LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = sc.student_id
            WHERE sc.student_id = $1 
              AND s.session_date >= CURRENT_DATE
            ORDER BY s.session_date ASC, s.start_time ASC
            LIMIT 5
            `,
            [studentId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Get student upcoming sessions error:", error);
        res.status(500).json({
            message: "Failed to retrieve upcoming sessions"
        });
    }
};


// ============================================================
// LECTURER CRUD OPERATIONS
// ============================================================

// CREATE LECTURER
export const createLecturer = async (req: Request, res: Response) => {
    try {
        const {
            lecturer_number,
            full_name,
            email,
            department
        } = req.body;

        if (!lecturer_number || !full_name || !email || !department) {
            return res.status(400).json({
                message: "All lecturer fields are required"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Enforce email uniqueness across both tables
        const emailCheck = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [normalizedEmail]
        );
        if (emailCheck.rows.length > 0) {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        // Begin transaction: insert into lecturers + users atomically
        const client = await pool.connect();
        let lecturer;
        let newUser;
        try {
            await client.query("BEGIN");

            // 1. Insert into lecturers domain table
            const lecturerResult = await client.query(
                `INSERT INTO lecturers (lecturer_number, full_name, email, department)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [lecturer_number, full_name, normalizedEmail, department]
            );
            lecturer = lecturerResult.rows[0];

            // 2. Create users entry in pending_activation state (NO password)
            const userResult = await client.query(
                `INSERT INTO users
                 (email, name, role, linked_id,
                  is_verified, is_active, account_status, password_hash, temp_password_used)
                 VALUES ($1, $2, 'lecturer', $3,
                         FALSE, TRUE, 'pending_activation', NULL, FALSE)
                 RETURNING id, email, name, role, linked_id, account_status`,
                [normalizedEmail, full_name, lecturer.id]
            );
            newUser = userResult.rows[0];

            await client.query("COMMIT");
        } catch (txErr) {
            await client.query("ROLLBACK");
            throw txErr;
        } finally {
            client.release();
        }

        res.status(201).json({
            message: "Lecturer registered successfully. They can now activate their account using their email address.",
            lecturer: {
                ...lecturer,
                account_status: newUser.account_status,
                user_id:        newUser.id,
            }
        });

    } catch (error: any) {
        console.error("Create lecturer error:", error);
        if (error.code === "23505") {
            return res.status(409).json({
                message: "A lecturer with this lecturer number or email already exists."
            });
        }
        res.status(500).json({
            message: "Failed to create lecturer"
        });
    }
};

// GET ALL LECTURERS
export const getLecturers = async (_req: Request, res: Response) => {
    try {
        const result = await pool.query(
            "SELECT * FROM lecturers ORDER BY id ASC"
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Get lecturers error:", error);

        res.status(500).json({
            message: "Failed to retrieve lecturers"
        });
    }
};

// GET ONE LECTURER
export const getLecturer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "SELECT * FROM lecturers WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Lecturer not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Get lecturer error:", error);

        res.status(500).json({
            message: "Failed to retrieve lecturer"
        });
    }
};

// UPDATE LECTURER
export const updateLecturer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const {
            lecturer_number,
            full_name,
            email,
            department
        } = req.body;

        const result = await pool.query(
            `
            UPDATE lecturers
            SET
                lecturer_number = $1,
                full_name = $2,
                email = $3,
                department = $4
            WHERE id = $5
            RETURNING *
            `,
            [
                lecturer_number,
                full_name,
                email,
                department,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Lecturer not found"
            });
        }

        res.json({
            message: "Lecturer updated successfully",
            lecturer: result.rows[0]
        });

    } catch (error) {
        console.error("Update lecturer error:", error);

        res.status(500).json({
            message: "Failed to update lecturer"
        });
    }
};

// DELETE LECTURER
export const deleteLecturer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM lecturers WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Lecturer not found"
            });
        }

        res.json({
            message: "Lecturer deleted successfully",
            lecturer: result.rows[0]
        });

    } catch (error) {
        console.error("Delete lecturer error:", error);

        res.status(500).json({
            message: "Failed to delete lecturer"
        });
    }
};


// ============================================================
// COURSE CRUD OPERATIONS
// ============================================================

// CREATE COURSE
export const createCourse = async (req: Request, res: Response) => {
    try {
        const {
            course_code,
            course_name,
            programme,
            lecturer_id
        } = req.body;

        if (!course_code || !course_name || !programme) {
            return res.status(400).json({
                message: "course_code, course_name, and programme are required"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO courses
            (course_code, course_name, programme, lecturer_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            `,
            [
                course_code,
                course_name,
                programme,
                lecturer_id || null
            ]
        );

        res.status(201).json({
            message: "Course created successfully",
            course: result.rows[0]
        });

    } catch (error: any) {
        console.error("Create course error:", error);

        // Handle unique constraint violation (duplicate course_code)
        if (error.code === '23505') {
            return res.status(409).json({
                message: "A course with this course code already exists"
            });
        }

        res.status(500).json({
            message: "Failed to create course"
        });
    }
};

// GET ALL COURSES (with optional lecturer join)
export const getCourses = async (_req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `
            SELECT
                courses.*,
                lecturers.full_name as lecturer_name,
                lecturers.lecturer_number
            FROM courses
            LEFT JOIN lecturers ON courses.lecturer_id = lecturers.id
            ORDER BY courses.id ASC
            `
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Get courses error:", error);

        res.status(500).json({
            message: "Failed to retrieve courses"
        });
    }
};

// GET ONE COURSE
export const getCourse = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                courses.*,
                lecturers.full_name as lecturer_name,
                lecturers.lecturer_number
            FROM courses
            LEFT JOIN lecturers ON courses.lecturer_id = lecturers.id
            WHERE courses.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Course not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Get course error:", error);

        res.status(500).json({
            message: "Failed to retrieve course"
        });
    }
};

// UPDATE COURSE
export const updateCourse = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const {
            course_code,
            course_name,
            programme,
            lecturer_id
        } = req.body;

        const result = await pool.query(
            `
            UPDATE courses
            SET
                course_code = $1,
                course_name = $2,
                programme = $3,
                lecturer_id = $4
            WHERE id = $5
            RETURNING *
            `,
            [
                course_code,
                course_name,
                programme,
                lecturer_id || null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Course not found"
            });
        }

        res.json({
            message: "Course updated successfully",
            course: result.rows[0]
        });

    } catch (error: any) {
        console.error("Update course error:", error);

        // Handle unique constraint violation (duplicate course_code)
        if (error.code === '23505') {
            return res.status(409).json({
                message: "A course with this course code already exists"
            });
        }

        res.status(500).json({
            message: "Failed to update course"
        });
    }
};

// DELETE COURSE
export const deleteCourse = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM courses WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Course not found"
            });
        }

        res.json({
            message: "Course deleted successfully",
            course: result.rows[0]
        });

    } catch (error) {
        console.error("Delete course error:", error);

        res.status(500).json({
            message: "Failed to delete course"
        });
    }
};


// ============================================================
// REPORTS AND ANALYTICS
// ============================================================

// GET ATTENDANCE REPORT
export const getAttendanceReport = async (req: Request, res: Response) => {
    try {
        const { course_id, programme, start_date, end_date, status, lecturer_id } = req.query;

        // ── Lecturer ownership enforcement ────────────────────────────────
        // When lecturer_id is supplied, verify the requesting user owns it.
        // This prevents a lecturer from requesting another lecturer's report
        // by changing the query string.
        if (lecturer_id !== undefined && lecturer_id !== "") {
            const userId   = (req as any).userId;
            const userRole = (req as any).userRole;
            if (userRole === "lecturer") {
                const userRow = await pool.query(
                    "SELECT linked_id FROM users WHERE id = $1 AND is_active = TRUE",
                    [userId]
                );
                if (
                    userRow.rows.length === 0 ||
                    String(userRow.rows[0].linked_id) !== String(lecturer_id)
                ) {
                    return res.status(403).json({
                        message: "Access denied. You can only generate reports for your own courses."
                    });
                }
            }
        }

        let query = `
            SELECT
                attendance.id,
                attendance.status,
                attendance.check_in_time,
                students.id as student_id,
                students.student_number,
                students.full_name as student_name,
                students.programme as student_programme,
                courses.id as course_id,
                courses.course_code,
                courses.course_name,
                courses.programme as course_programme,
                sessions.session_date,
                sessions.start_time,
                sessions.end_time,
                lecturers.full_name as lecturer_name
            FROM attendance
            JOIN students ON attendance.student_id = students.id
            JOIN sessions ON attendance.session_id = sessions.id
            JOIN courses ON sessions.course_id = courses.id
            LEFT JOIN lecturers ON courses.lecturer_id = lecturers.id
            WHERE 1=1
        `;

        const params: any[] = [];
        let paramIndex = 1;

        // Scope to a specific lecturer's courses when lecturer_id is provided
        if (lecturer_id !== undefined && lecturer_id !== "") {
            query += ` AND courses.lecturer_id = $${paramIndex}`;
            params.push(lecturer_id);
            paramIndex++;
        }

        if (course_id) {
            query += ` AND courses.id = $${paramIndex}`;
            params.push(course_id);
            paramIndex++;
        }

        if (programme) {
            query += ` AND students.programme = $${paramIndex}`;
            params.push(programme);
            paramIndex++;
        }

        if (start_date) {
            query += ` AND sessions.session_date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND sessions.session_date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        if (status) {
            query += ` AND attendance.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        query += ` ORDER BY sessions.session_date DESC, attendance.check_in_time DESC`;

        const result = await pool.query(query, params);

        res.json(result.rows);

    } catch (error) {
        console.error("Get attendance report error:", error);

        res.status(500).json({
            message: "Failed to generate attendance report"
        });
    }
};

// GET ATTENDANCE STATISTICS
export const getAttendanceStats = async (req: Request, res: Response) => {
    try {
        const { course_id, programme, start_date, end_date, lecturer_id } = req.query;

        // ── Lecturer ownership enforcement ────────────────────────────────
        if (lecturer_id !== undefined && lecturer_id !== "") {
            const userId   = (req as any).userId;
            const userRole = (req as any).userRole;
            if (userRole === "lecturer") {
                const userRow = await pool.query(
                    "SELECT linked_id FROM users WHERE id = $1 AND is_active = TRUE",
                    [userId]
                );
                if (
                    userRow.rows.length === 0 ||
                    String(userRow.rows[0].linked_id) !== String(lecturer_id)
                ) {
                    return res.status(403).json({
                        message: "Access denied. You can only view statistics for your own courses."
                    });
                }
            }
        }

        // Build base WHERE clause
        let whereConditions = ["1=1"];
        const params: any[] = [];
        let paramIndex = 1;

        // Scope to a specific lecturer's courses when lecturer_id is provided
        if (lecturer_id !== undefined && lecturer_id !== "") {
            whereConditions.push(`courses.lecturer_id = $${paramIndex}`);
            params.push(lecturer_id);
            paramIndex++;
        }

        if (course_id) {
            whereConditions.push(`courses.id = $${paramIndex}`);
            params.push(course_id);
            paramIndex++;
        }

        if (programme) {
            whereConditions.push(`students.programme = $${paramIndex}`);
            params.push(programme);
            paramIndex++;
        }

        if (start_date) {
            whereConditions.push(`sessions.session_date >= $${paramIndex}`);
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            whereConditions.push(`sessions.session_date <= $${paramIndex}`);
            params.push(end_date);
            paramIndex++;
        }

        const whereClause = whereConditions.join(" AND ");

        // Get status breakdown
        const statusQuery = `
            SELECT
                attendance.status,
                COUNT(*) as count
            FROM attendance
            JOIN students ON attendance.student_id = students.id
            JOIN sessions ON attendance.session_id = sessions.id
            JOIN courses ON sessions.course_id = courses.id
            WHERE ${whereClause}
            GROUP BY attendance.status
        `;

        const statusResult = await pool.query(statusQuery, params);

        // Get total sessions and students
        const totalsQuery = `
            SELECT
                COUNT(DISTINCT sessions.id) as total_sessions,
                COUNT(DISTINCT students.id) as total_students,
                COUNT(*) as total_records
            FROM attendance
            JOIN students ON attendance.student_id = students.id
            JOIN sessions ON attendance.session_id = sessions.id
            JOIN courses ON sessions.course_id = courses.id
            WHERE ${whereClause}
        `;

        const totalsResult = await pool.query(totalsQuery, params);

        // Get course-wise breakdown
        const courseQuery = `
            SELECT
                courses.course_code,
                courses.course_name,
                COUNT(*) as total_attendance,
                COUNT(CASE WHEN attendance.status = 'present' THEN 1 END) as present_count,
                COUNT(CASE WHEN attendance.status = 'late' THEN 1 END) as late_count,
                COUNT(CASE WHEN attendance.status = 'absent' THEN 1 END) as absent_count
            FROM attendance
            JOIN students ON attendance.student_id = students.id
            JOIN sessions ON attendance.session_id = sessions.id
            JOIN courses ON sessions.course_id = courses.id
            WHERE ${whereClause}
            GROUP BY courses.id, courses.course_code, courses.course_name
            ORDER BY courses.course_code
        `;

        const courseResult = await pool.query(courseQuery, params);

        const stats = {
            status_breakdown: statusResult.rows,
            totals: totalsResult.rows[0] || { total_sessions: 0, total_students: 0, total_records: 0 },
            by_course: courseResult.rows
        };

        res.json(stats);

    } catch (error) {
        console.error("Get attendance stats error:", error);

        res.status(500).json({
            message: "Failed to generate attendance statistics"
        });
    }
};

// GET AUTHENTICATED STUDENT REPORT
export const getStudentReport = async (req: Request, res: Response) => {
    try {
        const authReq = req as any;
        if (authReq.userRole !== "student") {
            return res.status(403).json({ message: "Access denied. Student access required." });
        }

        const userResult = await pool.query(
            "SELECT linked_id FROM users WHERE id = $1 AND role = 'student' AND is_active = TRUE",
            [authReq.userId]
        );
        const studentId = userResult.rows[0]?.linked_id;
        if (!studentId) return res.status(403).json({ message: "No linked student profile found." });

        const { course_id, start_date, end_date } = req.query;
        const params: any[] = [studentId];
        const filters = ["sc.student_id = $1"];
        if (course_id) { params.push(course_id); filters.push(`s.course_id = $${params.length}`); }
        if (start_date) { params.push(start_date); filters.push(`s.session_date >= $${params.length}`); }
        if (end_date) { params.push(end_date); filters.push(`s.session_date <= $${params.length}`); }
        const where = filters.join(" AND ");

        const records = await pool.query(
            `SELECT s.id AS session_id, s.session_date, s.start_time, s.end_time,
                    c.id AS course_id, c.course_code, c.course_name,
                    COALESCE(a.status, 'absent') AS status, a.check_in_time
             FROM student_courses sc
             JOIN sessions s ON s.course_id = sc.course_id
             JOIN courses c ON c.id = s.course_id
             LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = sc.student_id
             WHERE ${where}
             ORDER BY s.session_date DESC, s.start_time DESC`,
            params
        );

        const courseBreakdown = await pool.query(
            `SELECT c.id AS course_id, c.course_code, c.course_name,
                    COUNT(s.id)::int AS total_sessions,
                    COUNT(a.id) FILTER (WHERE a.status = 'present')::int AS present,
                    COUNT(a.id) FILTER (WHERE a.status = 'late')::int AS late,
                    (COUNT(s.id) - COUNT(a.id))::int AS absent
             FROM student_courses sc
             JOIN sessions s ON s.course_id = sc.course_id
             JOIN courses c ON c.id = s.course_id
             LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = sc.student_id
             WHERE ${where}
             GROUP BY c.id, c.course_code, c.course_name
             ORDER BY c.course_code`,
            params
        );

        const summary = records.rows.reduce((totals, row) => {
            totals.total_sessions += 1;
            if (row.status === "present") totals.present += 1;
            else if (row.status === "late") totals.late += 1;
            else totals.absent += 1;
            return totals;
        }, { total_sessions: 0, present: 0, late: 0, absent: 0 });

        res.json({
            summary: {
                ...summary,
                attendance_rate: summary.total_sessions > 0
                    ? Number((((summary.present + summary.late) / summary.total_sessions) * 100).toFixed(1))
                    : 0,
            },
            courses: courseBreakdown.rows.map((course) => ({
                ...course,
                attendance_rate: Number((course.total_sessions > 0
                    ? ((course.present + course.late) / course.total_sessions) * 100
                    : 0).toFixed(1)),
            })),
            records: records.rows,
        });
    } catch (error) {
        console.error("Get student report error:", error);
        res.status(500).json({ message: "Failed to generate student report" });
    }
};


// GET DASHBOARD SUMMARY
export const getDashboardSummary = async (_req: Request, res: Response) => {
    try {
        // Get total counts
        const countsQuery = `
            SELECT
                (SELECT COUNT(*) FROM students) as total_students,
                (SELECT COUNT(*) FROM lecturers) as total_lecturers,
                (SELECT COUNT(*) FROM courses) as total_courses
        `;
        const countsResult = await pool.query(countsQuery);

        // Today's attendance summary
        const todayQuery = `
            SELECT
                COUNT(*) as total_today,
                COUNT(CASE WHEN attendance.status = 'present' THEN 1 END) as present_today,
                COUNT(CASE WHEN attendance.status = 'late' THEN 1 END) as late_today,
                COUNT(CASE WHEN attendance.status = 'absent' THEN 1 END) as absent_today
            FROM attendance
            JOIN sessions ON attendance.session_id = sessions.id
            WHERE sessions.session_date = CURRENT_DATE
        `;
        const todayResult = await pool.query(todayQuery);

        // Overall attendance rate (all time)
        const rateQuery = `
            SELECT
                ROUND(
                    (COUNT(CASE WHEN status = 'present' THEN 1 END)::numeric /
                    NULLIF(COUNT(*)::numeric, 0)) * 100,
                    1
                ) as attendance_rate,
                COUNT(*) as total_records
            FROM attendance
        `;
        const rateResult = await pool.query(rateQuery);

        // Students at risk (< 75% attendance)
        const atRiskQuery = `
            SELECT COUNT(*) as at_risk_count
            FROM (
                SELECT students.id,
                    ROUND(
                        (COUNT(CASE WHEN attendance.status = 'present' THEN 1 END)::numeric /
                        NULLIF(COUNT(*)::numeric, 0)) * 100,
                        1
                    ) as rate
                FROM students
                JOIN attendance ON students.id = attendance.student_id
                GROUP BY students.id
                HAVING ROUND(
                    (COUNT(CASE WHEN attendance.status = 'present' THEN 1 END)::numeric /
                    NULLIF(COUNT(*)::numeric, 0)) * 100,
                    1
                ) < 75
            ) subq
        `;
        const atRiskResult = await pool.query(atRiskQuery);

        const counts = countsResult.rows[0];
        const today = todayResult.rows[0];
        const rate = rateResult.rows[0];
        const atRisk = atRiskResult.rows[0];

        res.json({
            total_students:  parseInt(counts.total_students  || "0"),
            total_lecturers: parseInt(counts.total_lecturers || "0"),
            total_courses:   parseInt(counts.total_courses   || "0"),
            today_total:     parseInt(today.total_today      || "0"),
            today_present:   parseInt(today.present_today    || "0"),
            today_late:      parseInt(today.late_today       || "0"),
            today_absent:    parseInt(today.absent_today     || "0"),
            attendance_rate: parseFloat(rate.attendance_rate || "0"),
            total_records:   parseInt(rate.total_records     || "0"),
            at_risk_count:   parseInt(atRisk.at_risk_count   || "0"),
        });

    } catch (error) {
        console.error("Get dashboard summary error:", error);

        res.status(500).json({
            message: "Failed to retrieve dashboard summary"
        });
    }
};


// GET ATTENDANCE INSIGHTS
export const getAttendanceInsights = async (req: Request, res: Response) => {
    try {
        // Overall attendance rate
        const overallQuery = `
            SELECT
                COUNT(*) as total_records,
                COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
                COUNT(CASE WHEN status = 'late' THEN 1 END) as late_count,
                COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count,
                ROUND(
                    (COUNT(CASE WHEN status = 'present' THEN 1 END)::numeric / 
                    NULLIF(COUNT(*)::numeric, 0)) * 100, 
                    2
                ) as present_rate,
                ROUND(
                    (COUNT(CASE WHEN status = 'late' THEN 1 END)::numeric / 
                    NULLIF(COUNT(*)::numeric, 0)) * 100, 
                    2
                ) as late_rate
            FROM attendance
        `;
        const overallResult = await pool.query(overallQuery);

        // Students with low attendance (< 75% present rate)
        const lowAttendanceQuery = `
            SELECT
                students.id,
                students.student_number,
                students.full_name,
                students.programme,
                COUNT(*) as total_sessions_attended,
                COUNT(CASE WHEN attendance.status = 'present' THEN 1 END) as present_count,
                COUNT(CASE WHEN attendance.status = 'late' THEN 1 END) as late_count,
                COUNT(CASE WHEN attendance.status = 'absent' THEN 1 END) as absent_count,
                ROUND(
                    (COUNT(CASE WHEN attendance.status = 'present' THEN 1 END)::numeric / 
                    NULLIF(COUNT(*)::numeric, 0)) * 100, 
                    2
                ) as attendance_rate
            FROM students
            LEFT JOIN attendance ON students.id = attendance.student_id
            GROUP BY students.id, students.student_number, students.full_name, students.programme
            HAVING COUNT(*) > 0 AND 
                   ROUND(
                       (COUNT(CASE WHEN attendance.status = 'present' THEN 1 END)::numeric / 
                       NULLIF(COUNT(*)::numeric, 0)) * 100, 
                       2
                   ) < 75
            ORDER BY attendance_rate ASC
            LIMIT 10
        `;
        const lowAttendanceResult = await pool.query(lowAttendanceQuery);

        // Course attendance rates
        const courseRatesQuery = `
            SELECT
                courses.course_code,
                courses.course_name,
                courses.programme,
                COUNT(*) as total_attendance,
                COUNT(CASE WHEN attendance.status = 'present' THEN 1 END) as present_count,
                ROUND(
                    (COUNT(CASE WHEN attendance.status = 'present' THEN 1 END)::numeric / 
                    NULLIF(COUNT(*)::numeric, 0)) * 100, 
                    2
                ) as attendance_rate
            FROM courses
            JOIN sessions ON courses.id = sessions.course_id
            JOIN attendance ON sessions.id = attendance.session_id
            GROUP BY courses.id, courses.course_code, courses.course_name, courses.programme
            ORDER BY attendance_rate ASC
        `;
        const courseRatesResult = await pool.query(courseRatesQuery);

        // Recent trends (last 7 days)
        const trendsQuery = `
            SELECT
                sessions.session_date,
                COUNT(*) as total_records,
                COUNT(CASE WHEN attendance.status = 'present' THEN 1 END) as present_count,
                COUNT(CASE WHEN attendance.status = 'late' THEN 1 END) as late_count,
                ROUND(
                    (COUNT(CASE WHEN attendance.status = 'present' THEN 1 END)::numeric / 
                    NULLIF(COUNT(*)::numeric, 0)) * 100, 
                    2
                ) as present_rate
            FROM attendance
            JOIN sessions ON attendance.session_id = sessions.id
            WHERE sessions.session_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY sessions.session_date
            ORDER BY sessions.session_date DESC
        `;
        const trendsResult = await pool.query(trendsQuery);

        // Programme-wise statistics
        const programmeQuery = `
            SELECT
                students.programme,
                COUNT(DISTINCT students.id) as student_count,
                COUNT(*) as total_records,
                COUNT(CASE WHEN attendance.status = 'present' THEN 1 END) as present_count,
                ROUND(
                    (COUNT(CASE WHEN attendance.status = 'present' THEN 1 END)::numeric / 
                    NULLIF(COUNT(*)::numeric, 0)) * 100, 
                    2
                ) as attendance_rate
            FROM students
            LEFT JOIN attendance ON students.id = attendance.student_id
            GROUP BY students.programme
            HAVING COUNT(*) > 0
            ORDER BY attendance_rate DESC
        `;
        const programmeResult = await pool.query(programmeQuery);

        const insights = {
            overall: overallResult.rows[0] || {
                total_records: 0,
                present_count: 0,
                late_count: 0,
                absent_count: 0,
                present_rate: 0,
                late_rate: 0
            },
            low_attendance_students: lowAttendanceResult.rows,
            course_rates: courseRatesResult.rows,
            recent_trends: trendsResult.rows,
            by_programme: programmeResult.rows
        };

        res.json(insights);

    } catch (error) {
        console.error("Get attendance insights error:", error);

        res.status(500).json({
            message: "Failed to generate attendance insights"
        });
    }
};


// ============================================================
// ADMINISTRATOR MANAGEMENT
// ============================================================

// GET ALL ADMINISTRATORS
export const getAdministrators = async (_req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT id, email, name, role, is_verified, is_active, created_at
             FROM users
             WHERE role = 'admin'
             ORDER BY id ASC`
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Get administrators error:", error);

        res.status(500).json({
            message: "Failed to retrieve administrators"
        });
    }
};

// CREATE ADMINISTRATOR
export const createAdministrator = async (req: Request, res: Response) => {
    try {
        const { email, name } = req.body;

        if (!email || !name) {
            return res.status(400).json({
                message: "Email and name are required"
            });
        }

        const normalisedEmail = email.toLowerCase().trim();

        // Check if email already exists
        const existing = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [normalisedEmail]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                message: "An account with this email already exists"
            });
        }

        // Pre-register admin: NO password. Admin activates their own account via the OTP flow.
        const result = await pool.query(
            `INSERT INTO users
             (email, name, role,
              is_verified, is_active, account_status, password_hash, temp_password_used)
             VALUES ($1, $2, 'admin',
                     FALSE, TRUE, 'pending_activation', NULL, FALSE)
             RETURNING id, email, name, role, is_verified, is_active, created_at, account_status`,
            [normalisedEmail, name.trim()]
        );

        const newAdmin = result.rows[0];

        res.status(201).json({
            message: "Administrator pre-registered successfully. They can activate their account using their registered email.",
            administrator: newAdmin,
        });

    } catch (error) {
        console.error("Create administrator error:", error);

        res.status(500).json({
            message: "Failed to create administrator"
        });
    }
};

// UPDATE ADMINISTRATOR STATUS
export const updateAdministratorStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (typeof is_active !== "boolean") {
            return res.status(400).json({
                message: "is_active must be a boolean"
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET is_active = $1
             WHERE id = $2 AND role = 'admin'
             RETURNING id, email, name, role, is_verified, is_active, created_at`,
            [is_active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Administrator not found"
            });
        }

        res.json({
            message: `Administrator ${is_active ? "activated" : "deactivated"} successfully`,
            administrator: result.rows[0]
        });

    } catch (error) {
        console.error("Update administrator status error:", error);

        res.status(500).json({
            message: "Failed to update administrator status"
        });
    }
};

// RESET ADMINISTRATOR PASSWORD
export const resetAdministratorPassword = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        if (!new_password) {
            return res.status(400).json({
                message: "New password is required"
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters"
            });
        }

        // Hash new password — use top-level bcryptLib import (not dynamic require)
        const password_hash = await bcryptLib.hash(new_password, 12);

        const result = await pool.query(
            `UPDATE users
             SET password_hash = $1
             WHERE id = $2 AND role = 'admin'
             RETURNING id, email, name, role`,
            [password_hash, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Administrator not found"
            });
        }

        res.json({
            message: "Password reset successfully"
        });

    } catch (error) {
        console.error("Reset administrator password error:", error);

        res.status(500).json({
            message: "Failed to reset password"
        });
    }
};
