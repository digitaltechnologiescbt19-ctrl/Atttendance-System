/**
 * coursesService.ts
 * All calls require a valid JWT.
 */

const API_URL = `${import.meta.env.VITE_API_URL ?? ""}/api/attendance`;

function authHeaders(): HeadersInit {
  const token =
    localStorage.getItem("nbi-auth-token") ||
    sessionStorage.getItem("nbi-auth-token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface Course {
  id: number;
  course_code: string;
  course_name: string;
  programme: string;
  lecturer_id: number | null;
  lecturer_name?: string | null;
  lecturer_number?: string | null;
  created_at?: string;
}

export interface CreateCourseDTO {
  course_code: string;
  course_name: string;
  programme: string;
  lecturer_id?: number | null;
}

export interface UpdateCourseDTO {
  course_code: string;
  course_name: string;
  programme: string;
  lecturer_id?: number | null;
}

export async function getCourses(): Promise<Course[]> {
  const res = await fetch(`${API_URL}/courses`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch courses");
  }
  return res.json();
}

export async function getCourse(id: number): Promise<Course> {
  const res = await fetch(`${API_URL}/courses/${id}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch course");
  }
  return res.json();
}

export async function createCourse(
  data: CreateCourseDTO
): Promise<{ message: string; course: Course }> {
  const res = await fetch(`${API_URL}/courses`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({ message: "Failed to create course" }));
  if (!res.ok) throw new Error(json.message || "Failed to create course");
  return json;
}

export async function updateCourse(
  id: number,
  data: UpdateCourseDTO
): Promise<{ message: string; course: Course }> {
  const res = await fetch(`${API_URL}/courses/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({ message: "Failed to update course" }));
  if (!res.ok) throw new Error(json.message || "Failed to update course");
  return json;
}

export async function deleteCourse(
  id: number
): Promise<{ message: string; course: Course }> {
  const res = await fetch(`${API_URL}/courses/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({ message: "Failed to delete course" }));
  if (!res.ok) throw new Error(json.message || "Failed to delete course");
  return json;
}

export interface LecturerCourseItem {
  id: number;
  course_code: string;
  course_name: string;
  programme: string;
  enrolled_students: number;
  total_sessions: number;
}

export interface LecturerCourseDetail extends LecturerCourseItem {
  lecturer_name: string;
  students: Array<{
    id: number;
    student_number: string;
    full_name: string;
    email: string;
    programme: string;
    total_attended: number;
    attendance_rate: number;
  }>;
  recent_sessions: Array<{
    id: number;
    session_date: string;
    start_time: string;
    end_time: string;
    is_active: boolean;
    present_count: number;
  }>;
}

export interface StudentSearchResult {
  id: number;
  student_number: string;
  full_name: string;
  email: string;
  programme: string;
}

export interface StudentEnrolledCourse {
  id: number;
  course_code: string;
  course_name: string;
  programme: string;
  lecturer_name?: string | null;
  total_sessions: number;
  attended_sessions: number;
  attendance_rate: number;
  status: string;
}

export async function getLecturerCourses(lecturerId: number | string): Promise<LecturerCourseItem[]> {
  const res = await fetch(`${API_URL}/lecturers/${lecturerId}/courses`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch lecturer courses");
  }
  return res.json();
}

export async function getLecturerCourseDetail(
  lecturerId: number | string,
  courseId: number | string
): Promise<LecturerCourseDetail> {
  const res = await fetch(`${API_URL}/lecturers/${lecturerId}/courses/${courseId}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch course details");
  }
  return res.json();
}

export async function searchStudents(query: string): Promise<StudentSearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${API_URL}/students-search?q=${encodeURIComponent(query)}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to search students");
  }
  return res.json();
}

export async function enrollStudentInCourse(
  courseId: number,
  studentId: number
): Promise<{ message: string; enrollment: any }> {
  const res = await fetch(`${API_URL}/enrollments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ course_id: courseId, student_id: studentId }),
  });
  const json = await res.json().catch(() => ({ message: "Failed to enroll student" }));
  if (!res.ok) throw new Error(json.message || "Failed to enroll student");
  return json;
}

export async function removeStudentFromCourse(
  courseId: number,
  studentId: number
): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/enrollments/${courseId}/${studentId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({ message: "Failed to remove student" }));
  if (!res.ok) throw new Error(json.message || "Failed to remove student");
  return json;
}

export async function getStudentEnrolledCourses(studentId = "me"): Promise<StudentEnrolledCourse[]> {
  const res = await fetch(`${API_URL}/students/${studentId}/courses`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch enrolled courses");
  }
  return res.json();
}
