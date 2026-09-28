import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  HiOutlineBookOpen,
  HiOutlineUsers,
  HiOutlineUserPlus,
  HiOutlineTrash,
  HiOutlineQrCode,
  HiOutlineChartBarSquare,
  HiOutlineArrowLeft,
  HiOutlineMagnifyingGlass,
  HiOutlineCheckCircle,
  HiOutlineXMark,
  HiOutlineExclamationTriangle,
  HiOutlineCheck,
} from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";
import {
  getLecturerCourseDetail,
  type LecturerCourseDetail as ILecturerCourseDetail,
  searchStudents,
  type StudentSearchResult,
  enrollStudentInCourse,
  removeStudentFromCourse,
} from "../services/coursesService";

type TabType = "overview" | "roster" | "sessions" | "reports";

export default function LecturerCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>("roster");
  const [courseDetail, setCourseDetail] = useState<ILecturerCourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");

  // Add Student Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [submittingEnrollment, setSubmittingEnrollment] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Remove Student confirmation
  const [removingStudentId, setRemovingStudentId] = useState<number | null>(null);
  const [removingName, setRemovingName] = useState<string>("");

  const lecturerId = user?.linked_id || "me";

  useEffect(() => {
    if (courseId) {
      fetchCourseDetail();
    }
  }, [courseId, lecturerId]);

  async function fetchCourseDetail() {
    if (!courseId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getLecturerCourseDetail(lecturerId, courseId);
      setCourseDetail(data);
    } catch (err: any) {
      console.error("Error fetching course detail:", err);
      setError(err.message || "Failed to load course details.");
    } finally {
      setLoading(false);
    }
  }

  // Handle student search in Add Modal
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (studentQuery.trim().length >= 2) {
        setSearching(true);
        try {
          const results = await searchStudents(studentQuery);
          setSearchResults(results);
        } catch (err) {
          console.error("Search error:", err);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentQuery]);

  async function handleEnrollSubmit() {
    if (!selectedStudent || !courseId) return;
    try {
      setSubmittingEnrollment(true);
      setActionError(null);
      await enrollStudentInCourse(Number(courseId), selectedStudent.id);
      setActionSuccess(`${selectedStudent.full_name} has been enrolled successfully!`);
      setShowAddModal(false);
      setSelectedStudent(null);
      setStudentQuery("");
      fetchCourseDetail();
    } catch (err: any) {
      console.error("Enrollment error:", err);
      setActionError(err.message || "Failed to enroll student.");
    } finally {
      setSubmittingEnrollment(false);
    }
  }

  async function handleRemoveConfirm() {
    if (!removingStudentId || !courseId) return;
    try {
      setActionError(null);
      await removeStudentFromCourse(Number(courseId), removingStudentId);
      setActionSuccess(`${removingName} was removed from the course roster.`);
      setRemovingStudentId(null);
      fetchCourseDetail();
    } catch (err: any) {
      console.error("Removal error:", err);
      setActionError(err.message || "Failed to remove student.");
    }
  }

  const filteredStudents = (courseDetail?.students || []).filter(
    (s) =>
      s.full_name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      s.student_number.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      s.programme.toLowerCase().includes(rosterSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="page-container" style={{ padding: "3rem 2rem", textAlign: "center", color: "#64748B" }}>
        <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
        <p>Loading NBI course information...</p>
      </div>
    );
  }

  if (error || !courseDetail) {
    return (
      <div className="page-container" style={{ padding: "2rem" }}>
        <Link to="/lecturer/courses" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#2563EB", textDecoration: "none", fontWeight: 600, marginBottom: "1.5rem" }}>
          <HiOutlineArrowLeft /> Back to My Courses
        </Link>
        <div style={{ padding: "1.5rem", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "0.75rem", color: "#991B1B" }}>
          {error || "Course not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: "1.5rem 2rem" }}>
      {/* Breadcrumb & Navigation */}
      <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#64748B" }}>
        <Link to="/lecturer/courses" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 500 }}>
          My Courses
        </Link>
        <span>/</span>
        <span style={{ color: "#1E293B", fontWeight: 600 }}>{courseDetail.course_code}</span>
      </div>

      {/* Course Banner / Header */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "0.875rem",
          border: "1px solid #E2E8F0",
          boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
          padding: "1.75rem",
          marginBottom: "1.75rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
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
                {courseDetail.course_code}
              </span>
              <span style={{ fontSize: "0.8rem", color: "#475569", backgroundColor: "#F1F5F9", padding: "0.25rem 0.6rem", borderRadius: "0.25rem", fontWeight: 500 }}>
                {courseDetail.programme || "NBI Practical Program"}
              </span>
            </div>
            <h1 style={{ fontSize: "1.65rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.5rem 0" }}>
              {courseDetail.course_name}
            </h1>
            <p style={{ color: "#64748B", fontSize: "0.9rem", margin: 0 }}>
              Tutor: <strong>{courseDetail.lecturer_name}</strong> • Total Recorded Sessions: <strong>{courseDetail.total_sessions}</strong>
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate(`/lecturer/qr-attendance?courseId=${courseDetail.id}`)}
              style={{
                padding: "0.6rem 1.1rem",
                backgroundColor: "#059669",
                color: "#FFF",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <HiOutlineQrCode style={{ fontSize: "1.1rem" }} />
              Start QR Session
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: "0.6rem 1.1rem",
                backgroundColor: "#2563EB",
                color: "#FFF",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <HiOutlineUserPlus style={{ fontSize: "1.1rem" }} />
              Add Student to Class
            </button>
          </div>
        </div>
      </div>

      {/* Alert Notifications */}
      {actionSuccess && (
        <div style={{ padding: "0.85rem 1.25rem", backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "0.5rem", color: "#065F46", marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <HiOutlineCheckCircle style={{ fontSize: "1.25rem" }} />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#065F46" }}>
            <HiOutlineXMark />
          </button>
        </div>
      )}

      {actionError && (
        <div style={{ padding: "0.85rem 1.25rem", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "0.5rem", color: "#991B1B", marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <HiOutlineExclamationTriangle style={{ fontSize: "1.25rem" }} />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B" }}>
            <HiOutlineXMark />
          </button>
        </div>
      )}

      {/* Tabs Header */}
      <div style={{ borderBottom: "1px solid #E2E8F0", marginBottom: "1.5rem", display: "flex", gap: "1.5rem" }}>
        {[
          { key: "roster", label: `Course Roster (${courseDetail.students.length})`, icon: <HiOutlineUsers /> },
          { key: "overview", label: "Overview & Analytics", icon: <HiOutlineBookOpen /> },
          { key: "sessions", label: `Session History (${courseDetail.recent_sessions.length})`, icon: <HiOutlineQrCode /> },
          { key: "reports", label: "Attendance Reports", icon: <HiOutlineChartBarSquare /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            style={{
              padding: "0.75rem 0.25rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.key ? "2px solid #2563EB" : "2px solid transparent",
              color: activeTab === tab.key ? "#2563EB" : "#64748B",
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: "0.95rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              transition: "all 0.15s ease",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: ROSTER */}
      {activeTab === "roster" && (
        <div>
          {/* Controls Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ position: "relative", minWidth: "280px" }}>
              <HiOutlineMagnifyingGlass style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
              <input
                type="text"
                placeholder="Search roster by student name or ID..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.55rem 1rem 0.55rem 2.4rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.875rem",
                  outline: "none",
                  backgroundColor: "#FFF",
                }}
              />
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: "0.55rem 1rem",
                backgroundColor: "#2563EB",
                color: "#FFF",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <HiOutlineUserPlus style={{ fontSize: "1rem" }} />
              + Add Student
            </button>
          </div>

          {/* Roster Table */}
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: "0.75rem", border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569", fontWeight: 600 }}>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Student Name</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Student ID</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Email</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Programme</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Attended Sessions</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Attendance Rate</th>
                  <th style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "2.5rem 1.25rem", textAlign: "center", color: "#64748B" }}>
                      No students found in course roster.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => (
                    <tr key={st.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "0.85rem 1.25rem", fontWeight: 600, color: "#0F172A" }}>
                        {st.full_name}
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", color: "#475569", fontFamily: "monospace", fontSize: "0.85rem" }}>
                        {st.student_number}
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", color: "#64748B" }}>{st.email}</td>
                      <td style={{ padding: "0.85rem 1.25rem", color: "#475569" }}>{st.programme}</td>
                      <td style={{ padding: "0.85rem 1.25rem", fontWeight: 500, color: "#1E293B" }}>
                        {st.total_attended} / {courseDetail.total_sessions}
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem" }}>
                        <span
                          style={{
                            padding: "0.25rem 0.6rem",
                            borderRadius: "0.25rem",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            backgroundColor:
                              st.attendance_rate >= 75
                                ? "#ECFDF5"
                                : st.attendance_rate >= 50
                                ? "#FEF3C7"
                                : "#FEF2F2",
                            color:
                              st.attendance_rate >= 75
                                ? "#065F46"
                                : st.attendance_rate >= 50
                                ? "#92400E"
                                : "#991B1B",
                          }}
                        >
                          {st.attendance_rate}%
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                        <button
                          onClick={() => {
                            setRemovingStudentId(st.id);
                            setRemovingName(st.full_name);
                          }}
                          style={{
                            padding: "0.35rem 0.6rem",
                            backgroundColor: "#FEF2F2",
                            color: "#DC2626",
                            border: "1px solid #FECACA",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            fontWeight: 500,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                          title="Remove student from course roster"
                        >
                          <HiOutlineTrash />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
          <div style={{ backgroundColor: "#FFF", padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid #E2E8F0" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#1E293B", marginBottom: "0.75rem" }}>Roster Summary</h3>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2563EB" }}>{courseDetail.enrolled_students}</div>
            <p style={{ color: "#64748B", fontSize: "0.875rem", margin: 0 }}>Active students enrolled in this NBI course module</p>
          </div>

          <div style={{ backgroundColor: "#FFF", padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid #E2E8F0" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#1E293B", marginBottom: "0.75rem" }}>Attendance Metric</h3>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#059669" }}>{courseDetail.total_sessions}</div>
            <p style={{ color: "#64748B", fontSize: "0.875rem", margin: 0 }}>Total completed QR attendance sessions</p>
          </div>
        </div>
      )}

      {/* TAB: SESSIONS */}
      {activeTab === "sessions" && (
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: "0.75rem", border: "1px solid #E2E8F0", padding: "1.25rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 1rem 0" }}>Recent Course Sessions</h3>
          {courseDetail.recent_sessions.length === 0 ? (
            <p style={{ color: "#64748B" }}>No session history recorded for this course yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {courseDetail.recent_sessions.map((sess) => (
                <div key={sess.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1rem", backgroundColor: "#F8FAFC", borderRadius: "0.5rem", border: "1px solid #E2E8F0" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#0F172A" }}>{new Date(sess.session_date).toLocaleDateString("en-GB", { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                    <div style={{ fontSize: "0.8rem", color: "#64748B" }}>{sess.start_time} - {sess.end_time}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ fontWeight: 600, color: "#059669" }}>{sess.present_count} Attended</span>
                    <span style={{ padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: 600, backgroundColor: sess.is_active ? "#DCFCE7" : "#F1F5F9", color: sess.is_active ? "#15803D" : "#64748B" }}>
                      {sess.is_active ? "ACTIVE" : "CLOSED"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: REPORTS */}
      {activeTab === "reports" && (
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: "0.75rem", border: "1px solid #E2E8F0", padding: "2rem", textAlign: "center" }}>
          <HiOutlineChartBarSquare style={{ fontSize: "3rem", color: "#2563EB", marginBottom: "1rem" }} />
          <h3 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#0F172A", marginBottom: "0.5rem" }}>Generate Course Attendance Report</h3>
          <p style={{ color: "#64748B", maxWidth: "480px", margin: "0 auto 1.5rem auto", fontSize: "0.9rem" }}>
            View comprehensive attendance percentage breakdowns, breakdown per student, and export reports for {courseDetail.course_name}.
          </p>
          <button
            onClick={() => navigate(`/lecturer/reports?courseId=${courseDetail.id}`)}
            style={{
              padding: "0.65rem 1.25rem",
              backgroundColor: "#2563EB",
              color: "#FFF",
              border: "none",
              borderRadius: "0.5rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Open Course Reports
          </button>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: "0.875rem", maxWidth: "520px", width: "100%", padding: "1.75rem", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <HiOutlineUserPlus style={{ color: "#2563EB" }} />
                Add Student to {courseDetail.course_code}
              </h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <HiOutlineXMark style={{ fontSize: "1.5rem" }} />
              </button>
            </div>

            <p style={{ color: "#64748B", fontSize: "0.875rem", marginBottom: "1rem" }}>
              Search for registered NBI Institute students by name, email, or student ID number to enroll them in this course.
            </p>

            <div style={{ position: "relative", marginBottom: "1.25rem" }}>
              <HiOutlineMagnifyingGlass style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
              <input
                type="text"
                placeholder="Type student name (e.g. Oyedele)..."
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.65rem 1rem 0.65rem 2.5rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
            </div>

            {/* Search Results */}
            <div style={{ maxHeight: "220px", overflowY: "auto", border: "1px solid #F1F5F9", borderRadius: "0.5rem", marginBottom: "1.25rem" }}>
              {searching ? (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748B", fontSize: "0.875rem" }}>Searching student database...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStudent(st)}
                    style={{
                      padding: "0.75rem 1rem",
                      borderBottom: "1px solid #F1F5F9",
                      cursor: "pointer",
                      backgroundColor: selectedStudent?.id === st.id ? "#EFF6FF" : "#FFFFFF",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "#1E293B", fontSize: "0.9rem" }}>{st.full_name}</div>
                      <div style={{ fontSize: "0.8rem", color: "#64748B" }}>{st.student_number} • {st.email}</div>
                    </div>
                    {selectedStudent?.id === st.id && (
                      <HiOutlineCheck style={{ color: "#2563EB", fontWeight: "bold" }} />
                    )}
                  </div>
                ))
              ) : studentQuery.trim().length >= 2 ? (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748B", fontSize: "0.875rem" }}>No matching student found.</div>
              ) : (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "#94A3B8", fontSize: "0.85rem" }}>Type at least 2 characters to search.</div>
              )}
            </div>

            {/* Selected confirmation preview */}
            {selectedStudent && (
              <div style={{ padding: "0.85rem", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "0.5rem", marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#166534" }}>Ready to Enroll:</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#065F46" }}>{selectedStudent.full_name}</div>
                <div style={{ fontSize: "0.8rem", color: "#15803D" }}>Student ID: {selectedStudent.student_number}</div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: "0.55rem 1rem",
                  backgroundColor: "#F1F5F9",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  borderRadius: "0.5rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollSubmit}
                disabled={!selectedStudent || submittingEnrollment}
                style={{
                  padding: "0.55rem 1.25rem",
                  backgroundColor: selectedStudent ? "#2563EB" : "#94A3B8",
                  color: "#FFF",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  cursor: selectedStudent && !submittingEnrollment ? "pointer" : "not-allowed",
                }}
              >
                {submittingEnrollment ? "Enrolling..." : "Confirm Enrollment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE CONFIRMATION MODAL */}
      {removingStudentId && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: "0.875rem", maxWidth: "440px", width: "100%", padding: "1.5rem", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#991B1B", margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <HiOutlineExclamationTriangle />
              Confirm Roster Removal
            </h3>
            <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "1.25rem" }}>
              Are you sure you want to remove <strong>{removingName}</strong> from this course roster? The student will no longer be able to check in to QR attendance for {courseDetail.course_code}.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                onClick={() => setRemovingStudentId(null)}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#F1F5F9",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  borderRadius: "0.5rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveConfirm}
                style={{
                  padding: "0.5rem 1.1rem",
                  backgroundColor: "#DC2626",
                  color: "#FFF",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Remove Student
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
