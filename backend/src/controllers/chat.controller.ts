/**
 * NBI Smart Attendance — Chat Controller
 * Native Role-Aware AI Assistant powered by Google Gemini API & Live System Data
 */

import { Request, Response } from "express";
import pool from "../database/db";

interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

interface ContextData {
  userRole: string;
  userName: string;
  userEmail: string;
  details: Record<string, unknown>;
}

/**
 * Fetch DB context tailored to the user's role and identity
 */
async function fetchRoleContext(userId: number): Promise<ContextData> {
  const userRes = await pool.query(
    "SELECT id, email, name, role, linked_id FROM users WHERE id = $1 AND is_active = TRUE",
    [userId]
  );

  if (userRes.rows.length === 0) {
    throw new Error("User not found or inactive.");
  }

  const user = userRes.rows[0];
  const role = user.role as string;
  const linkedId = user.linked_id as number | null;
  const details: Record<string, unknown> = {};

  if (role === "student" && linkedId) {
    // 1. Student profile & attendance summary
    const studentRes = await pool.query(
      "SELECT id, student_number, full_name, email, programme FROM students WHERE id = $1",
      [linkedId]
    );
    if (studentRes.rows.length > 0) {
      details.studentProfile = studentRes.rows[0];
    }

    const attRes = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'present') as present_count,
         COUNT(*) FILTER (WHERE status = 'late') as late_count,
         COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
         COUNT(*) as total_records
       FROM attendance_records
       WHERE student_id = $1`,
      [linkedId]
    );
    details.attendanceSummary = attRes.rows[0];

    // 2. Today's and upcoming sessions
    const todayRes = await pool.query(
      `SELECT s.id, c.code, c.title, s.session_date, s.start_time, s.end_time, s.status
       FROM attendance_sessions s
       JOIN courses c ON s.course_id = c.id
       JOIN student_courses sc ON sc.course_id = c.id
       WHERE sc.student_id = $1 AND s.session_date = CURRENT_DATE
       ORDER BY s.start_time ASC`,
      [linkedId]
    );
    details.todaySessions = todayRes.rows;

    const upcomingRes = await pool.query(
      `SELECT s.id, c.code, c.title, s.session_date, s.start_time, s.end_time
       FROM attendance_sessions s
       JOIN courses c ON s.course_id = c.id
       JOIN student_courses sc ON sc.course_id = c.id
       WHERE sc.student_id = $1 AND s.session_date > CURRENT_DATE
       ORDER BY s.session_date ASC, s.start_time ASC
       LIMIT 5`,
      [linkedId]
    );
    details.upcomingSessions = upcomingRes.rows;

  } else if (role === "lecturer" && linkedId) {
    // Lecturer profile & course summary
    const lecRes = await pool.query(
      "SELECT id, lecturer_number, full_name, email, department FROM lecturers WHERE id = $1",
      [linkedId]
    );
    if (lecRes.rows.length > 0) {
      details.lecturerProfile = lecRes.rows[0];
    }

    const coursesRes = await pool.query(
      "SELECT id, code, title, credit_hours FROM courses WHERE lecturer_id = $1",
      [linkedId]
    );
    details.assignedCourses = coursesRes.rows;

    const todayRes = await pool.query(
      `SELECT s.id, c.code, c.title, s.session_date, s.start_time, s.end_time, s.status,
              (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id AND r.status IN ('present', 'late')) as attendee_count
       FROM attendance_sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE c.lecturer_id = $1 AND s.session_date = CURRENT_DATE
       ORDER BY s.start_time ASC`,
      [linkedId]
    );
    details.todayLectures = todayRes.rows;

  } else if (role === "admin") {
    // Admin institute-wide metrics
    const statsRes = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM students) as total_students,
        (SELECT COUNT(*) FROM lecturers) as total_lecturers,
        (SELECT COUNT(*) FROM courses) as total_courses,
        (SELECT COUNT(*) FROM users WHERE account_status = 'pending_activation') as pending_activations,
        (SELECT COUNT(*) FROM attendance_sessions WHERE session_date = CURRENT_DATE) as today_total_sessions
    `);
    details.instituteStats = statsRes.rows[0];
  }

  return {
    userRole: role,
    userName: user.name,
    userEmail: user.email,
    details,
  };
}

/**
 * Fallback AI response generation when Gemini API key is not supplied
 */
