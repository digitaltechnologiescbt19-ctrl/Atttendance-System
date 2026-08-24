import { useState } from "react";
import { useNavigate } from "react-router-dom";

type Role = "student" | "lecturer" | "admin";

export default function Login() {
  const navigate = useNavigate();

  const [role, setRole] = useState<Role>("student");

  function handleLogin(event: React.FormEvent) {
    event.preventDefault();

    if (role === "student") {
      navigate("/student");
    }

    if (role === "lecturer") {
      navigate("/lecturer");
    }

    if (role === "admin") {
      navigate("/admin");
    }
  }

  return (
    <div className="attendance-login">
      <div className="attendance-login-card">

        <div className="attendance-logo">
          NBI
        </div>

        <h1>NBI Institute</h1>

        <p className="attendance-subtitle">
          Smart Attendance System
        </p>

        <div className="role-tabs">

          <button
            type="button"
            className={role === "student" ? "active" : ""}
            onClick={() => setRole("student")}
          >
            Student
          </button>

          <button
            type="button"
            className={role === "lecturer" ? "active" : ""}
            onClick={() => setRole("lecturer")}
          >
            Lecturer
          </button>

          <button
            type="button"
            className={role === "admin" ? "active" : ""}
            onClick={() => setRole("admin")}
          >
            Admin
          </button>

        </div>

        <form onSubmit={handleLogin}>

          <label>
            {role === "student"
              ? "Student Number"
              : role === "lecturer"
              ? "Staff ID"
              : "Admin ID"}
          </label>

          <input
            type="text"
            placeholder={
              role === "student"
                ? "Enter student number"
                : role === "lecturer"
                ? "Enter staff ID"
                : "Enter admin ID"
            }
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter password"
          />

          <button
            type="submit"
            className="attendance-login-button"
          >
            Sign in
          </button>

        </form>

        <div className="login-ai">
          <strong>AI Assistant</strong>
          <span>
            Get help with NBI Institute information from inside the platform.
          </span>
        </div>

      </div>
    </div>
  );
}