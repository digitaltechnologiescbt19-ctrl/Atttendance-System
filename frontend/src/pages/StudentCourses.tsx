import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineBookOpen,
  HiOutlineQrCode,
  HiOutlineChartBarSquare,
  HiOutlineAcademicCap,
  HiOutlineUser,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import { getStudentEnrolledCourses, type StudentEnrolledCourse } from "../services/coursesService";

export default function StudentCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<StudentEnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEnrolledCourses();
  }, []);

  async function fetchEnrolledCourses() {
    try {
      setLoading(true);
      setError(null);
      const data = await getStudentEnrolledCourses("me");
      setCourses(data);
    } catch (err: any) {
      console.error("Error fetching student enrolled courses:", err);
      setError(err.message || "Failed to load enrolled courses.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container" style={{ padding: "1.5rem 2rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <HiOutlineBookOpen style={{ color: "#2563EB", fontSize: "2rem" }} />
          My Enrolled Courses & Modules
        </h1>
        <p style={{ color: "#64748B", marginTop: "0.25rem", fontSize: "0.95rem" }}>
          View your active NBI Institute course enrollments, instructors, and personal attendance statistics.
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ padding: "3rem 0", textAlign: "center", color: "#64748B" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
          <p>Fetching your course enrollments...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div
          style={{
            padding: "1.25rem 1.5rem",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: "0.75rem",
            color: "#991B1B",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{error}</span>
          <button
            onClick={fetchEnrolledCourses}
            style={{
              padding: "0.4rem 0.85rem",
              backgroundColor: "#DC2626",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && courses.length === 0 && (
        <div
          style={{
            padding: "3.5rem 2rem",
            backgroundColor: "#FFFFFF",
            borderRadius: "0.875rem",
            border: "1px dashed #CBD5E1",
            textAlign: "center",
            maxWidth: "520px",
            margin: "2rem auto",
          }}
        >
          <HiOutlineAcademicCap style={{ fontSize: "3.5rem", color: "#94A3B8", marginBottom: "1rem" }} />
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#1E293B", marginBottom: "0.5rem" }}>
            No Active Course Enrollments
          </h3>
          <p style={{ color: "#64748B", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            You are not currently enrolled in any NBI Institute courses. Please contact your instructor or administration to get enrolled into your practical training modules.
          </p>
        </div>
      )}

      {/* Enrolled Courses Grid */}
      {!loading && !error && courses.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {courses.map((course) => (
            <div
              key={course.id}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "0.875rem",
                border: "1px solid #E2E8F0",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.03)",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                {/* Badges */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                  <span
                    style={{
                      padding: "0.3rem 0.65rem",
                      backgroundColor: "#EFF6FF",
                      color: "#1D4ED8",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #BFDBFE",
                    }}
                  >
                    {course.course_code}
                  </span>
                  <span
                    style={{
                      padding: "0.25rem 0.6rem",
                      backgroundColor: "#ECFDF5",
                      color: "#065F46",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      borderRadius: "0.25rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <HiOutlineCheckCircle />
                    Active Enrollment
                  </span>
                </div>

                {/* Course Name */}
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.5rem 0", lineHeight: 1.35 }}>
                  {course.course_name}
                </h3>

                {/* Instructor */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#475569", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                  <HiOutlineUser style={{ color: "#2563EB", fontSize: "1.1rem" }} />
                  Tutor: <strong>{course.lecturer_name || "Assigned NBI Instructor"}</strong>
                </div>

                {/* Metrics */}
                <div
                  style={{
                    backgroundColor: "#F8FAFC",
                    padding: "0.85rem 1rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #F1F5F9",
                    marginBottom: "1.25rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>Attendance Rate</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: course.attendance_rate >= 75 ? "#059669" : "#D97706" }}>
                      {course.attendance_rate}%
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>Sessions Attended</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1E293B" }}>
                      {course.attended_sessions} / {course.total_sessions}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={() => navigate("/student/scan")}
                  style={{
                    flex: 1,
                    padding: "0.6rem 0.85rem",
                    backgroundColor: "#059669",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.4rem",
                  }}
                >
                  <HiOutlineQrCode style={{ fontSize: "1.1rem" }} />
                  Scan Class QR
                </button>

                <button
                  onClick={() => navigate("/student/attendance")}
                  style={{
                    padding: "0.6rem 0.85rem",
                    backgroundColor: "#F1F5F9",
                    color: "#334155",
                    border: "1px solid #CBD5E1",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  <HiOutlineChartBarSquare style={{ fontSize: "1.1rem" }} />
                  View Logs
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