function generateFallbackResponse(userMessage: string, context: ContextData): string {
  const q = userMessage.toLowerCase();
  const role = context.userRole;
  const name = context.userName;
  const d = context.details;

  if (q.includes("next class") || q.includes("timetable") || q.includes("schedule") || q.includes("when is")) {
    if (role === "student") {
      const today = (d.todaySessions as any[]) || [];
      const upcoming = (d.upcomingSessions as any[]) || [];

      if (today.length > 0) {
        const first = today[0];
        return `Hello ${name}, your next class today is **${first.code} - ${first.title}** scheduled from **${first.start_time} to ${first.end_time}**.`;
      }
      if (upcoming.length > 0) {
        const next = upcoming[0];
        return `Hello ${name}, you have no remaining classes today. Your next upcoming class is **${next.code} - ${next.title}** on **${next.session_date.toString().slice(0, 10)}** at **${next.start_time}**.`;
      }
      return `Hello ${name}, you have no upcoming classes scheduled in the system.`;
    }

    if (role === "lecturer") {
      const today = (d.todayLectures as any[]) || [];
      if (today.length > 0) {
        const first = today[0];
        return `Dr. ${name}, your next lecture today is **${first.code} - ${first.title}** from **${first.start_time} to ${first.end_time}** (${first.attendee_count ?? 0} checked in).`;
      }
      return `Hello Dr. ${name}, you have no remaining lectures scheduled for today.`;
    }

    return `As an Administrator, you can view all active lecture sessions under **QR Attendance** or **Reports**.`;
  }

  if (q.includes("attendance") || q.includes("percentage") || q.includes("summary") || q.includes("record")) {
    if (role === "student") {
      const att = (d.attendanceSummary as any) || {};
      const present = Number(att.present_count || 0);
      const late = Number(att.late_count || 0);
      const absent = Number(att.absent_count || 0);
      const total = Number(att.total_records || 0);
      const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

      return `Here is your attendance summary, **${name}**:\n\n` +
             `- **Overall Attendance Rate**: ${pct}%\n` +
             `- **Present**: ${present} sessions\n` +
             `- **Late**: ${late} sessions\n` +
             `- **Absent**: ${absent} sessions\n` +
             `- **Total Recorded Sessions**: ${total}`;
    }

    if (role === "lecturer") {
      const courses = (d.assignedCourses as any[]) || [];
      return `Hello Dr. ${name}, you are currently assigned to **${courses.length} courses**. You can monitor live student check-ins and generate downloadable attendance reports under **Insights** or **Reports**.`;
    }

    if (role === "admin") {
      const stats = (d.instituteStats as any) || {};
      return `**NBI Institute Overview Summary**:\n\n` +
             `- **Registered Students**: ${stats.total_students ?? 0}\n` +
             `- **Academic Lecturers**: ${stats.total_lecturers ?? 0}\n` +
             `- **Active Courses**: ${stats.total_courses ?? 0}\n` +
             `- **Sessions Today**: ${stats.today_total_sessions ?? 0}\n` +
             `- **Accounts Pending Activation**: ${stats.pending_activations ?? 0}`;
    }
  }

  return `Hello ${name}! I am your NBI Smart Attendance AI Assistant. I can help you check your ${role === "student" ? "class timetable, attendance percentage, and check-in records" : role === "lecturer" ? "lecture schedules, course check-ins, and student attendance reports" : "institute attendance trends, registered accounts, and course metrics"}. What would you like to know?`;
}

/**
 * Handle incoming chat message
 */
export async function handleChatMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const { message } = req.body as {
      message?: string;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ message: "Message is required." });
      return;
    }

    // 1. Fetch live system context for the authenticated user
    const roleContext = await fetchRoleContext(userId);

    // 2. Check if GEMINI_API_KEY is available
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      // Use intelligent database-backed fallback response
      const fallbackReply = generateFallbackResponse(message.trim(), roleContext);
      res.json({
        reply: fallbackReply,
        timestamp: new Date().toISOString(),
        provider: "NBI-Native-Engine",
      });
      return;
    }

    // 3. Call Google Gemini API
    const systemInstruction = `You are the NBI Smart Attendance AI Assistant, an intelligent, polite, and helpful assistant built specifically for NBI Institute's Smart Attendance System.
The authenticated user is: ${roleContext.userName} (${roleContext.userEmail}), Role: ${roleContext.userRole.toUpperCase()}.

Here is the live system context from PostgreSQL database for this user:
${JSON.stringify(roleContext.details, null, 2)}

Instructions:
- Provide clear, concise, well-formatted markdown responses (use bolding, bullet points, numbered lists).
- Always base answers about timetables, attendance percentages, courses, or student counts on the provided database context.
- If asked something outside NBI Institute attendance/academic scope, answer politely while offering help with their attendance or schedule.
- Never mention internal database structure or raw JSON format to the user.`;

    const contents = [
      {
        role: "user",
        parts: [{ text: `${systemInstruction}\n\nUser Question: ${message.trim()}` }],
      },
    ];

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (!geminiRes.ok) {
      console.warn("Gemini API error, using fallback engine:", geminiRes.statusText);
      const fallbackReply = generateFallbackResponse(message.trim(), roleContext);
      res.json({
        reply: fallbackReply,
        timestamp: new Date().toISOString(),
        provider: "NBI-Fallback-Engine",
      });
      return;
    }

    const geminiData = (await geminiRes.json()) as any;
    const replyText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      generateFallbackResponse(message.trim(), roleContext);

    res.json({
      reply: replyText,
      timestamp: new Date().toISOString(),
      provider: "Google-Gemini",
    });

  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ message: "Failed to process AI chat message." });
  }
}
