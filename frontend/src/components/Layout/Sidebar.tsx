import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  HiOutlineSquares2X2,
  HiOutlineUsers,
  HiOutlineAcademicCap,
  HiOutlineBookOpen,
  HiOutlineClipboardDocumentList,
  HiOutlineQrCode,
  HiOutlineChartBarSquare,
  HiOutlineLightBulb,
  HiOutlineCog6Tooth,
  HiOutlineChatBubbleLeftEllipsis,
  HiOutlineShieldCheck,
  HiChevronLeft,
  HiChevronRight,
} from "react-icons/hi2";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../context/AuthContext";

/* ------------------------------------------------------------------ */
/*  Nav item                                                            */
/* ------------------------------------------------------------------ */

interface NavItem {
  label:  string;
  to:     string;
  icon:   React.ReactNode;
  /** Only these roles see this item. Omit = all roles that share this nav. */
  roles?: UserRole[];
}

/* ------------------------------------------------------------------ */
/*  Per-role nav definitions                                            */
/*                                                                      */
/*  Each role has its own fully-typed navigation.                       */
/*  Paths must exactly match the route tree in App.tsx.                 */
/*                                                                      */
/*  ADMIN    — institution-wide. NO QR generation.                     */
/*  LECTURER — their own sessions/QR. NO student/system mgmt.          */
/*  STUDENT  — own attendance only. NO QR generation.                  */
/* ------------------------------------------------------------------ */

const ADMIN_MAIN_NAV: NavItem[] = [
  { label: "Dashboard",     to: "/admin/dashboard",   icon: <HiOutlineSquares2X2 /> },
  { label: "Students",      to: "/admin/students",    icon: <HiOutlineUsers /> },
  { label: "Lecturers",     to: "/admin/lecturers",   icon: <HiOutlineAcademicCap /> },
  { label: "Courses",       to: "/admin/courses",     icon: <HiOutlineBookOpen /> },
  { label: "Attendance",    to: "/admin/attendance",  icon: <HiOutlineClipboardDocumentList /> },
  { label: "Reports",       to: "/admin/reports",     icon: <HiOutlineChartBarSquare /> },
  { label: "Insights",      to: "/admin/insights",    icon: <HiOutlineLightBulb /> },
];
const ADMIN_BOTTOM_NAV: NavItem[] = [
  { label: "Administrators", to: "/admin/administrators", icon: <HiOutlineShieldCheck /> },
  { label: "AI Assistant",   to: "/admin/assistant",      icon: <HiOutlineChatBubbleLeftEllipsis /> },
  { label: "Settings",       to: "/admin/settings",       icon: <HiOutlineCog6Tooth /> },
];

const LECTURER_MAIN_NAV: NavItem[] = [
  { label: "Dashboard",     to: "/lecturer/dashboard",     icon: <HiOutlineSquares2X2 /> },
  { label: "QR Attendance", to: "/lecturer/qr-attendance", icon: <HiOutlineQrCode /> },
  { label: "Attendance",    to: "/lecturer/attendance",    icon: <HiOutlineClipboardDocumentList /> },
  { label: "Reports",       to: "/lecturer/reports",       icon: <HiOutlineChartBarSquare /> },
  { label: "Insights",      to: "/lecturer/insights",      icon: <HiOutlineLightBulb /> },
];
const LECTURER_BOTTOM_NAV: NavItem[] = [
  { label: "AI Assistant",  to: "/lecturer/assistant",     icon: <HiOutlineChatBubbleLeftEllipsis /> },
  { label: "Settings",      to: "/lecturer/settings",      icon: <HiOutlineCog6Tooth /> },
];

const STUDENT_MAIN_NAV: NavItem[] = [
  { label: "Dashboard",     to: "/student/dashboard",  icon: <HiOutlineSquares2X2 /> },
  { label: "Scan QR",       to: "/student/scan",       icon: <HiOutlineQrCode /> },
  { label: "My Attendance", to: "/student/attendance", icon: <HiOutlineClipboardDocumentList /> },
  { label: "Reports",       to: "/student/reports",    icon: <HiOutlineChartBarSquare /> },
  { label: "Insights",      to: "/student/insights",   icon: <HiOutlineLightBulb /> },
];
const STUDENT_BOTTOM_NAV: NavItem[] = [
  { label: "AI Assistant",  to: "/student/assistant",  icon: <HiOutlineChatBubbleLeftEllipsis /> },
  { label: "Settings",      to: "/student/settings",    icon: <HiOutlineCog6Tooth /> },
];

function getNavForRole(role: UserRole | undefined): { main: NavItem[]; bottom: NavItem[] } {
  switch (role) {
    case "admin":    return { main: ADMIN_MAIN_NAV,    bottom: ADMIN_BOTTOM_NAV };
    case "lecturer": return { main: LECTURER_MAIN_NAV, bottom: LECTURER_BOTTOM_NAV };
    case "student":  return { main: STUDENT_MAIN_NAV,  bottom: STUDENT_BOTTOM_NAV };
    default:         return { main: [],                 bottom: [] };
  }
}

/* ------------------------------------------------------------------ */
/*  Single nav row                                                      */
/* ------------------------------------------------------------------ */

function NavRow({
  item,
  collapsed,
  onClick,
}: {
  item:      NavItem;
  collapsed: boolean;
  onClick?:  () => void;
}) {
  const location = useLocation();

  /* Active if current path starts with the nav item's path.
     Dashboard items need an exact match on the role-dashboard path. */
  const isDashboard = item.to.endsWith("/dashboard");
  const isActive    = isDashboard
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={isActive ? "nav-item active" : "nav-item"}
    >
      <span className="nav-item-icon">{item.icon}</span>
      {!collapsed && <span className="nav-item-label">{item.label}</span>}
    </NavLink>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                             */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  collapsed:     boolean;
  onToggle:      () => void;
  mobileOpen:    boolean;
  onMobileClose: () => void;
}

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const { user } = useAuth();
  const { main: mainNav, bottom: bottomNav } = getNavForRole(user?.role);

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={mobileOpen ? "sidebar-overlay visible" : "sidebar-overlay"}
        onClick={onMobileClose}
      />

      <aside
        className={[
          "sidebar",
          collapsed  ? "collapsed"    : "",
          mobileOpen ? "mobile-open" : "",
        ].filter(Boolean).join(" ")}
      >
        {/* ── Brand ── */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">NBI</div>
          {!collapsed && (
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-name">NBI Institute</div>
              <div className="sidebar-brand-sub">Smart Attendance</div>
            </div>
          )}
        </div>

        {/* ── Main navigation (role-specific) ── */}
        <nav className="sidebar-nav">
          {!collapsed && <div className="sidebar-nav-label">Main</div>}
          {mainNav.map((item) => (
            <NavRow
              key={item.to}
              item={item}
              collapsed={collapsed}
              onClick={onMobileClose}
            />
          ))}
        </nav>

        {/* ── Bottom navigation + collapse toggle ── */}
        <div className="sidebar-bottom">
          {!collapsed && bottomNav.length > 0 && (
            <div className="sidebar-nav-label" style={{ padding: "0 4px var(--sp-1)" }}>
              System
            </div>
          )}
          {bottomNav.map((item) => (
            <NavRow
              key={item.to}
              item={item}
              collapsed={collapsed}
              onClick={onMobileClose}
            />
          ))}

          {/* Collapse toggle */}
          <button
            className="sidebar-toggle"
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="nav-item-icon">
              {collapsed ? <HiChevronRight /> : <HiChevronLeft />}
            </span>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
