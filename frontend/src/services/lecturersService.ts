/**
 * lecturersService.ts
 * All calls require a valid JWT.
 */

const API_URL = "/api/attendance";

function authHeaders(): HeadersInit {
  const token =
    localStorage.getItem("nbi-auth-token") ||
    sessionStorage.getItem("nbi-auth-token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface Lecturer {
  id: number;
  lecturer_number: string;
  full_name: string;
  email: string;
  department: string;
  created_at?: string;
}

export interface CreateLecturerDTO {
  lecturer_number: string;
  full_name: string;
  email: string;
  department: string;
}

export interface UpdateLecturerDTO {
  lecturer_number: string;
  full_name: string;
  email: string;
  department: string;
}

export async function getLecturers(): Promise<Lecturer[]> {
  const res = await fetch(`${API_URL}/lecturers`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch lecturers");
  }
  return res.json();
}

export async function getLecturer(id: number): Promise<Lecturer> {
  const res = await fetch(`${API_URL}/lecturers/${id}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch lecturer");
  }
  return res.json();
}

export async function createLecturer(
  data: CreateLecturerDTO
): Promise<{ message: string; lecturer: Lecturer }> {
  const res = await fetch(`${API_URL}/lecturers`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({ message: "Failed to create lecturer" }));
  if (!res.ok) throw new Error(json.message || "Failed to create lecturer");
  return json;
}

export async function updateLecturer(
  id: number,
  data: UpdateLecturerDTO
): Promise<{ message: string; lecturer: Lecturer }> {
  const res = await fetch(`${API_URL}/lecturers/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({ message: "Failed to update lecturer" }));
  if (!res.ok) throw new Error(json.message || "Failed to update lecturer");
  return json;
}

export async function deleteLecturer(
  id: number
): Promise<{ message: string; lecturer: Lecturer }> {
  const res = await fetch(`${API_URL}/lecturers/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({ message: "Failed to delete lecturer" }));
  if (!res.ok) throw new Error(json.message || "Failed to delete lecturer");
  return json;
}
