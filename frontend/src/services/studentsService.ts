/**
 * studentsService.ts
 * All calls require a valid JWT — the token is read from whichever
 * storage the AuthContext used (localStorage takes precedence over
 * sessionStorage to match AuthContext.loadToken() logic).
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

export interface Student {
  id: number;
  student_number: string;
  full_name: string;
  email: string;
  programme: string;
  created_at?: string;
}

export interface CreateStudentDTO {
  student_number: string;
  full_name: string;
  email: string;
  programme: string;
}

export interface UpdateStudentDTO {
  student_number: string;
  full_name: string;
  email: string;
  programme: string;
}

export async function getStudents(): Promise<Student[]> {
  const res = await fetch(`${API_URL}/students`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch students");
  }
  return res.json();
}

export async function getStudent(id: number): Promise<Student> {
  const res = await fetch(`${API_URL}/students/${id}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch student");
  }
  return res.json();
}

export async function createStudent(
  data: CreateStudentDTO
): Promise<{ message: string; student: Student }> {
  const res = await fetch(`${API_URL}/students`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({ message: "Failed to create student" }));
  if (!res.ok) throw new Error(json.message || "Failed to create student");
  return json;
}

export async function updateStudent(
  id: number,
  data: UpdateStudentDTO
): Promise<{ message: string; student: Student }> {
  const res = await fetch(`${API_URL}/students/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({ message: "Failed to update student" }));
  if (!res.ok) throw new Error(json.message || "Failed to update student");
  return json;
}

export async function deleteStudent(
  id: number
): Promise<{ message: string; student: Student }> {
  const res = await fetch(`${API_URL}/students/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({ message: "Failed to delete student" }));
  if (!res.ok) throw new Error(json.message || "Failed to delete student");
  return json;
}
