import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineSun,
  HiOutlineMoon,
  HiOutlineExclamationCircle,
  HiOutlineXMark,
  HiOutlineEnvelope,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import type { AuthUser } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL ?? "";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                      */
/* ------------------------------------------------------------------ */

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return {};
  try { return (await res.json()) as Record<string, unknown>; }
  catch { return {}; }
}

function friendlyAuthError(status: number, data: Record<string, unknown>): string {
  const msg = typeof data.message === "string" ? data.message : "";
  if (status === 0 || status >= 500)
    return "The authentication service is temporarily unavailable. Please try again shortly.";
  if (status === 401) return "Incorrect email or password.";
  if (status === 403) {
    if (msg.toLowerCase().includes("deactivated"))
      return "This account has been deactivated. Please contact the institute administrator.";
    return msg || "Access denied.";
  }
  if (status === 429) return "Too many attempts. Please try again later.";
  return msg || "Unable to sign in. Please check your credentials and try again.";
}

/** Mask email for display: "jo****@gmail.com" */
function maskEmail(e: string): string {
  const at = e.indexOf("@");
  if (at <= 2) return e;
  return `${e.slice(0, 2)}${"*".repeat(Math.min(at - 2, 4))}${e.slice(at)}`;
}

/* ================================================================== */
/*  OtpBoxes — reusable 6-digit OTP input                             */
/* ================================================================== */

interface OtpBoxesProps {
  prefix:   string;
  value:    string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
}

