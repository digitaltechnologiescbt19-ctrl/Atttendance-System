/**
 * NBI Smart Attendance — AI Assistant Controller
 * Secure, Role-Aware, Tool-Assisted Backend Engine
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

// Tool 1: Get My Profile
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

// Tool 2: Get My Courses
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

// Tool 3: Get My Attendance (Student Only)
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

// Tool 4: Get My Schedule
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

// Tool 5: Get Course Attendance (Lecturer / Admin)
async function toolGetCourseAttendance(ctx: UserContext, courseId: number) {
  if (ctx.role === "student") {
    return { error: "Access Denied: Students are not authorized to view course-wide attendance reports." };
  }

  if (ctx.role === "lecturer") {
    // Enforce server-side ownership check
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
    `SELECT id, session_date, start_time, end_time, status
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

// Tool 6: Get Course Students (Lecturer / Admin)
async function toolGetCourseStudents(ctx: UserContext, courseId: number) {
  if (ctx.role === "student") {
    return { error: "Access Denied: Students are not authorized to view student class rosters." };
  }

  if (ctx.role === "lecturer") {
    // Enforce server-side ownership check
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

// Tool 7: Get Institution Attendance Summary (Admin Only)
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

/* ------------------------------------------------------------------ */
/*  Tool Dispatcher with Server-Side Authorization Check               */
/* ------------------------------------------------------------------ */

async function executeTool(name: string, args: Record<string, any>, ctx: UserContext) {
  switch (name) {
    case "get_my_profile":
      return await toolGetMyProfile(ctx);
    case "get_my_courses":
      return await toolGetMyCourses(ctx);
    case "get_my_attendance":
      return await toolGetMyAttendance(ctx);
    case "get_my_schedule":
      return await toolGetMySchedule(ctx);
    case "get_course_attendance":
      return await toolGetCourseAttendance(ctx, Number(args.course_id || 0));
    case "get_course_students":
      return await toolGetCourseStudents(ctx, Number(args.course_id || 0));
    case "get_institution_attendance_summary":
      return await toolGetInstitutionSummary(ctx);
    default:
      return { error: `Unknown tool '${name}'` };
  }
}

/* ------------------------------------------------------------------ */
/*  Gemini Function Calling Integration & Fallback Engine             */
/* ------------------------------------------------------------------ */

const functionDeclarations = [
  {
    name: "get_my_profile",
    description: "Get current user profile information including student number or lecturer department",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_courses",
    description: "Get list of courses relevant to the authenticated user's role",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_attendance",
    description: "Get attendance rate, present/late/absent stats, and check-in records for the logged-in student",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_schedule",
    description: "Get upcoming class or lecture timetable sessions for the user",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_course_attendance",
    description: "Get attendance stats and session history for a specific course (Lecturer / Admin only)",
    parameters: {
      type: "OBJECT",
      properties: { course_id: { type: "NUMBER", description: "Course ID number" } },
      required: ["course_id"],
    },
  },
  {
    name: "get_course_students",
    description: "Get enrolled student roster for a specific course (Lecturer / Admin only)",
    parameters: {
      type: "OBJECT",
      properties: { course_id: { type: "NUMBER", description: "Course ID number" } },
      required: ["course_id"],
    },
  },
  {
    name: "get_institution_attendance_summary",
    description: "Get overall institute metrics, student/lecturer totals, and pending accounts (Admin only)",
    parameters: { type: "OBJECT", properties: {} },
  },
];

