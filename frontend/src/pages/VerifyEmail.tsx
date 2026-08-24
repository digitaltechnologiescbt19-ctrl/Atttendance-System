import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineEnvelope, HiOutlineSun, HiOutlineMoon, HiOutlineArrowLeft } from "react-icons/hi2";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import type { AuthUser } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

/* ------------------------------------------------------------------ */
/*  Six individual digit inputs                                         */
/* ------------------------------------------------------------------ */

interface CodeInputProps {
  value:    string[];
  onChange: (digits: string[]) => void;
  disabled: boolean;
  hasError: boolean;
}

function CodeInput({ value, onChange, disabled, hasError }: CodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function handleKey(
    idx:   number,
    e:     React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Backspace") {
      if (value[idx]) {
        const next = [...value];
        next[idx] = "";
        onChange(next);
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
        const next = [...value];
        next[idx - 1] = "";
        onChange(next);
      }
    }
  }

  function handleChange(idx: number, raw: string) {
    // Accept only digits; take the last character typed
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next  = [...value];
    next[idx]   = digit;
    onChange(next);
    if (digit && idx < 5) refs.current[idx + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6)
      .split("");
    const next = ["", "", "", "", "", ""];
    digits.forEach((d, i) => { next[i] = d; });
    onChange(next);
    const lastFilled = Math.min(digits.length, 5);
    refs.current[lastFilled]?.focus();
  }

  return (
    <div
      style={{
        display:        "flex",
        gap:            "var(--sp-3)",
        justifyContent: "center",
      }}
      onPaste={handlePaste}
    >
      {value.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => { refs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={idx === 0}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKey(idx, e)}
          aria-label={`Verification code digit ${idx + 1}`}
          style={{
            width:       52,
            height:      60,
            textAlign:   "center",
            fontSize:    "var(--tx-xl)",
            fontWeight:  700,
            color:       hasError ? "var(--danger-text)" : "var(--text-primary)",
            background:  "var(--bg-input)",
            border:      `2px solid ${
              hasError
                ? "var(--danger)"
                : digit
                ? "var(--accent)"
                : "var(--border-default)"
            }`,
            borderRadius: "var(--radius-md)",
            outline:      "none",
            transition:   "border-color var(--t-fast)",
            cursor:       disabled ? "not-allowed" : "text",
            opacity:      disabled ? 0.6 : 1,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main VerifyEmail page                                               */
/* ------------------------------------------------------------------ */

export default function VerifyEmail() {
  const navigate  = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { pendingVerificationEmail, verifyComplete, setPendingVerification } = useAuth();

  /* Email to verify — from context or query param fallback */
  const emailToVerify = pendingVerificationEmail ?? "";

  const [digits,       setDigits]       = useState<string[]>(["", "", "", "", "", ""]);
  const [submitting,   setSubmitting]   = useState(false);
  const [codeError,    setCodeError]    = useState("");
  const [resending,    setResending]    = useState(false);
  const [resendMsg,    setResendMsg]    = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  /* Cooldown ticker */
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  /* If there is no pending email (e.g. navigated here directly), send to login */
  useEffect(() => {
    if (!emailToVerify) navigate("/login", { replace: true });
  }, [emailToVerify, navigate]);

  const code = digits.join("");
  const codeComplete = code.length === 6;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!codeComplete || !emailToVerify) return;

    setSubmitting(true);
    setCodeError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-email`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: emailToVerify, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCodeError(data.message ?? "Invalid code. Please try again.");
        setDigits(["", "", "", "", "", ""]);
        return;
      }

      /* Verification succeeded — data = { token, user } */
      verifyComplete(data.user as AuthUser, data.token as string);
      /* roleHome() is available on the context but we import the helper directly */
      const home =
        (data.user as AuthUser).role === "admin"    ? "/dashboard" :
        (data.user as AuthUser).role === "lecturer" ? "/dashboard" :
                                                      "/dashboard";
      navigate(home, { replace: true });

    } catch {
      setCodeError("Verification failed. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || !emailToVerify) return;

    setResending(true);
    setResendMsg("");
    setCodeError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: emailToVerify }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setResendMsg(data.message ?? "Please wait before requesting another code.");
        setResendCooldown(60);
        return;
      }

      setResendMsg("A new code has been sent to your email.");
      setResendCooldown(60);
      setDigits(["", "", "", "", "", ""]);

    } catch {
      setResendMsg("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  }

  function handleBack() {
    setPendingVerification(null);
    navigate("/login", { replace: true });
  }

  /* Mask the email: abc***@domain.com */
  function maskEmail(e: string): string {
    const [local, domain] = e.split("@");
    if (!domain) return e;
    const visible = local.slice(0, 3);
    return `${visible}${"*".repeat(Math.max(0, local.length - 3))}@${domain}`;
  }

  return (
    <div
      style={{
        minHeight:   "100vh",
        display:     "flex",
        alignItems:  "center",
        justifyContent: "center",
        background:  "var(--bg-app)",
        fontFamily:  "var(--font)",
        padding:     "var(--sp-6)",
        position:    "relative",
      }}
    >
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        style={{
          position:     "absolute",
          top:          "var(--sp-6)",
          right:        "var(--sp-6)",
          width:        36, height: 36,
          display:      "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "var(--radius-md)",
          border:       "1px solid var(--border-subtle)",
          background:   "var(--bg-surface)",
          color:        "var(--text-secondary)",
          cursor:       "pointer",
          fontSize:     18,
          transition:   "background var(--t-fast), color var(--t-fast)",
        }}
      >
        {theme === "dark" ? <HiOutlineSun /> : <HiOutlineMoon />}
      </button>

      {/* Back to login */}
      <button
        onClick={handleBack}
        style={{
          position:     "absolute",
          top:          "var(--sp-6)",
          left:         "var(--sp-6)",
          display:      "flex", alignItems: "center", gap: "var(--sp-2)",
          background:   "none",
          border:       "none",
          cursor:       "pointer",
          color:        "var(--text-muted)",
          fontSize:     "var(--tx-sm)",
          fontWeight:   500,
          transition:   "color var(--t-fast)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        <HiOutlineArrowLeft style={{ fontSize: 16 }} />
        Back to Sign In
      </button>

      {/* Verification card */}
      <div
        style={{
          width:        "100%",
          maxWidth:     420,
          background:   "var(--bg-surface)",
          border:       "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)",
          boxShadow:    "var(--shadow-md)",
          padding:      "var(--sp-8)",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width:        52, height: 52,
            borderRadius: "var(--radius-lg)",
            background:   "var(--accent-subtle)",
            border:       "1px solid var(--accent-border)",
            display:      "flex", alignItems: "center", justifyContent: "center",
            fontSize:     24, color: "var(--accent)",
            margin:       "0 auto var(--sp-5)",
          }}
        >
          <HiOutlineEnvelope />
        </div>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: "var(--sp-6)" }}>
          <h2
            style={{
              fontSize:     "var(--tx-xl)",
              fontWeight:   700,
              color:        "var(--text-primary)",
              marginBottom: "var(--sp-2)",
            }}
          >
            Verify your account
          </h2>
          <p style={{ fontSize: "var(--tx-sm)", color: "var(--text-secondary)", lineHeight: 1.7 }}>
            A 6-digit verification code has been sent to{" "}
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {emailToVerify ? maskEmail(emailToVerify) : "your email"}
            </span>
            . Enter it below to activate your account.
          </p>
        </div>

        {/* Code form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "var(--sp-5)" }}>
            <CodeInput
              value={digits}
              onChange={(d) => { setDigits(d); if (codeError) setCodeError(""); }}
              disabled={submitting}
              hasError={!!codeError}
            />
            {codeError && (
              <p
                role="alert"
                style={{
                  marginTop:  "var(--sp-3)",
                  textAlign:  "center",
                  fontSize:   "var(--tx-sm)",
                  color:      "var(--danger-text)",
                  fontWeight: 500,
                }}
              >
                {codeError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!codeComplete || submitting}
            className="btn btn-primary btn-md"
            style={{
              width:          "100%",
              justifyContent: "center",
              fontSize:       "var(--tx-base)",
              padding:        "12px",
              marginBottom:   "var(--sp-5)",
            }}
          >
            {submitting ? "Verifying…" : "Verify Account"}
          </button>
        </form>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: "var(--sp-5)" }} />

        {/* Resend */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "var(--tx-sm)", color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
            Didn't receive a code?
          </p>

          {resendMsg && (
            <p
              style={{
                fontSize:     "var(--tx-sm)",
                color:        resendMsg.toLowerCase().includes("sent")
                                ? "var(--success-text)"
                                : "var(--text-muted)",
                marginBottom: "var(--sp-3)",
                fontWeight:   500,
              }}
            >
              {resendMsg}
            </p>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
            style={{
              background:  "none",
              border:      "none",
              cursor:      resending || resendCooldown > 0 ? "not-allowed" : "pointer",
              color:       resending || resendCooldown > 0
                             ? "var(--text-muted)"
                             : "var(--accent)",
              fontSize:    "var(--tx-sm)",
              fontWeight:  600,
              padding:     0,
              opacity:     resending || resendCooldown > 0 ? 0.6 : 1,
              transition:  "color var(--t-fast), opacity var(--t-fast)",
            }}
          >
            {resending
              ? "Sending…"
              : resendCooldown > 0
              ? `Resend code (${resendCooldown}s)`
              : "Resend code"}
          </button>
        </div>

        {/* Footer note */}
        <p
          style={{
            marginTop:  "var(--sp-6)",
            fontSize:   "var(--tx-xs)",
            color:      "var(--text-muted)",
            textAlign:  "center",
            lineHeight: 1.6,
          }}
        >
          The code expires in 24 hours. If you need help, contact the institute administrator.
        </p>
      </div>
    </div>
  );
}