function OtpBoxes({ prefix, value, onChange, disabled }: OtpBoxesProps) {
  const handleChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const n = [...value];
    n[i] = v;
    onChange(n);
    if (v && i < 5) document.getElementById(`otp-${prefix}-${i + 1}`)?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0)
      document.getElementById(`otp-${prefix}-${i - 1}`)?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    const n = ["", "", "", "", "", ""];
    digits.split("").forEach((d, i) => { n[i] = d; });
    onChange(n);
    document.getElementById(`otp-${prefix}-${Math.min(digits.length, 5)}`)?.focus();
  };

  return (
    <div className="otp-input-group">
      {value.map((digit, i) => (
        <input
          key={i}
          id={`otp-${prefix}-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          autoFocus={i === 0}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          disabled={disabled}
          className="otp-input"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

/* ================================================================== */
/*  AccountActivationModal                                              */
/*  Step 1 — email → Step 2 — OTP → Step 3 — create password         */
/* ================================================================== */

type ActivationStep = "email" | "otp" | "createpassword";

interface AccountActivationModalProps {
  initialEmail?:         string;
  onClose:               () => void;
  onSwitchToContact:     () => void;
  onSwitchToRecovery:    () => void;
}

function AccountActivationModal({
  initialEmail = "",
  onClose,
  onSwitchToContact,
  onSwitchToRecovery,
}: AccountActivationModalProps) {
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  const [step,             setStep]            = useState<ActivationStep>("email");
  const [email,            setEmail]           = useState(initialEmail);
  const [otp,              setOtp]             = useState(["", "", "", "", "", ""]);
  const [resendCooldown,   setResendCooldown]  = useState(0);
  const [activationToken,  setActivationToken] = useState("");
  const [newPw,            setNewPw]           = useState("");
  const [confirmPw,        setConfirmPw]       = useState("");
  const [loading,          setLoading]         = useState(false);
  const [error,            setError]           = useState("");
  const [emailNotFound,    setEmailNotFound]   = useState(false);
  const [alreadyActive,    setAlreadyActive]   = useState(false);

  /* resend countdown */
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  /* ---------- Step 1: request activation OTP ---------- */
  const sendCode = async () => {
    setError(""); setEmailNotFound(false); setAlreadyActive(false); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/request-activation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await safeJson(res);

      if (res.status === 404) {
        setEmailNotFound(true);
        setError(
          typeof data.message === "string"
            ? data.message
            : "This email is not associated with an approved NBI Institute account."
        );
        return;
      }
      if (res.status === 409) {
        setAlreadyActive(true);
        setError(
          typeof data.message === "string"
            ? data.message
            : "This account is already activated. Use Forgot Password instead."
        );
        return;
      }
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Request failed. Please try again.");
        return;
      }

      setOtp(["", "", "", "", "", ""]);
      setStep("otp");
      setResendCooldown(60);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Step 2: verify OTP ---------- */
  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) { setError("Please enter all 6 digits."); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/verify-activation-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        if (data.expired) {
          setError("This code has expired. Request a new one.");
          setOtp(["", "", "", "", "", ""]);
        } else {
          setError(typeof data.message === "string" ? data.message : "Incorrect code. Please try again.");
        }
        return;
      }
      setActivationToken(typeof data.activation_token === "string" ? data.activation_token : "");
      setNewPw(""); setConfirmPw("");
      setStep("createpassword");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Step 3: activate account ---------- */
  const activateAccount = async () => {
    if (!newPw || !confirmPw)  { setError("Both fields are required."); return; }
    if (newPw !== confirmPw)   { setError("Passwords do not match."); return; }
    if (newPw.length < 6)      { setError("Password must be at least 6 characters."); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/activate-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:            email.trim().toLowerCase(),
          activation_token: activationToken,
          new_password:     newPw,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        if (data.expired) { setError("Session expired. Please start over."); setStep("email"); }
        else { setError(typeof data.message === "string" ? data.message : "Failed. Please try again."); }
        return;
      }
      const tok  = typeof data.token === "string" ? data.token : "";
      const user = data.user as AuthUser | undefined;
      if (tok && user) {
        authLogin(user, tok, false);
        navigate(
          user.role === "admin"     ? "/admin/dashboard"
          : user.role === "lecturer" ? "/lecturer/dashboard"
          : "/student/dashboard"
        );
      }
      onClose();
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="modal-close" aria-label="Close">
          <HiOutlineXMark />
        </button>

        {/* ══ STEP 1 — Email entry ══ */}
        {step === "email" && (
          <>
            <div className="modal-header">
              <h2>Activate My Account</h2>
              <p>Enter the email address your institution registered for you.</p>
            </div>

            {error && (
              <div className="alert alert-error">
                <HiOutlineExclamationCircle />
                <div style={{ flex: 1 }}>
                  <div>{error}</div>
                  {emailNotFound && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.85em" }}>
                      If you believe you should have an account,{" "}
                      <button
                        className="btn-text"
                        style={{ fontWeight: 700, display: "inline" }}
                        onClick={() => { onClose(); setTimeout(onSwitchToContact, 50); }}
                      >
                        contact the institute administrator
                      </button>
                      .
                    </div>
                  )}
                  {alreadyActive && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.85em" }}>
                      <button
                        className="btn-text"
                        style={{ fontWeight: 700, display: "inline" }}
                        onClick={() => { onClose(); setTimeout(onSwitchToRecovery, 50); }}
                      >
                        Use Forgot Password instead
                      </button>
                      .
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="modal-body">
              <p className="modal-instructions">
                Enter your registered email address and we will send you a
                6-digit activation code.
              </p>
              <div className="form-group">
                <label htmlFor="act-email">Email address</label>
                <div className="input-with-icon">
                  <HiOutlineEnvelope />
                  <input
                    type="email"
                    id="act-email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(""); setEmailNotFound(false); setAlreadyActive(false); }}
                    onKeyDown={e => e.key === "Enter" && email && sendCode()}
                    placeholder="your.email@example.com"
                    disabled={loading}
                    autoFocus
                    required
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={sendCode} disabled={loading || !email} className="btn-primary btn-full">
                {loading ? "Sending..." : "Send Activation Code"}
              </button>
              <div className="modal-footer-text">
                <span>Already activated?</span>
                <button className="btn-text" onClick={onClose}>Sign in instead</button>
              </div>
            </div>
          </>
        )}

        {/* ══ STEP 2 — OTP verification (NO password fields on this screen) ══ */}
        {step === "otp" && (
          <>
            <div className="modal-header">
              <h2>Check your email</h2>
              <p>
                We sent a 6-digit activation code to{" "}
                <strong>{maskEmail(email)}</strong>.
                {" "}Enter it below to continue.
              </p>
            </div>

            {error && (
              <div className="alert alert-error">
                <HiOutlineExclamationCircle /><span>{error}</span>
              </div>
            )}

            <div className="modal-body">
              <OtpBoxes
                prefix="act"
                value={otp}
                onChange={setOtp}
                disabled={loading}
              />
            </div>

            <div className="modal-footer">
              <button
                onClick={verifyOtp}
                disabled={loading || otp.some(d => d === "")}
                className="btn-primary btn-full"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              <div className="modal-footer-actions">
                <button
                  className="btn-text"
                  disabled={loading}
                  onClick={() => { setOtp(["", "", "", "", "", ""]); setError(""); setStep("email"); }}
                >
                  Use another email
                </button>
                <button
                  className="btn-text"
                  disabled={loading || resendCooldown > 0}
                  onClick={sendCode}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
              <div className="modal-footer-text">
                <span>Code expires in 15 minutes.</span>
              </div>
            </div>
          </>
        )}

        {/* ══ STEP 3 — Create password (NO OTP boxes on this screen) ══ */}
        {step === "createpassword" && (
          <>
            <div className="modal-header">
              <h2>Create Your Password</h2>
              <p>Choose a secure password for your NBI Institute account.</p>
            </div>

            {error && (
              <div className="alert alert-error">
                <HiOutlineExclamationCircle /><span>{error}</span>
              </div>
            )}

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="act-new-pw">New Password</label>
                <input
                  type="password"
                  id="act-new-pw"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="At least 6 characters"
                  disabled={loading}
                  autoFocus
                  required
                />
                <div style={{ fontSize: "0.8em", color: "var(--text-muted)", marginTop: "0.3rem" }}>
                  Minimum 6 characters
                </div>
              </div>
              <div className="form-group" style={{ marginTop: "0.75rem" }}>
                <label htmlFor="act-confirm-pw">Confirm Password</label>
                <input
                  type="password"
                  id="act-confirm-pw"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Re-enter your password"
                  disabled={loading}
                  onKeyDown={e => e.key === "Enter" && activateAccount()}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={activateAccount}
                disabled={loading || !newPw || !confirmPw}
                className="btn-primary btn-full"
              >
                {loading ? "Activating..." : "Activate Account"}
              </button>
              <div className="modal-footer-text">
                <span>You will be signed in automatically after activation.</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  PasswordRecoveryModal                                               */
/*  Step 1 — email → Step 2 — OTP → Step 3 — new password            */
/* ================================================================== */

type RecoveryStep = "email" | "otp" | "newpassword";

interface PasswordRecoveryModalProps {
  onClose:               () => void;
  onSwitchToContact:     () => void;
  onSwitchToActivation:  () => void;
}

function PasswordRecoveryModal({
  onClose,
  onSwitchToContact,
  onSwitchToActivation,
}: PasswordRecoveryModalProps) {
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  const [step,           setStep]           = useState<RecoveryStep>("email");
  const [email,          setEmail]          = useState("");
  const [otp,            setOtp]            = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resetToken,     setResetToken]     = useState("");
  const [newPw,          setNewPw]          = useState("");
  const [confirmPw,      setConfirmPw]      = useState("");
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [accountMissing, setAccountMissing] = useState(false);
  const [needsActivation,setNeedsActivation]= useState(false);

  /* resend countdown */
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  /* ---------- Step 1: request OTP ---------- */
  const sendCode = async () => {
    setError(""); setAccountMissing(false); setNeedsActivation(false); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await safeJson(res);

      if (res.status === 404) {
        setAccountMissing(true);
        setError(
          typeof data.message === "string"
            ? data.message
            : "No approved account was found for this email address."
        );
        return;
      }
      if (res.status === 403) {
        /* Check if account is pending activation */
        const msg = typeof data.message === "string" ? data.message : "";
        if (
          (data as Record<string, unknown>).requiresActivation ||
          msg.toLowerCase().includes("not yet activated") ||
          msg.toLowerCase().includes("pending")
        ) {
          setNeedsActivation(true);
          setError("This account has not been activated yet. Use Activate My Account instead.");
        } else {
          setError(msg || "Account deactivated. Contact the administrator.");
        }
        return;
      }
      if (res.status === 429) {
        setError(typeof data.message === "string" ? data.message : "Too many requests. Please wait.");
        return;
      }
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Request failed. Please try again.");
        return;
      }

      setOtp(["", "", "", "", "", ""]);
      setStep("otp");
      setResendCooldown(60);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Step 2: verify OTP ---------- */
  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) { setError("Please enter all 6 digits."); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        if (data.expired) {
          setError("This code has expired. Request a new one.");
          setOtp(["", "", "", "", "", ""]);
        } else {
          setError(typeof data.message === "string" ? data.message : "Incorrect code. Please try again.");
        }
        return;
      }
      setResetToken(typeof data.reset_token === "string" ? data.reset_token : "");
      setNewPw(""); setConfirmPw("");
      setStep("newpassword");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Step 3: set new password ---------- */
  const resetPassword = async () => {
    if (!newPw || !confirmPw)  { setError("Both fields are required."); return; }
    if (newPw !== confirmPw)   { setError("Passwords do not match."); return; }
    if (newPw.length < 6)      { setError("Password must be at least 6 characters."); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:      email.trim().toLowerCase(),
          reset_token: resetToken,
          new_password: newPw,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        if (data.expired) { setError("Session expired. Please start over."); setStep("email"); }
        else { setError(typeof data.message === "string" ? data.message : "Failed. Please try again."); }
        return;
      }
      const tok  = typeof data.token === "string" ? data.token : "";
      const user = data.user as AuthUser | undefined;
      if (tok && user) {
        authLogin(user, tok, false);
        navigate(
          user.role === "admin"     ? "/admin/dashboard"
          : user.role === "lecturer" ? "/lecturer/dashboard"
          : "/student/dashboard"
        );
      }
      onClose();
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="modal-close" aria-label="Close">
          <HiOutlineXMark />
        </button>

        {/* ══ STEP 1 — Email entry ══ */}
        {step === "email" && (
          <>
            <div className="modal-header">
              <h2>Forgot your password?</h2>
              <p>Enter the email address associated with your NBI account.</p>
            </div>

            {error && (
              <div className="alert alert-error">
                <HiOutlineExclamationCircle />
                <div style={{ flex: 1 }}>
                  <div>{error}</div>
                  {accountMissing && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.85em" }}>
                      If you believe you should have an account,{" "}
                      <button
                        className="btn-text"
                        style={{ fontWeight: 700, display: "inline" }}
                        onClick={() => { onClose(); setTimeout(onSwitchToContact, 50); }}
                      >
                        contact the institute administrator
                      </button>
                      .
                    </div>
                  )}
                  {needsActivation && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.85em" }}>
                      <button
                        className="btn-text"
                        style={{ fontWeight: 700, display: "inline" }}
                        onClick={() => { onClose(); setTimeout(onSwitchToActivation, 50); }}
                      >
                        Activate My Account instead
                      </button>
                      .
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="modal-body">
              <p className="modal-instructions">
                Enter your registered email address and we will send you a
                6-digit verification code.
              </p>
              <div className="form-group">
                <label htmlFor="pr-email">Email address</label>
                <div className="input-with-icon">
                  <HiOutlineEnvelope />
                  <input
                    type="email"
                    id="pr-email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(""); setAccountMissing(false); setNeedsActivation(false); }}
                    onKeyDown={e => e.key === "Enter" && email && sendCode()}
                    placeholder="your.email@example.com"
                    disabled={loading}
                    autoFocus
                    required
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={sendCode} disabled={loading || !email} className="btn-primary btn-full">
                {loading ? "Sending..." : "Send Verification Code"}
              </button>
              <div className="modal-footer-text">
                <span>Don&apos;t have an account?</span>
                <button
                  className="btn-text"
                  onClick={() => { onClose(); setTimeout(onSwitchToContact, 50); }}
                >
                  Contact the Institute Administrator
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══ STEP 2 — OTP verification (NO password fields on this screen) ══ */}
        {step === "otp" && (
          <>
            <div className="modal-header">
              <h2>Check your email</h2>
              <p>
                A 6-digit code has been sent to{" "}
                <strong>{maskEmail(email)}</strong>.
                {" "}Enter it below to continue.
              </p>
            </div>

            {error && (
              <div className="alert alert-error">
                <HiOutlineExclamationCircle /><span>{error}</span>
              </div>
            )}

            <div className="modal-body">
              <OtpBoxes
                prefix="pr"
                value={otp}
                onChange={setOtp}
                disabled={loading}
              />
            </div>

            <div className="modal-footer">
              <button
                onClick={verifyOtp}
                disabled={loading || otp.some(d => d === "")}
                className="btn-primary btn-full"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              <div className="modal-footer-actions">
                <button
                  className="btn-text"
                  disabled={loading}
                  onClick={() => { setOtp(["", "", "", "", "", ""]); setError(""); setStep("email"); }}
                >
                  Use another email
                </button>
                <button
                  className="btn-text"
                  disabled={loading || resendCooldown > 0}
                  onClick={sendCode}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
              <div className="modal-footer-text">
                <span>Code expires in 15 minutes.</span>
              </div>
            </div>
          </>
        )}

        {/* ══ STEP 3 — New password (NO OTP boxes on this screen) ══ */}
        {step === "newpassword" && (
          <>
            <div className="modal-header">
              <h2>Create a new password</h2>
              <p>Set a new password for <strong>{maskEmail(email)}</strong>.</p>
            </div>

            {error && (
              <div className="alert alert-error">
                <HiOutlineExclamationCircle /><span>{error}</span>
              </div>
            )}

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="pr-new-pw">New Password</label>
                <input
                  type="password"
                  id="pr-new-pw"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="At least 6 characters"
                  disabled={loading}
                  autoFocus
                  required
                />
                <div style={{ fontSize: "0.8em", color: "var(--text-muted)", marginTop: "0.3rem" }}>
                  Minimum 6 characters
                </div>
              </div>
              <div className="form-group" style={{ marginTop: "0.75rem" }}>
                <label htmlFor="pr-confirm-pw">Confirm New Password</label>
                <input
                  type="password"
                  id="pr-confirm-pw"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Re-enter new password"
                  disabled={loading}
                  onKeyDown={e => e.key === "Enter" && resetPassword()}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={resetPassword}
                disabled={loading || !newPw || !confirmPw}
                className="btn-primary btn-full"
              >
                {loading ? "Saving..." : "Reset Password"}
              </button>
              <div className="modal-footer-text">
                <span>You will be signed in automatically after resetting.</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  ContactAdminModal                                                   */
/*  For users with no account, or anyone who needs to reach the        */
/*  institute. Submits a message to POST /api/auth/contact-admin       */
/* ================================================================== */

function ContactAdminModal({ onClose }: { onClose: () => void }) {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !message) { setError("Email and message are required."); return; }
    // Basic client-side email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError("Please enter a valid email address."); return; }
    if (message.trim().length < 10) { setError("Message must be at least 10 characters."); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/contact-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Failed to send. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="modal-close" aria-label="Close">
          <HiOutlineXMark />
        </button>

        {sent ? (
          /* ── Success state ── */
          <>
            <div className="modal-header">
              <h2>Message sent</h2>
              <p>Your message has been delivered to the institute administrator.</p>
            </div>
            <div className="modal-body" style={{ textAlign: "center", padding: "1.5rem 0" }}>
              <HiOutlineCheckCircle style={{ fontSize: "3rem", color: "var(--success)", marginBottom: "0.75rem" }} />
              <p style={{ color: "var(--text-secondary)", fontSize: "var(--tx-sm)", lineHeight: 1.6 }}>
                The administrator will review your request and reply to{" "}
                <strong>{email}</strong> directly.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={onClose} className="btn-primary btn-full">Close</button>
            </div>
          </>
        ) : (
          /* ── Form ── */
          <>
            <div className="modal-header">
              <h2>Contact the Institute Administrator</h2>
              <p>
                Send a message to request account access or get help. The
                administrator will reply to your email directly.
              </p>
            </div>

            {error && (
              <div className="alert alert-error">
                <HiOutlineExclamationCircle /><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="ca-name">Your name (optional)</label>
                  <input
                    type="text"
                    id="ca-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    disabled={loading}
                  />
                </div>

                <div className="form-group" style={{ marginTop: "0.75rem" }}>
                  <label htmlFor="ca-email">
                    Your email address <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <div className="input-with-icon">
                    <HiOutlineEnvelope />
                    <input
                      type="email"
                      id="ca-email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      disabled={loading}
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: "0.75rem" }}>
                  <label htmlFor="ca-message">
                    Message <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <textarea
                    id="ca-message"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Describe what you need — e.g. account access, password help, enrolment enquiry…"
                    rows={4}
                    disabled={loading}
                    required
                      style={{ width: "100%", resize: "vertical", padding: "0.6rem", borderRadius: "8px" }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="submit"
                  disabled={loading || !email || !message}
                  className="btn-primary btn-full"
                >
                  {loading ? "Sending..." : "Send Message"}
                </button>
                <div className="modal-footer-text">
                  <span>Already have an account?</span>
                  <button type="button" className="btn-text" onClick={onClose}>
                    Sign in instead
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Login Page                                                          */
/* ================================================================== */

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [showPassword,   setShowPassword]   = useState(false);
  const [rememberMe,     setRememberMe]     = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");

  /* Three separate modals — deliberately not combined */
  const [showActivation, setShowActivation] = useState(false);
  const [activationEmail,setActivationEmail]= useState("");
  const [showRecovery,   setShowRecovery]   = useState(false);
  const [showContact,    setShowContact]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await safeJson(res);

      if (!res.ok) {
        /* 403 with requiresActivation → auto-open activation modal */
        if (
          res.status === 403 &&
          (data as Record<string, unknown>).requiresActivation === true
        ) {
          const pendingEmail =
            typeof (data as Record<string, unknown>).email === "string"
              ? (data as Record<string, unknown>).email as string
              : email;
          setActivationEmail(pendingEmail);
          setShowActivation(true);
          setLoading(false);
          return;
        }
        setError(friendlyAuthError(res.status, data));
        setLoading(false);
        return;
      }

      const token = typeof data.token === "string" ? data.token : "";
      const user  = data.user as AuthUser | undefined;
      if (!token || !user) { setError("Invalid server response. Please try again."); setLoading(false); return; }

      login(user, token, rememberMe);
      navigate(
        user.role === "admin"     ? "/admin/dashboard"
        : user.role === "lecturer" ? "/lecturer/dashboard"
        : "/student/dashboard"
      );
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* ── Left: Branding ── */}
      <div className="login-brand-section">
        <div className="login-brand-content">
          <div className="login-brand-logo">
            <div className="login-brand-logo-icon">NBI</div>
            <div className="login-brand-logo-text">
              <div className="login-brand-logo-name">NBI Institute</div>
              <div className="login-brand-logo-tagline">Smart Attendance System</div>
            </div>
          </div>
          <p className="login-brand-description">
            Secure access for students, lecturers and administrators.
          </p>
          <div className="login-features">
            <div className="feature-card">
              <div className="feature-title">QR Attendance</div>
              <div className="feature-desc">Fast, automated check-ins for lectures and lab sessions.</div>
            </div>
            <div className="feature-card">
              <div className="feature-title">Attendance Reports</div>
              <div className="feature-desc">Exportable logs and compliance data for academic staff.</div>
            </div>
            <div className="feature-card">
              <div className="feature-title">Student Engagement Analytics</div>
              <div className="feature-desc">Actionable metrics to support student participation and retention.</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Sign In Form ── */}
      <div className="login-form-container">
        <div className="login-form-card">

          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
            {theme === "dark" ? <HiOutlineSun /> : <HiOutlineMoon />}
          </button>

          <div className="login-heading">
            <h1>Sign In</h1>
            <p>Enter your credentials to access your account</p>
          </div>

          {error && (
            <div className="login-error">
              <HiOutlineExclamationCircle /><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
              <input
                type="email"
                id="login-email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="login-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="password-toggle"
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <HiOutlineEyeSlash /> : <HiOutlineEye />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              {/* Forgot Password → recovery modal */}
              <button
                type="button"
                onClick={() => setShowRecovery(true)}
                className="forgot-password"
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Activate My Account → activation modal */}
          <div className="login-footer" style={{ marginTop: "0.75rem" }}>
            <span>First time signing in?</span>
            <button
              type="button"
              onClick={() => { setActivationEmail(""); setShowActivation(true); }}
              className="contact-admin-link"
            >
              Activate My Account
            </button>
          </div>

          {/* Contact Administrator → separate contact modal */}
          <div className="login-footer">
            <span>Need help accessing your account?</span>
            <button
              type="button"
              onClick={() => setShowContact(true)}
              className="contact-admin-link"
            >
              Contact the Institute Administrator
            </button>
          </div>
        </div>
      </div>

      {/* Account activation modal */}
      {showActivation && (
        <AccountActivationModal
          initialEmail={activationEmail}
          onClose={() => { setShowActivation(false); setActivationEmail(""); }}
          onSwitchToContact={() => setShowContact(true)}
          onSwitchToRecovery={() => setShowRecovery(true)}
        />
      )}

      {/* Password recovery modal — opened by "Forgot Password?" */}
      {showRecovery && (
        <PasswordRecoveryModal
          onClose={() => setShowRecovery(false)}
          onSwitchToContact={() => setShowContact(true)}
          onSwitchToActivation={() => { setActivationEmail(""); setShowActivation(true); }}
        />
      )}

      {/* Contact admin modal */}
      {showContact && (
        <ContactAdminModal onClose={() => setShowContact(false)} />
      )}
    </div>
  );
}
