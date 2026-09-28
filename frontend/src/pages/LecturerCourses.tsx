import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HiOutlineBookOpen,
  HiOutlineUsers,
  HiOutlineQrCode,
  HiOutlineChartBarSquare,
  HiOutlineChatBubbleLeftEllipsis,
  HiOutlineArrowRight,
  HiOutlineAcademicCap,
  HiOutlineMagnifyingGlass,
} from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";
import { getLecturerCourses, type LecturerCourseItem } from "../services/coursesService";

export default function LecturerCourses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<LecturerCourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const lecturerId = user?.linked_id || "me";

  useEffect(() => {
    fetchCourses();
  }, [lecturerId]);

  async function fetchCourses() {
    try {
      setLoading(true);
      setError(null);
      const data = await getLecturerCourses(lecturerId);
      setCourses(data);
    } catch (err: any) {
      console.error("Error fetching lecturer courses:", err);
      setError(err.message || "Failed to load assigned courses.");
    } finally {
      setLoading(false);
    }
  }

  const filteredCourses = courses.filter((c) =>
    c.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.course_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.programme.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container" style={{ padding: "1.5rem 2rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <HiOutlineBookOpen style={{ color: "#2563EB", fontSize: "2rem" }} />
            My Courses & Training Modules
          </h1>
          <p style={{ color: "#64748B", marginTop: "0.25rem", fontSize: "0.95rem" }}>
            Manage course rosters, track attendance, and generate QR sessions for your assigned NBI Institute programs.
          </p>
        </div>

        {/* Quick Search */}
        <div style={{ position: "relative", minWidth: "260px" }}>
          <HiOutlineMagnifyingGlass
            style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: "1.1rem" }}
          />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.6rem 1rem 0.6rem 2.5rem",
              borderRadius: "0.5rem",
              border: "1px solid #CBD5E1",
              fontSize: "0.9rem",
              outline: "none",
              backgroundColor: "#FFFFFF",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ padding: "3rem 0", textAlign: "center", color: "#64748B" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
          <p>Loading your NBI course roster...</p>
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
            onClick={fetchCourses}
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
      {!loading && !error && filteredCourses.length === 0 && (
        <div
          style={{
            padding: "3.5rem 2rem",
            backgroundColor: "#FFFFFF",
            borderRadius: "0.875rem",
            border: "1px dashed #CBD5E1",
            textAlign: "center",
            maxWidth: "540px",
            margin: "2rem auto",
          }}
        >
          <HiOutlineAcademicCap style={{ fontSize: "3.5rem", color: "#94A3B8", marginBottom: "1rem" }} />
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#1E293B", marginBottom: "0.5rem" }}>
            {searchTerm ? "No matching courses found" : "No Courses Assigned Yet"}
          </h3>
          <p style={{ color: "#64748B", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            {searchTerm
              ? `No course matches "${searchTerm}". Try a different keyword.`
              : "You do not currently have any active NBI Institute courses assigned to your tutor account. Contact an administrator if you believe this is an error."}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              style={{
                padding: "0.5rem 1.25rem",
                backgroundColor: "#2563EB",
                color: "#FFF",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Clear Search Filter
            </button>
          )}
        </div>
      )}

      {/* Course Cards Grid */}
      {!loading && !error && filteredCourses.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "0.875rem",
                border: "1px solid #E2E8F0",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.04)",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "all 0.2s ease-in-out",
              }}
              className="course-card-hover"
            >
              <div>
                {/* Course Header Badges */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.85rem" }}>
                  <span
                    style={{
                      padding: "0.3rem 0.65rem",
                      backgroundColor: "#EFF6FF",
                      color: "#1D4ED8",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #BFDBFE",
                      letterSpacing: "0.025em",
                    }}
                  >
                    {course.course_code}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#475569",
                      backgroundColor: "#F1F5F9",
                      padding: "0.25rem 0.6rem",
                      borderRadius: "0.25rem",
                      fontWeight: 500,
                    }}
                  >
                    {course.programme || "ICT & Tech Program"}
                  </span>
                </div>

                {/* Course Title */}
                <h3
                  onClick={() => navigate(`/lecturer/courses/${course.id}`)}
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    margin: "0 0 0.5rem 0",
                    cursor: "pointer",
                    lineHeight: 1.35,
                  }}
                >
                  {course.course_name}
                </h3>

                {/* Quick Metrics */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                    margin: "1.25rem 0",
                    backgroundColor: "#F8FAFC",
                    padding: "0.85rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #F1F5F9",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <HiOutlineUsers style={{ color: "#2563EB", fontSize: "1.25rem" }} />
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1E293B" }}>
                        {course.enrolled_students}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>Enrolled Students</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <HiOutlineQrCode style={{ color: "#059669", fontSize: "1.25rem" }} />
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1E293B" }}>
                        {course.total_sessions}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>Total Sessions</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "1rem", marginTop: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <button
                    onClick={() => navigate(`/lecturer/qr-attendance?courseId=${course.id}`)}
                    style={{
                      flex: 1,
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "#059669",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "0.5rem",
                      fontSize: "0.825rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <HiOutlineQrCode style={{ fontSize: "1rem" }} />
                    Start QR
                  </button>

                  <button
                    onClick={() => navigate(`/lecturer/reports?courseId=${course.id}`)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "#F1F5F9",
                      color: "#334155",
                      border: "1px solid #CBD5E1",
                      borderRadius: "0.5rem",
                      fontSize: "0.825rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <HiOutlineChartBarSquare style={{ fontSize: "1rem" }} />
                    Reports
                  </button>

                  <button
                    onClick={() => navigate(`/lecturer/assistant`)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "#F1F5F9",
                      color: "#334155",
                      border: "1px solid #CBD5E1",
                      borderRadius: "0.5rem",
                      fontSize: "0.825rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                    title="Ask AI Assistant about this course"
                  >
                    <HiOutlineChatBubbleLeftEllipsis style={{ fontSize: "1rem" }} />
                  </button>
                </div>

                <Link
                  to={`/lecturer/courses/${course.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.4rem",
                    width: "100%",
                    padding: "0.6rem",
                    backgroundColor: "#2563EB",
                    color: "#FFFFFF",
                    borderRadius: "0.5rem",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    textDecoration: "none",
                  }}
                >
                  Manage Roster & Course Details
                  <HiOutlineArrowRight style={{ fontSize: "0.95rem" }} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
