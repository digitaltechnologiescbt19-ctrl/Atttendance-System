import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type UserRole = "admin" | "lecturer" | "student";

export interface AuthUser {
  id:          number;
  name:        string;
  email:       string;
  role:        UserRole;
  /** FK to students.id (students) or future lecturers.id (lecturers) */
  linked_id?:  number | null;
  /** Legacy alias kept so existing code that uses lecturerId/studentId still compiles */
  lecturerId?: number;
  studentId?:  number;
}

interface AuthContextValue {
  user:                      AuthUser | null;
  token:                     string | null;
  isAuthenticated:           boolean;
  /** True when the user has logged in but their email is not yet verified */
  pendingVerificationEmail:  string | null;
  login:  (user: AuthUser, token: string, remember?: boolean) => void;
  logout: () => void;
  /** Call after successful email verification so the session updates */
  verifyComplete: (user: AuthUser, token: string) => void;
  /** Store the email that needs verification (set when login returns 403 requiresVerification) */
  setPendingVerification: (email: string | null) => void;
  /** Returns the home route for the current user's role */
  roleHome: () => string;
  /** Replace the current user object with a fresh one from the server */
  setUserFromServer: (user: AuthUser) => void;
}

/* ------------------------------------------------------------------ */
/*  Role → home route mapping                                           */
/* ------------------------------------------------------------------ */

export function roleHome(role: UserRole): string {
  switch (role) {
    case "admin":    return "/admin/dashboard";
    case "lecturer": return "/lecturer/dashboard";
    case "student":  return "/student/dashboard";
  }
}

/* ------------------------------------------------------------------ */
/*  localStorage / sessionStorage helpers                               */
/* ------------------------------------------------------------------ */

const USER_KEY    = "nbi-auth-user";
const TOKEN_KEY   = "nbi-auth-token";
const PENDING_KEY = "nbi-auth-pending-email";
const REMEMBER_KEY = "nbi-auth-remember";

/* Get storage helper removed (unused) */

function loadUser(): AuthUser | null {
  try {
    // Check localStorage first (Remember Me = true)
    let raw = localStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw) as AuthUser;
    // Check sessionStorage (Remember Me = false)
    raw = sessionStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw) as AuthUser;
    return null;
  } catch { return null; }
}

function loadToken(): string | null {
  try {
    // Check localStorage first
    let token = localStorage.getItem(TOKEN_KEY);
    if (token) return token;
    // Check sessionStorage
    return sessionStorage.getItem(TOKEN_KEY);
  } catch { return null; }
}

function loadPending(): string | null {
  try { return localStorage.getItem(PENDING_KEY); } catch { return null; }
}

function saveSession(user: AuthUser, token: string, remember: boolean) {
  try {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(USER_KEY,  JSON.stringify(user));
    storage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_KEY, String(remember));
    
    // Clear from the other storage to avoid confusion
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem(USER_KEY);
    otherStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

function clearSession() {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

function savePending(email: string | null) {
  try {
    if (email) localStorage.setItem(PENDING_KEY, email);
    else        localStorage.removeItem(PENDING_KEY);
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Context                                                             */
/* ------------------------------------------------------------------ */

const AuthContext = createContext<AuthContextValue>({
  user:                     null,
  token:                    null,
  isAuthenticated:          false,
  pendingVerificationEmail: null,
  login:                () => {},
  logout:               () => {},
  verifyComplete:       () => {},
  setPendingVerification: () => {},
  roleHome:             () => "/login",
  setUserFromServer:     () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

/* ------------------------------------------------------------------ */
/*  Provider                                                            */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(loadUser);
  const [token,   setToken]   = useState<string  | null>(loadToken);
  const [pending, setPending] = useState<string  | null>(loadPending);
  const [remember, setRemember] = useState(false);

  /* Keep storage in sync */
  useEffect(() => {
    if (user && token) saveSession(user, token, remember);
    else clearSession();
  }, [user, token, remember]);

  useEffect(() => {
    savePending(pending);
  }, [pending]);

  /* Called after a successful /api/auth/login response */
  const login = useCallback((u: AuthUser, t: string, rememberMe: boolean = false) => {
    setUser(u);
    setToken(t);
    setRemember(rememberMe);
    setPending(null);
  }, []);

  /* Called after a successful /api/auth/verify-email response */
  const verifyComplete = useCallback((u: AuthUser, t: string) => {
    setUser(u);
    setToken(t);
    setPending(null);
    // Keep existing remember preference
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setRemember(false);
    setPending(null);
  }, []);

  const setUserFromServer = useCallback((u: AuthUser) => {
    setUser(u);
  }, []);

  const setPendingVerification = useCallback((email: string | null) => {
    setPending(email);
  }, []);

  const getRoleHome = useCallback(
    () => (user ? roleHome(user.role) : "/login"),
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated:          user !== null && token !== null,
        pendingVerificationEmail: pending,
        login,
        logout,
        verifyComplete,
        setPendingVerification,
        setUserFromServer,
        roleHome: getRoleHome,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
