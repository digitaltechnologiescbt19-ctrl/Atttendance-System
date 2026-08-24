import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  HiBars3,
  HiBell,
  HiChevronDown,
  HiMagnifyingGlass,
  HiOutlineSun,
  HiOutlineMoon,
} from "react-icons/hi2";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

/* ------------------------------------------------------------------ */
/*  Route → page title map                                              */
/* ------------------------------------------------------------------ */

const routeLabels: Record<string, string> = {
  /* ── Admin ── */
  "/admin/dashboard":    "Dashboard",
  "/admin/students":     "Students",
  "/admin/lecturers":    "Lecturers",
  "/admin/courses":      "Courses",
  "/admin/attendance":   "Attendance",
  "/admin/reports":      "Reports",
  "/admin/insights":     "Insights",
  "/admin/settings":     "Settings",
  "/admin/assistant":    "AI Assistant",

  /* ── Lecturer ── */
  "/lecturer/dashboard":     "Dashboard",
  "/lecturer/qr-attendance": "QR Attendance",
  "/lecturer/attendance":    "Attendance",
  "/lecturer/reports":       "Reports",
  "/lecturer/insights":      "Insights",
  "/lecturer/assistant":     "AI Assistant",

  /* ── Student ── */
  "/student/dashboard":   "Dashboard",
  "/student/scan":        "Scan QR",
  "/student/attendance":  "My Attendance",
  "/student/reports":     "Reports",
  "/student/assistant":   "AI Assistant",

  /* ── Legacy flat paths (kept for backward compatibility) ── */
  "/":              "Dashboard",
  "/dashboard":     "Dashboard",
  "/students":      "Students",
  "/lecturers":     "Lecturers",
  "/courses":       "Courses",
  "/attendance":    "Attendance",
  "/qr-attendance": "QR Attendance",
  "/reports":       "Reports",
  "/insights":      "Insights",
  "/assistant":     "AI Assistant",
  "/settings":      "Settings",
};

/* ------------------------------------------------------------------ */
/*  Role label shown below the user's name                             */
/* ------------------------------------------------------------------ */

function roleLabel(role: string | undefined): string {
  switch (role) {
    case "admin":    return "System Admin";
    case "lecturer": return "Lecturer";
    case "student":  return "Student";
    default:         return "";
  }
}

/** Derive 1–2 letter initials from a name string */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/* ------------------------------------------------------------------ */
/*  Notification button                                                 */
/* ------------------------------------------------------------------ */

function NotificationBtn() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        className="topbar-icon-btn"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label="Open notifications"
      >
        <HiBell />
        <span className="topbar-notif-dot" />
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 98 }}
            onClick={() => setOpen(false)}
          />
          <div className="dropdown" style={{ minWidth: 260 }}>
            <div
              style={{
                padding:      "12px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                fontSize:     "var(--tx-sm)",
                fontWeight:   600,
                color:        "var(--text-primary)",
              }}
            >
              Notifications
            </div>
            <div
              style={{
                padding:   "28px 16px",
                textAlign: "center",
                fontSize:  "var(--tx-sm)",
                color:     "var(--text-muted)",
              }}
            >
              No new notifications
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  User menu — wired to AuthContext                                    */
/* ------------------------------------------------------------------ */

function UserMenu() {
  const [open, setOpen]   = useState(false);
  const { user, logout }  = useAuth();
  const navigate          = useNavigate();

  const displayName = user?.name ?? "Account";
  const displayRole = roleLabel(user?.role);
  const avatarText  = initials(displayName);

  function handleSignOut() {
    setOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="topbar-user"
        onClick={() => setOpen((o) => !o)}
        aria-label="User menu"
        aria-expanded={open}
      >
        <div className="topbar-avatar">{avatarText}</div>

        <div className="topbar-user-info">
          <div className="topbar-user-name">{displayName}</div>
          {displayRole && (
            <div className="topbar-user-role">{displayRole}</div>
          )}
        </div>

        <HiChevronDown
          style={{
            fontSize:   13,
            color:      "var(--text-muted)",
            transition: "transform var(--t-fast)",
            transform:  open ? "rotate(180deg)" : "rotate(0deg)",
            marginLeft: 2,
          }}
        />
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 98 }}
            onClick={() => setOpen(false)}
          />
          <div className="dropdown">
            <button
              className="dropdown-item"
              onClick={() => {
                setOpen(false);
                navigate("/profile");
              }}
            >
              Profile
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                setOpen(false);
                if (user?.role === "admin") navigate("/admin/settings");
                else if (user?.role === "lecturer") navigate("/lecturer/settings");
                else if (user?.role === "student") navigate("/student/settings");
                else navigate("/");
              }}
            >
              Settings
            </button>
            <div className="dropdown-divider" />
            <button
              className="dropdown-item danger"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Topbar                                                              */
/* ------------------------------------------------------------------ */

interface TopbarProps {
  onMenuToggle: () => void;
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const location               = useLocation();
  const { theme, toggleTheme } = useTheme();
  const label = routeLabels[location.pathname] ?? "NBI Institute";

  return (
    <header className="topbar">
      {/* Sidebar toggle */}
      <button
        className="topbar-menu-btn"
        onClick={onMenuToggle}
        title="Toggle menu"
        aria-label="Toggle sidebar"
      >
        <HiBars3 />
      </button>

      {/* Current page title */}
      <span
        style={{
          fontSize:   "var(--tx-md)",
          fontWeight: 700,
          color:      "var(--text-primary)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {label}
      </span>

      {/* Search */}
      <div className="topbar-search">
        <span className="topbar-search-icon">
          <HiMagnifyingGlass />
        </span>
        <input
          type="text"
          placeholder="Search students, courses, attendance…"
          aria-label="Search"
        />
      </div>

      {/* Right controls */}
      <div className="topbar-right">
        {/* Theme toggle — wired to ThemeContext */}
        <button
          className="topbar-icon-btn"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <HiOutlineSun /> : <HiOutlineMoon />}
        </button>

        <NotificationBtn />
        <div className="topbar-divider" />
        <UserMenu />
      </div>
    </header>
  );
}
