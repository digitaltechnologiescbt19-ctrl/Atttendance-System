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