export async function handleChatMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized request." });
      return;
    }

    const { message } = req.body as { message?: string };
    if (!message || !message.trim()) {
      res.status(400).json({ message: "Message is required." });
      return;
    }

    // 1. Resolve authenticated user identity & role
    const ctx = await getAuthenticatedUser(userId);
    const userPrompt = message.trim();

    // 2. Check API Key
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    // Direct Intent Fallback Engine (when Gemini API key is omitted or for instant offline response)
    if (!apiKey) {
      const q = userPrompt.toLowerCase();
      let toolData: any = {};

      if (q.includes("profile") || q.includes("who am i") || q.includes("my account")) {
        toolData = await executeTool("get_my_profile", {}, ctx);
      } else if (q.includes("class") || q.includes("timetable") || q.includes("schedule") || q.includes("next")) {
        toolData = await executeTool("get_my_schedule", {}, ctx);
      } else if (q.includes("course") || q.includes("subject")) {
        toolData = await executeTool("get_my_courses", {}, ctx);
      } else if (q.includes("summary") || q.includes("institute") || q.includes("total students")) {
        if (ctx.role === "admin") {
          toolData = await executeTool("get_institution_attendance_summary", {}, ctx);
        } else {
          toolData = await executeTool("get_my_attendance", {}, ctx);
        }
      } else {
        toolData = await executeTool("get_my_attendance", {}, ctx);
      }

      // Synthesize clear markdown response from tool execution
      let reply = `Hello **${ctx.name}** (${ctx.role.toUpperCase()})!\n\n`;

      if (toolData.error) {
        reply += `⚠️ **Notice**: ${toolData.error}\n\nHow else can I assist with your attendance system tasks?`;
      } else if (toolData.attendanceRate) {
        reply += `Here is your current attendance summary:\n` +
                 `- **Attendance Rate**: ${toolData.attendanceRate}\n` +
                 `- **Present**: ${toolData.summary.present} sessions\n` +
                 `- **Late**: ${toolData.summary.late} sessions\n` +
                 `- **Absent**: ${toolData.summary.absent} sessions\n` +
                 `- **Total Sessions**: ${toolData.summary.total}`;
      } else if (toolData.courses) {
        reply += `You have **${toolData.courses.length} courses** in the system:\n` +
                 toolData.courses.map((c: any) => `- **${c.code}**: ${c.title}`).join("\n");
      } else if (toolData.schedule) {
        if (toolData.schedule.length === 0) {
          reply += `You have no upcoming sessions scheduled at this time.`;
        } else {
          reply += `Your upcoming schedule:\n` +
                   toolData.schedule.map((s: any) => `- **${s.code} - ${s.title}**: ${s.session_date.toString().slice(0, 10)} (${s.start_time} - ${s.end_time})`).join("\n");
        }
      } else if (toolData.institutionSummary) {
        const s = toolData.institutionSummary;
        reply += `**NBI Institute Overview**:\n` +
                 `- **Registered Students**: ${s.total_students}\n` +
                 `- **Lecturers**: ${s.total_lecturers}\n` +
                 `- **Courses**: ${s.total_courses}\n` +
                 `- **Sessions Recorded**: ${s.total_sessions}\n` +
                 `- **Accounts Pending Activation**: ${s.pending_activations}`;
      } else {
        reply += `I am your NBI Smart Attendance AI Assistant. You can ask me about your schedule, attendance rate, assigned courses, or overall system metrics.`;
      }

      res.json({
        reply,
        timestamp: new Date().toISOString(),
        provider: "NBI-Role-Tool-Engine",
      });
      return;
    }

    // 3. Call Google Gemini API with tool declarations (with network timeout fallback)
    const systemPrompt = `You are the NBI Smart Attendance AI Assistant, an intelligent, role-aware assistant built specifically for NBI Institute.
The authenticated user is: Name: "${ctx.name}", Email: "${ctx.email}", Role: "${ctx.role.toUpperCase()}", Linked ID: ${ctx.linkedId}.

CRITICAL SECURITY & BEHAVIORAL RULES:
1. When the user provides a greeting (e.g., "Hi", "Hello", "Hey") or a general inquiry about what you can do:
   - For ADMIN users: Greet them warmly as an Administrator and explain that you can assist with institution attendance summaries, course registrations, lecturer profiles, student rosters, attendance reports, and attendance trends. Do NOT attempt to fetch personal student attendance records or state access denied.
   - For LECTURER users: Greet them as a Lecturer and explain that you can assist with their assigned courses, class session schedules, student attendance, and course reports.
   - For STUDENT users: Greet them as a Student and explain that you can assist with their personal attendance rate, class schedules, and course check-in history.
2. For specific data queries, call backend tools (e.g. get_my_attendance, get_my_courses, get_my_schedule, get_institution_attendance_summary, get_course_attendance) to fetch data before answering questions about schedules, attendance, courses, or student records.
3. Server-side authorization rules will evaluate tool requests. If a tool returns an "Access Denied" error message, respect the restriction strictly and explain to the user politely that they are not authorized for that data.
4. Respond in clean, formatted Markdown with bullet points or bold titles.`;

    const contents: any[] = [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\nUser Question: ${userPrompt}` }],
      },
    ];

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    try {
      const initialRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          tools: [{ functionDeclarations }],
        }),
      });

      if (initialRes.ok) {
        const data = (await initialRes.json()) as any;
        const candidate = data?.candidates?.[0];
        const functionCall = candidate?.content?.parts?.find((p: any) => p.functionCall)?.functionCall;

        if (functionCall) {
          // Execute backend tool with server-side authorization check
          const toolResult = await executeTool(functionCall.name, functionCall.args || {}, ctx);

          // Send tool response back to Gemini to synthesize final answer
          contents.push(candidate.content);
          contents.push({
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: functionCall.name,
                  response: { name: functionCall.name, content: toolResult },
                },
              },
            ],
          });

          const secondRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }),
          });

          if (secondRes.ok) {
            const secondData = (await secondRes.json()) as any;
            const text = secondData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              res.json({
                reply: text,
                timestamp: new Date().toISOString(),
                provider: "Google-Gemini-FunctionCalling",
              });
              return;
            }
          }

          // If second call failed, return tool result cleanly formatted
          res.json({
            reply: `Here are the results for your request:\n\`\`\`json\n${JSON.stringify(toolResult, null, 2)}\n\`\`\``,
            timestamp: new Date().toISOString(),
            provider: "NBI-Tool-Executor",
          });
          return;
        }

        const directText = candidate?.content?.parts?.[0]?.text;
        if (directText) {
          res.json({
            reply: directText,
            timestamp: new Date().toISOString(),
            provider: "Google-Gemini",
          });
          return;
        }
      }
    } catch (netErr) {
      console.warn("External Gemini API call timed out or failed, using native NBI Tool Engine:", netErr);
    }

    // Fallback Engine if Gemini API call fails or times out
    const q = userPrompt.toLowerCase();
    const isGreeting = q === "hi" || q === "hello" || q === "hey" || q.startsWith("hi ") || q.startsWith("hello ") || q.includes("what can you do") || q.includes("help");

    let reply = "";

    if (isGreeting) {
      if (ctx.role === "admin") {
        reply = `Hello **${ctx.name}**!\n\n` +
          `Welcome to the NBI Administrator Assistant. I am here to help you manage and monitor institution-wide attendance operations.\n\n` +
          `I can assist you with:\n` +
          `- 📊 **Institution Attendance**: Overall attendance rates and session metrics\n` +
          `- 📚 **Courses**: Course listings and assigned lecturers\n` +
          `- 👨‍🏫 **Lecturers**: Faculty directory and course assignments\n` +
          `- 🎓 **Students**: Enrolled student rosters and account statuses\n` +
          `- 📈 **Attendance Reports & Trends**: Institution-wide attendance analytics\n\n` +
          `How can I help you today?`;
      } else if (ctx.role === "lecturer") {
        reply = `Hello **${ctx.name}**!\n\n` +
          `Welcome to the NBI Lecturer Assistant. I can help you manage your courses and track student attendance.\n\n` +
          `You can ask me about:\n` +
          `- 📚 **My Courses**: Assigned courses and enrolled students\n` +
          `- ⏰ **Lectures & Schedule**: Session timetables and active QR windows\n` +
          `- 👥 **Class Attendance**: Student attendance history for your courses\n\n` +
          `How can I assist you today?`;
      } else {
        reply = `Hello **${ctx.name}**!\n\n` +
          `Welcome to the NBI Student Assistant. I can help you keep track of your classes and attendance record.\n\n` +
          `You can ask me about:\n` +
          `- 📊 **My Attendance**: Overall attendance rate and check-in summary\n` +
          `- 📅 **Class Timetable**: Upcoming lectures and session schedules\n` +
          `- 📝 **My Courses**: Enrolled courses and lecturer details\n\n` +
          `How can I help you today?`;
      }
    } else {
      let toolData: any = {};
      if (q.includes("profile") || q.includes("who am i") || q.includes("my account")) {
        toolData = await executeTool("get_my_profile", {}, ctx);
      } else if (q.includes("class") || q.includes("timetable") || q.includes("schedule") || q.includes("next")) {
        toolData = await executeTool("get_my_schedule", {}, ctx);
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

      reply = `Hello **${ctx.name}** (${ctx.role.toUpperCase()})!\n\n`;
      if (toolData.error) {
        reply += `⚠️ **Notice**: ${toolData.error}\n\nHow else can I assist with your attendance system tasks?`;
      } else if (toolData.attendanceRate) {
        reply += `Here is your current attendance summary:\n` +
                 `- **Attendance Rate**: ${toolData.attendanceRate}\n` +
                 `- **Present**: ${toolData.summary.present} sessions\n` +
                 `- **Late**: ${toolData.summary.late} sessions\n` +
                 `- **Absent**: ${toolData.summary.absent} sessions\n` +
                 `- **Total Sessions**: ${toolData.summary.total}`;
      } else if (toolData.courses) {
        reply += `You have **${toolData.courses.length} courses** in the system:\n` +
                 toolData.courses.map((c: any) => `- **${c.code}**: ${c.title}`).join("\n");
      } else if (toolData.schedule) {
        if (toolData.schedule.length === 0) {
          reply += `You have no upcoming sessions scheduled at this time.`;
        } else {
          reply += `Your upcoming schedule:\n` +
                   toolData.schedule.map((s: any) => `- **${s.code} - ${s.title}**: ${s.session_date.toString().slice(0, 10)} (${s.start_time} - ${s.end_time})`).join("\n");
        }
      } else if (toolData.institutionSummary) {
        const s = toolData.institutionSummary;
        reply += `**NBI Institute Overview**:\n` +
                 `- **Registered Students**: ${s.total_students}\n` +
                 `- **Lecturers**: ${s.total_lecturers}\n` +
                 `- **Courses**: ${s.total_courses}\n` +
                 `- **Sessions Recorded**: ${s.total_sessions}\n` +
                 `- **Accounts Pending Activation**: ${s.pending_activations}`;
      } else {
        reply += `I am your NBI Smart Attendance AI Assistant. You can ask me about your schedule, attendance, assigned courses, or overall system metrics.`;
      }
    }

    res.json({
      reply,
      timestamp: new Date().toISOString(),
      provider: "NBI-Role-Tool-Engine",
    });

  } catch (error: any) {
    console.error("Chat Error:", error);
    res.status(500).json({ message: "Failed to process assistant request." });
  }
}

