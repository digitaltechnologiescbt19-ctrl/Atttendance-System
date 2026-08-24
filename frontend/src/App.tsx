// React default import not required with the new JSX runtime
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AppLayout          from "./components/Layout/AppLayout";
import Login              from "./pages/Login";
import VerifyEmail        from "./pages/VerifyEmail";

/* ── Admin pages ── */
import Dashboard          from "./pages/Dashboard";         // admin dashboard
import Students           from "./pages/Students";
import Lecturers          from "./pages/Lecturers";
import Courses            from "./pages/Courses";
import Attendance         from "./pages/Attendance";
import Reports            from "./pages/Reports";
import Insights           from "./pages/Insights";
import Settings           from "./pages/Settings";
import Administrators     from "./pages/Administrators";
import Assistant          from "./pages/Assistant";

/* ── Lecturer pages ── */
import LecturerDashboard  from "./pages/LecturerDashboard";
import QRAttendance       from "./pages/QRAttendance";
import LecturerSettings   from "./pages/LecturerSettings";
import StudentSettings    from "./pages/StudentSettings";

/* ── Student pages ── */
import StudentDashboard   from "./pages/StudentDashboard";
import Profile            from "./pages/Profile";

import type { UserRole } from "./context/AuthContext";

/* ------------------------------------------------------------------ */
/*  Route guards                                                        */
/* ------------------------------------------------------------------ */

/**
 * RequireAuth
 * - If the user is not authenticated → redirect to /login
 * - If allowedRoles is supplied and the user's role is not in the list
 *   → redirect to their role home (not a 404, not a blank page)
 */
function RequireAuth({ allowedRoles }: { allowedRoles?: UserRole[] }) {
  const { isAuthenticated, user, roleHome } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome()} replace />;
  }

  return <Outlet />;
}

/**
 * RedirectIfAuthenticated
 * Prevents logged-in users from seeing the login / verify pages.
 */
function RedirectIfAuthenticated() {
  const { isAuthenticated, roleHome } = useAuth();
  if (isAuthenticated) return <Navigate to={roleHome()} replace />;
  return <Outlet />;
}

/* ------------------------------------------------------------------ */
/*  App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ═══════════════════════════════════════════════════════════
            PUBLIC  — redirect away if already authenticated
        ═══════════════════════════════════════════════════════════ */}
        <Route element={<RedirectIfAuthenticated />}>
          <Route path="/login"        element={<Login />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Route>


        {/* ═══════════════════════════════════════════════════════════
            ADMIN ROUTES   /admin/*
            All behind RequireAuth allowedRoles=["admin"]
        ═══════════════════════════════════════════════════════════ */}
        <Route element={<RequireAuth allowedRoles={["admin"]} />}>
          <Route element={<AppLayout />}>
            {/* Admin dashboard */}
            <Route path="/admin/dashboard"    element={<Dashboard />} />

            {/* Institution-wide management */}
            <Route path="/admin/students"     element={<Students />} />
            <Route path="/admin/lecturers"    element={<Lecturers />} />
            <Route path="/admin/courses"      element={<Courses />} />
            <Route path="/admin/attendance"   element={<Attendance />} />
            <Route path="/admin/reports"      element={<Reports />} />
            <Route path="/admin/insights"     element={<Insights />} />
            <Route path="/admin/settings"     element={<Settings />} />
            <Route path="/admin/administrators" element={<Administrators />} />
            <Route path="/admin/assistant"    element={<Assistant />} />

            {/* Admin: /admin → redirect to dashboard */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          </Route>
        </Route>


        {/* ═══════════════════════════════════════════════════════════
            LECTURER ROUTES   /lecturer/*
            All behind RequireAuth allowedRoles=["lecturer"]
        ═══════════════════════════════════════════════════════════ */}
        <Route element={<RequireAuth allowedRoles={["lecturer"]} />}>
          <Route element={<AppLayout />}>
            {/* Lecturer dashboard */}
            <Route path="/lecturer/dashboard"      element={<LecturerDashboard />} />

            {/* Lecturer-specific tools */}
            <Route path="/lecturer/qr-attendance"  element={<QRAttendance />} />
            <Route path="/lecturer/attendance"     element={<Attendance />} />
            <Route path="/lecturer/reports"        element={<Reports />} />
            <Route path="/lecturer/insights"       element={<Insights />} />
            <Route path="/lecturer/settings"       element={<LecturerSettings />} />
            <Route path="/lecturer/assistant"      element={<Assistant />} />

            {/* /lecturer → dashboard */}
            <Route path="/lecturer" element={<Navigate to="/lecturer/dashboard" replace />} />
          </Route>
        </Route>


        {/* ═══════════════════════════════════════════════════════════
            STUDENT ROUTES   /student/*
            All behind RequireAuth allowedRoles=["student"]
        ═══════════════════════════════════════════════════════════ */}
        <Route element={<RequireAuth allowedRoles={["student"]} />}>
          <Route element={<AppLayout />}>
            {/* Student dashboard */}
            <Route path="/student/dashboard"   element={<StudentDashboard />} />

            {/* Student tools — read-only attendance, scan */}
            <Route path="/student/attendance"  element={<Attendance />} />
            <Route path="/student/reports"     element={<Reports />} />
            <Route path="/student/insights"    element={<Insights />} />
            <Route path="/student/assistant"   element={<Assistant />} />

            <Route path="/student/settings"    element={<StudentSettings />} />
            {/* Unified profile for all roles */}
            <Route path="/profile" element={<Profile />} />

            {/* QR scan page — student scans, does NOT generate */}
            <Route path="/student/scan"        element={<QRAttendance />} />

            {/* /student → dashboard */}
            <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
          </Route>
        </Route>


        {/* ═══════════════════════════════════════════════════════════
            LEGACY / FLAT ROUTE COMPATIBILITY
            Old flat paths like /dashboard still work for any
            authenticated user — they redirect to role-prefixed home.
            This prevents 404s if any link still uses the old paths.
        ═══════════════════════════════════════════════════════════ */}
        <Route element={<RequireAuth />}>
          <Route
            path="/dashboard"
            element={<RoleRedirect />}
          />
          <Route path="/attendance"    element={<RoleRedirect />} />
          <Route path="/reports"       element={<RoleRedirect />} />
          <Route path="/insights"      element={<RoleRedirect />} />
          <Route path="/assistant"     element={<RoleRedirect />} />
          <Route path="/qr-attendance" element={<RoleRedirect />} />
          <Route path="/students"      element={<RoleRedirect />} />
          <Route path="/lecturers"     element={<RoleRedirect />} />
          <Route path="/courses"       element={<RoleRedirect />} />
          <Route path="/settings"      element={<RoleRedirect />} />
        </Route>


        {/* ═══════════════════════════════════════════════════════════
            DEFAULT — root and unmatched → login
        ═══════════════════════════════════════════════════════════ */}
        <Route index element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

/**
 * RoleRedirect
 * Used on legacy flat paths (e.g. /dashboard) so that any bookmarked
 * or hardcoded link still works — it simply redirects to the
 * authenticated user's role-specific home.
 */
function RoleRedirect() {
  const { roleHome } = useAuth();
  return <Navigate to={roleHome()} replace />;
}