"use strict";
/**
 * NBI Smart Attendance — Auth Controller
 *
 * Handles: login, register (admin-only), verifyEmail, resendCode.
 *
 * All password storage uses bcryptjs (cost 12).
 * JWTs are signed with JWT_SECRET from .env, expire per JWT_EXPIRES_IN.
 * Email delivery goes through email.service.ts (console fallback when
 * SMTP is not configured).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.register = register;
exports.requestActivation = requestActivation;
exports.verifyActivationOtp = verifyActivationOtp;
exports.activateAccount = activateAccount;
exports.verifyEmail = verifyEmail;
exports.resendVerification = resendVerification;
exports.getMe = getMe;
exports.requestPasswordReset = requestPasswordReset;
exports.verifyResetOtp = verifyResetOtp;
exports.resetPassword = resetPassword;
exports.changePassword = changePassword;
exports.updateProfile = updateProfile;
exports.contactAdmin = contactAdmin;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const db_1 = __importDefault(require("../database/db"));
const email_service_1 = require("../services/email.service");
/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function jwtSecret() {
    const s = process.env.JWT_SECRET;
    if (!s)
        throw new Error("JWT_SECRET is not set in environment");
    return s;
}
function signToken(userId, role) {
    return jsonwebtoken_1.default.sign({ sub: userId, role }, jwtSecret(), { expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") });
}
/** Generate a cryptographically random 6-digit numeric code. */
function generateSixDigitCode() {
    // randomInt(100000, 1000000) gives a uniform random integer in [100000, 999999]
    return String((0, crypto_1.randomInt)(100000, 1000000));
}
/** Generate a secure random hex token of a given byte length. */
function generateSecureToken(bytes = 32) {
    return (0, crypto_1.randomBytes)(bytes).toString("hex");
}
/** Generate a unique 6-digit temporary password (same format, different purpose). */
function generateTempPassword() {
    return generateSixDigitCode();
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/login                                                */
/* ------------------------------------------------------------------ */
async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: "Email and password are required." });
            return;
        }
        // 1. Look up the account
        const result = await db_1.default.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
        if (result.rows.length === 0) {
            // Deliberately vague — do not reveal whether the email exists
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }
        const user = result.rows[0];
        // 2. Check account is active
        if (!user.is_active) {
            res.status(403).json({
                message: "This account has been deactivated. Contact the administrator.",
            });
            return;
        }
        // 3. Check account is fully activated (has a password)
        if (user.account_status === "pending_activation" || !user.password_hash) {
            res.status(403).json({
                message: "Your account has not been activated yet. Please use 'Activate My Account' on the login page.",
                requiresActivation: true,
                email: user.email,
            });
            return;
        }
        // 4. Verify password
        const passwordMatch = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!passwordMatch) {
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }
        // 5. Issue JWT
        const token = signToken(user.id, user.role);
        res.json({
            message: "Login successful.",
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                linked_id: user.linked_id ?? null,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Authentication failed. Please try again." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/register  (admin-only, enforced by middleware)       */
/* ------------------------------------------------------------------ */
async function register(req, res) {
    try {
        const { email, name, role, linked_id } = req.body;
        if (!email || !name || !role) {
            res.status(400).json({ message: "email, name and role are required." });
            return;
        }
        const validRoles = ["admin", "lecturer", "student"];
        if (!validRoles.includes(role)) {
            res.status(400).json({ message: `role must be one of: ${validRoles.join(", ")}.` });
            return;
        }
        const normalizedEmail = email.toLowerCase().trim();
        const existing = await db_1.default.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
        if (existing.rows.length > 0) {
            res.status(409).json({ message: "An account with this email already exists." });
            return;
        }
        // Pre-register: NO password. Person activates their own account via OTP.
        const insertResult = await db_1.default.query(`INSERT INTO users
             (email, name, role, linked_id,
              is_verified, is_active, account_status, password_hash, temp_password_used)
             VALUES ($1, $2, $3, $4,
                     FALSE, TRUE, 'pending_activation', NULL, FALSE)
             RETURNING id, email, name, role, linked_id, account_status`, [normalizedEmail, name.trim(), role, linked_id ?? null]);
        const newUser = insertResult.rows[0];
        res.status(201).json({
            message: "Account pre-registered. The person can now activate their account using their registered email.",
            user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                role: newUser.role,
                linked_id: newUser.linked_id,
                account_status: newUser.account_status,
            },
        });
    }
    catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ message: "Failed to pre-register account." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/request-activation                                   */
/*                                                                      */
/*  Step 1 of first-time account activation.                           */
/*  - Only works for accounts in pending_activation state.             */
/*  - 404 if email not found (clear UX, not "forgot password").        */
/*  - Sends OTP to the stored email address.                           */
/*  - Rate-limited: 60 seconds between requests.                       */
/* ------------------------------------------------------------------ */
async function requestActivation(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ message: "email is required." });
            return;
        }
        const normalised = email.toLowerCase().trim();
        const result = await db_1.default.query("SELECT * FROM users WHERE email = $1", [normalised]);
        // No account at all — not registered/pre-approved
        if (result.rows.length === 0) {
            res.status(404).json({
                message: "This email is not associated with an approved NBI Institute account. Please contact the institute administrator if you believe you should have an account.",
                accountMissing: true,
            });
            return;
        }
        const user = result.rows[0];
        // Account is deactivated
        if (!user.is_active) {
            res.status(403).json({
                message: "This account has been deactivated. Please contact the institute administrator.",
                deactivated: true,
            });
            return;
        }
        // Account is already active — they should use "Forgot Password" instead
        if (user.account_status === "active" && user.password_hash) {
            res.status(409).json({
                message: "This account is already activated. Please use 'Forgot Password' if you need to reset your password.",
                alreadyActive: true,
            });
            return;
        }
        // Rate-limit: one request per 60 seconds
        if (user.verification_sent_at) {
            const ageSecs = (Date.now() - new Date(user.verification_sent_at).getTime()) / 1000;
            if (ageSecs < 60) {
                res.status(429).json({
                    message: `Please wait ${Math.ceil(60 - ageSecs)} seconds before requesting another code.`,
                });
                return;
            }
        }
        // Generate CSPRNG OTP — stored plain in CHAR(6)
        const plainCode = generateSixDigitCode();
        await db_1.default.query(`UPDATE users
             SET verification_code    = $1,
                 verification_sent_at = NOW(),
                 reset_token_hash     = NULL,
                 reset_token_expires  = NULL,
                 updated_at           = NOW()
             WHERE id = $2`, [plainCode, user.id]);
        // Send OTP to the user's OWN registered email
        let emailWarning;
        try {
            await (0, email_service_1.sendActivationOtpEmail)(user.email, user.name, user.role, plainCode);
        }
        catch (emailErr) {
            console.error("Activation OTP email failed:", emailErr);
            emailWarning = String(emailErr?.message || "Email delivery failed");
        }
        res.json({
            message: `A verification code has been sent to ${user.email}. Enter it to continue activating your account.`,
            ...(process.env.NODE_ENV !== "production" && {
                _dev: {
                    activationCode: plainCode,
                    emailWarning: emailWarning ?? null,
                    sentTo: user.email,
                },
            }),
        });
    }
    catch (error) {
        console.error("Request activation error:", error);
        res.status(500).json({ message: "Request failed. Please try again." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/verify-activation-otp                                */
/*                                                                      */
/*  Step 2 of activation — verify the OTP.                             */
/*  On success issues a short-lived activation_token (bcrypt-hashed).  */
/*  The plain token is returned for use in Step 3.                     */
/*  OTP is invalidated immediately.                                     */
/* ------------------------------------------------------------------ */
async function verifyActivationOtp(req, res) {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            res.status(400).json({ message: "email and code are required." });
            return;
        }
        const normalised = email.toLowerCase().trim();
        const result = await db_1.default.query("SELECT * FROM users WHERE email = $1", [normalised]);
        if (result.rows.length === 0) {
            res.status(400).json({ message: "Invalid or expired code." });
            return;
        }
        const user = result.rows[0];
        if (!user.is_active) {
            res.status(403).json({ message: "Account is deactivated. Contact the administrator." });
            return;
        }
        if (!user.verification_code || !user.verification_sent_at) {
            res.status(400).json({ message: "No active activation code. Please request a new one." });
            return;
        }
        // Check 30-minute expiry for activation OTP
        const ageMins = (Date.now() - new Date(user.verification_sent_at).getTime()) / (1000 * 60);
        if (ageMins > 30) {
            await db_1.default.query("UPDATE users SET verification_code = NULL, verification_sent_at = NULL, updated_at = NOW() WHERE id = $1", [user.id]);
            res.status(400).json({
                message: "This code has expired. Please request a new one.",
                expired: true,
            });
            return;
        }
        // Trim right-padded CHAR(6)
        const stored = user.verification_code.trim();
        if (code.trim() !== stored) {
            res.status(400).json({ message: "Incorrect code. Please try again." });
            return;
        }
        // OTP valid — generate a short-lived activation token (reuses reset_token columns)
        const plainToken = generateSecureToken(32);
        const tokenHash = await bcryptjs_1.default.hash(plainToken, 8);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await db_1.default.query(`UPDATE users
             SET verification_code    = NULL,
                 verification_sent_at = NULL,
                 reset_token_hash     = $1,
                 reset_token_expires  = $2,
                 updated_at           = NOW()
             WHERE id = $3`, [tokenHash, expiresAt, user.id]);
        res.json({
            message: "Code verified. Please create your password to complete account activation.",
            activation_token: plainToken,
        });
    }
    catch (error) {
        console.error("Verify activation OTP error:", error);
        res.status(500).json({ message: "Verification failed. Please try again." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/activate-account                                     */
/*                                                                      */
/*  Step 3 of activation — set first-time password.                    */
/*  - Validates the activation_token from Step 2.                      */
/*  - Hashes and stores the password.                                   */
/*  - Sets account_status = 'active', is_verified = TRUE.             */
/*  - Clears all OTP/token artefacts.                                  */
/*  - Sends role-specific welcome email.                               */
/*  - Issues JWT so user is immediately signed in.                     */
/* ------------------------------------------------------------------ */
async function activateAccount(req, res) {
    try {
        const { email, activation_token, new_password } = req.body;
        if (!email || !activation_token || !new_password) {
            res.status(400).json({ message: "email, activation_token, and new_password are required." });
            return;
        }
        if (new_password.length < 6) {
            res.status(400).json({ message: "Password must be at least 6 characters." });
            return;
        }
        const normalised = email.toLowerCase().trim();
        const result = await db_1.default.query("SELECT * FROM users WHERE email = $1", [normalised]);
        if (result.rows.length === 0) {
            res.status(400).json({ message: "Invalid activation session." });
            return;
        }
        const user = result.rows[0];
        if (!user.is_active) {
            res.status(403).json({ message: "Account is deactivated. Contact the administrator." });
            return;
        }
        if (!user.reset_token_hash || !user.reset_token_expires) {
            res.status(400).json({ message: "No active activation session. Please start over." });
            return;
        }
        // Check activation token expiry
        if (new Date() > new Date(user.reset_token_expires)) {
            await db_1.default.query("UPDATE users SET reset_token_hash = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $1", [user.id]);
            res.status(400).json({
                message: "Activation session has expired. Please start over.",
                expired: true,
            });
            return;
        }
        // Verify the activation token
        const tokenMatch = await bcryptjs_1.default.compare(activation_token, user.reset_token_hash);
        if (!tokenMatch) {
            res.status(400).json({ message: "Invalid activation session. Please start over." });
            return;
        }
        // Hash the user's chosen password
        const passwordHash = await bcryptjs_1.default.hash(new_password, 12);
        // Activate the account
        await db_1.default.query(`UPDATE users
             SET password_hash       = $1,
                 account_status      = 'active',
                 is_verified         = TRUE,
                 reset_token_hash    = NULL,
                 reset_token_expires = NULL,
                 temp_password_used  = FALSE,
                 updated_at          = NOW()
             WHERE id = $2`, [passwordHash, user.id]);
        // Send role-specific welcome email (non-blocking)
        try {
            await (0, email_service_1.sendWelcomeEmail)(user.email, user.name, user.role);
        }
        catch (emailErr) {
            console.error("Welcome email failed (account still activated):", emailErr);
        }
        // Issue JWT — user is immediately signed in
        const token = signToken(user.id, user.role);
        res.json({
            message: "Account activated successfully. Welcome to NBI Institute!",
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                linked_id: user.linked_id ?? null,
            },
        });
    }
    catch (error) {
        console.error("Activate account error:", error);
        res.status(500).json({ message: "Account activation failed. Please try again." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/verify-email                                         */
/* ------------------------------------------------------------------ */
async function verifyEmail(req, res) {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            res.status(400).json({ message: "email and code are required." });
            return;
        }
        const result = await db_1.default.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: "Account not found." });
            return;
        }
        const user = result.rows[0];
        if (user.is_verified) {
            res.json({ message: "Account is already verified. You can sign in." });
            return;
        }
        // Check code matches
        if (user.verification_code !== code.trim()) {
            res.status(400).json({ message: "Incorrect verification code." });
            return;
        }
        // Check code hasn't expired (24 hours)
        if (user.verification_sent_at) {
            const sentAt = new Date(user.verification_sent_at).getTime();
            const ageHrs = (Date.now() - sentAt) / (1000 * 60 * 60);
            if (ageHrs > 24) {
                res.status(400).json({
                    message: "Verification code has expired. Request a new one.",
                    expired: true,
                });
                return;
            }
        }
        // Mark verified and clear the code
        await db_1.default.query(`UPDATE users
             SET is_verified = TRUE,
                 verification_code = NULL,
                 verification_sent_at = NULL,
                 updated_at = NOW()
             WHERE id = $1`, [user.id]);
        // Issue a token so the user is immediately logged in after verification
        const token = signToken(user.id, user.role);
        res.json({
            message: "Email verified successfully. You can now sign in.",
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                linked_id: user.linked_id ?? null,
            },
        });
    }
    catch (error) {
        console.error("Verify email error:", error);
        res.status(500).json({ message: "Verification failed. Please try again." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/resend-verification                                  */
/* ------------------------------------------------------------------ */
async function resendVerification(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ message: "email is required." });
            return;
        }
        const result = await db_1.default.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
        if (result.rows.length === 0) {
            // Don't reveal whether the account exists
            res.json({ message: "If that email is registered, a new code has been sent." });
            return;
        }
        const user = result.rows[0];
        if (user.is_verified) {
            res.json({ message: "Account is already verified." });
            return;
        }
        // Rate-limit: don't resend more than once per 60 seconds
        if (user.verification_sent_at) {
            const sentAt = new Date(user.verification_sent_at).getTime();
            const ageSecs = (Date.now() - sentAt) / 1000;
            if (ageSecs < 60) {
                res.status(429).json({
                    message: `Please wait ${Math.ceil(60 - ageSecs)} seconds before requesting another code.`,
                });
                return;
            }
        }
        const newCode = generateSixDigitCode();
        await db_1.default.query(`UPDATE users
             SET verification_code = $1,
                 verification_sent_at = NOW(),
                 updated_at = NOW()
             WHERE id = $2`, [newCode, user.id]);
        try {
            await (0, email_service_1.sendVerificationEmail)(user.email, user.name, newCode);
        }
        catch (emailErr) {
            console.error("Resend email failed:", emailErr);
        }
        res.json({
            message: "If that email is registered, a new code has been sent.",
            ...(process.env.NODE_ENV !== "production" && {
                _dev: { verificationCode: newCode },
            }),
        });
    }
    catch (error) {
        console.error("Resend verification error:", error);
        res.status(500).json({ message: "Failed to resend verification code." });
    }
}
/* ------------------------------------------------------------------ */
/*  GET /api/auth/me  (requires valid JWT — used by frontend on reload) */
/* ------------------------------------------------------------------ */
async function getMe(req, res) {
    try {
        // req.userId is set by the authenticate middleware
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ message: "Unauthorised." });
            return;
        }
        const result = await db_1.default.query("SELECT id, email, name, role, linked_id FROM users WHERE id = $1 AND is_active = TRUE", [userId]);
        if (result.rows.length === 0) {
            res.status(401).json({ message: "Account not found or deactivated." });
            return;
        }
        res.json({ user: result.rows[0] });
    }
    catch (error) {
        console.error("Get me error:", error);
        res.status(500).json({ message: "Failed to fetch user." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/request-password-reset                              */
/*                                                                      */
/*  Step 1 — Request an OTP.                                            */
/*  - Always returns a neutral message.                                 */
/*  - Uses crypto.randomInt for CSPRNG OTP generation.                 */
/*  - Rate-limited: 60 seconds between requests per email.             */
/*  - SMTP failures are logged AND surfaced as a warning in dev mode.  */
/* ------------------------------------------------------------------ */
async function requestPasswordReset(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ message: "email is required." });
            return;
        }
        const normalised = email.toLowerCase().trim();
        const result = await db_1.default.query("SELECT * FROM users WHERE email = $1", [normalised]);
        // Account does not exist — tell the user clearly so they can contact admin
        if (result.rows.length === 0) {
            res.status(404).json({
                message: "No approved account was found for this email address.",
                accountMissing: true,
            });
            return;
        }
        const user = result.rows[0];
        // Account exists but is deactivated
        if (!user.is_active) {
            res.status(403).json({
                message: "This account has been deactivated. Please contact the institute administrator.",
                deactivated: true,
            });
            return;
        }
        // Account is pending activation — must use "Activate My Account" flow instead
        if (user.account_status === "pending_activation" || !user.password_hash) {
            res.status(403).json({
                message: "This account has not been activated yet. Please use 'Activate My Account' to set up your account first.",
                requiresActivation: true,
            });
            return;
        }
        // Rate-limit: one request per 60 seconds
        if (user.verification_sent_at) {
            const ageSecs = (Date.now() - new Date(user.verification_sent_at).getTime()) / 1000;
            if (ageSecs < 60) {
                res.status(429).json({
                    message: `Please wait ${Math.ceil(60 - ageSecs)} seconds before requesting another code.`,
                });
                return;
            }
        }
        // CSPRNG 6-digit OTP stored plain in CHAR(6) column
        const plainCode = generateSixDigitCode();
        // Clear any stale reset token and store new OTP
        await db_1.default.query(`UPDATE users
             SET verification_code    = $1,
                 verification_sent_at = NOW(),
                 reset_token_hash     = NULL,
                 reset_token_expires  = NULL,
                 updated_at           = NOW()
             WHERE id = $2`, [plainCode, user.id]);
        // Send OTP to the user's OWN stored email address (not any hardcoded address)
        let emailWarning;
        try {
            await (0, email_service_1.sendPasswordResetEmail)(user.email, user.name, plainCode);
        }
        catch (emailErr) {
            console.error("Password reset email failed:", emailErr);
            emailWarning = String(emailErr?.message || "Email delivery failed");
        }
        res.json({
            message: `A verification code has been sent to ${user.email}.`,
            // In non-production expose the OTP and any email warning for developer testing
            ...(process.env.NODE_ENV !== "production" && {
                _dev: {
                    resetCode: plainCode,
                    emailWarning: emailWarning ?? null,
                    sentTo: user.email,
                },
            }),
        });
    }
    catch (error) {
        console.error("Request password reset error:", error);
        res.status(500).json({ message: "Request failed. Please try again." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/verify-reset-otp                                     */
/*                                                                      */
/*  Step 2 — Verify the OTP.                                            */
/*  On success, issues a short-lived (15-min) reset token (bcrypt      */
/*  hash stored in reset_token_hash).  The token is returned to the     */
/*  frontend as a plain hex string and must be presented in Step 3.    */
/*  The OTP is invalidated immediately after successful verification.   */
/* ------------------------------------------------------------------ */
async function verifyResetOtp(req, res) {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            res.status(400).json({ message: "email and code are required." });
            return;
        }
        const normalised = email.toLowerCase().trim();
        const result = await db_1.default.query("SELECT * FROM users WHERE email = $1", [normalised]);
        if (result.rows.length === 0) {
            res.status(400).json({ message: "Invalid or expired code." });
            return;
        }
        const user = result.rows[0];
        if (!user.is_active) {
            res.status(403).json({ message: "Account is deactivated. Contact the administrator." });
            return;
        }
        if (!user.verification_code || !user.verification_sent_at) {
            res.status(400).json({ message: "No active reset code. Please request a new one." });
            return;
        }
        // Check 15-minute expiry
        const ageMins = (Date.now() - new Date(user.verification_sent_at).getTime()) / (1000 * 60);
        if (ageMins > 15) {
            // Clear the stale OTP
            await db_1.default.query("UPDATE users SET verification_code = NULL, verification_sent_at = NULL, updated_at = NOW() WHERE id = $1", [user.id]);
            res.status(400).json({
                message: "This code has expired. Please request a new one.",
                expired: true,
            });
            return;
        }
        // Trim the stored CHAR(6) value — PostgreSQL right-pads CHAR columns
        const stored = user.verification_code.trim();
        if (code.trim() !== stored) {
            res.status(400).json({ message: "Incorrect code. Please try again." });
            return;
        }
        // OTP valid — generate a secure short-lived reset token
        const plainToken = generateSecureToken(32); // 64-char hex
        const tokenHash = await bcryptjs_1.default.hash(plainToken, 8); // fast hash; not a password
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
        // Clear OTP, store hashed reset token
        await db_1.default.query(`UPDATE users
             SET verification_code    = NULL,
                 verification_sent_at = NULL,
                 reset_token_hash     = $1,
                 reset_token_expires  = $2,
                 updated_at           = NOW()
             WHERE id = $3`, [tokenHash, expiresAt, user.id]);
        // Return the plain token to the frontend — it will be presented in Step 3
        res.json({
            message: "Code verified. You may now set a new password.",
            reset_token: plainToken,
        });
    }
    catch (error) {
        console.error("Verify reset OTP error:", error);
        res.status(500).json({ message: "Verification failed. Please try again." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/reset-password                                       */
/*                                                                      */
/*  Step 3 — Set a new password.                                        */
/*  Validates the reset_token issued in Step 2 (NOT the OTP).          */
/*  On success: hashes password, clears the reset token, issues JWT.   */
/* ------------------------------------------------------------------ */
async function resetPassword(req, res) {
    try {
        const { email, reset_token, new_password } = req.body;
        if (!email || !reset_token || !new_password) {
            res.status(400).json({ message: "email, reset_token, and new_password are required." });
            return;
        }
        if (new_password.length < 6) {
            res.status(400).json({ message: "Password must be at least 6 characters." });
            return;
        }
        const normalised = email.toLowerCase().trim();
        const result = await db_1.default.query("SELECT * FROM users WHERE email = $1", [normalised]);
        if (result.rows.length === 0) {
            res.status(400).json({ message: "Invalid reset session." });
            return;
        }
        const user = result.rows[0];
        if (!user.is_active) {
            res.status(403).json({ message: "Account is deactivated. Contact the administrator." });
            return;
        }
        if (!user.reset_token_hash || !user.reset_token_expires) {
            res.status(400).json({ message: "No active reset session. Please start over." });
            return;
        }
        // Check reset token expiry
        if (new Date() > new Date(user.reset_token_expires)) {
            await db_1.default.query("UPDATE users SET reset_token_hash = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $1", [user.id]);
            res.status(400).json({
                message: "Reset session has expired. Please start over.",
                expired: true,
            });
            return;
        }
        // Verify the reset token (bcrypt compare)
        const tokenMatch = await bcryptjs_1.default.compare(reset_token, user.reset_token_hash);
        if (!tokenMatch) {
            res.status(400).json({ message: "Invalid reset session. Please start over." });
            return;
        }
        // All checks passed — hash new password, clear reset artefacts
        const newHash = await bcryptjs_1.default.hash(new_password, 12);
        await db_1.default.query(`UPDATE users
             SET password_hash       = $1,
                 reset_token_hash    = NULL,
                 reset_token_expires = NULL,
                 is_verified         = TRUE,
                 updated_at          = NOW()
             WHERE id = $2`, [newHash, user.id]);
        // Issue a full JWT — user is immediately signed in after resetting
        const token = signToken(user.id, user.role);
        res.json({
            message: "Password reset successfully. You are now signed in.",
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                linked_id: user.linked_id ?? null,
            },
        });
    }
    catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ message: "Password reset failed. Please try again." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/change-password  (requires valid JWT)               */
/*                                                                      */
/*  Authenticated user provides their current password + new password. */
/*  Backend verifies current password, hashes the new one, updates.    */
/* ------------------------------------------------------------------ */
async function changePassword(req, res) {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ message: "Unauthorised." });
            return;
        }
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            res.status(400).json({ message: "current_password and new_password are required." });
            return;
        }
        if (new_password.length < 6) {
            res.status(400).json({ message: "New password must be at least 6 characters." });
            return;
        }
        // Fetch the current hash
        const result = await db_1.default.query("SELECT password_hash FROM users WHERE id = $1 AND is_active = TRUE", [userId]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: "Account not found or deactivated." });
            return;
        }
        // Verify current password
        const match = await bcryptjs_1.default.compare(current_password, result.rows[0].password_hash);
        if (!match) {
            res.status(400).json({ message: "Current password is incorrect." });
            return;
        }
        // Hash new password and save
        const newHash = await bcryptjs_1.default.hash(new_password, 12);
        await db_1.default.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [newHash, userId]);
        res.json({ message: "Password changed successfully." });
    }
    catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ message: "Failed to change password." });
    }
}
/* ------------------------------------------------------------------ */
/*  PATCH /api/auth/profile                                             */
/*                                                                      */
/*  Allows an authenticated lecturer or student to update their own profile */
/*  fields and synchronises users.name. Identity comes from users.linked_id. */
/*  Identity MUST be derived from req.userId → users.linked_id.          */
/* ------------------------------------------------------------------ */
async function updateProfile(req, res) {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ message: "Unauthorised." });
            return;
        }
        const { full_name, department } = req.body;
        if ((full_name === undefined || full_name === null) && (department === undefined || department === null)) {
            res.status(400).json({ message: "At least one of full_name or department is required." });
            return;
        }
        // Fetch the user and confirm they are a lecturer with a linked_id
        const userRes = await db_1.default.query("SELECT id, role, linked_id FROM users WHERE id = $1 AND is_active = TRUE", [userId]);
        if (userRes.rows.length === 0) {
            res.status(401).json({ message: "Account not found or deactivated." });
            return;
        }
        const user = userRes.rows[0];
        if (user.role === "student") {
            if (req.body?.student_id !== undefined || req.body?.id !== undefined || req.body?.linked_id !== undefined) {
                res.status(403).json({ message: "Student profile identity is determined by the authenticated account." });
                return;
            }
            if (full_name === undefined || department !== undefined) {
                res.status(400).json({ message: "Students may update full_name only." });
                return;
            }
            const value = String(full_name).trim();
            if (value.length === 0) {
                res.status(400).json({ message: "full_name cannot be empty." });
                return;
            }
            const studentId = user.linked_id;
            if (!studentId) {
                res.status(403).json({ message: "No linked student profile found for this account." });
                return;
            }
            const client = await db_1.default.connect();
            try {
                await client.query("BEGIN");
                const studentRes = await client.query("UPDATE students SET full_name = $1 WHERE id = $2 RETURNING id, student_number, full_name, email, programme", [value, studentId]);
                if (studentRes.rows.length === 0) {
                    await client.query("ROLLBACK");
                    res.status(404).json({ message: "Student profile not found." });
                    return;
                }
                await client.query("UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2", [value, userId]);
                await client.query("COMMIT");
                res.json({ message: "Profile updated successfully.", student: studentRes.rows[0] });
                return;
            }
            catch (txErr) {
                await client.query("ROLLBACK");
                console.error("updateProfile student transaction error:", txErr);
                res.status(500).json({ message: "Failed to update profile." });
                return;
            }
            finally {
                client.release();
            }
        }
        if (user.role !== 'lecturer') {
            res.status(403).json({ message: "Access denied. Only lecturers may update this profile." });
            return;
        }
        const lecturerId = user.linked_id;
        if (!lecturerId) {
            res.status(403).json({ message: "No linked lecturer profile found for this account." });
            return;
        }
        // Validate inputs (minimal, follow existing conventions)
        const updates = [];
        if (full_name !== undefined) {
            const v = String(full_name).trim();
            if (v.length === 0) {
                res.status(400).json({ message: "full_name cannot be empty." });
                return;
            }
            updates.push({ sql: "full_name", value: v });
        }
        if (department !== undefined) {
            const v = String(department).trim();
            if (v.length === 0) {
                res.status(400).json({ message: "department cannot be empty." });
                return;
            }
            updates.push({ sql: "department", value: v });
        }
        // Perform transactional update: lecturers + users.name
        const client = await db_1.default.connect();
        try {
            await client.query("BEGIN");
            // Build lecturer update SQL dynamically for allowed fields only
            if (updates.length > 0) {
                const setClauses = updates.map((u, i) => `${u.sql} = $${i + 1}`).join(", ");
                const values = updates.map(u => u.value);
                // Append updated_at
                const idx = values.length + 1;
                const lecturerUpdateSql = `UPDATE lecturers SET ${setClauses} WHERE id = $${idx} RETURNING id, lecturer_number, full_name, email, department, created_at`;
                values.push(lecturerId);
                const lecRes = await client.query(lecturerUpdateSql, values);
                if (lecRes.rows.length === 0) {
                    await client.query("ROLLBACK");
                    res.status(404).json({ message: "Lecturer profile not found." });
                    return;
                }
                // Also update users.name to keep AuthContext in sync
                await client.query("UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2", [lecRes.rows[0].full_name, userId]);
                await client.query("COMMIT");
                res.json({ message: "Profile updated successfully.", lecturer: lecRes.rows[0] });
                return;
            }
            // Nothing to update (shouldn't reach here thanks to earlier check)
            await client.query("ROLLBACK");
            res.status(400).json({ message: "No supported fields to update." });
        }
        catch (txErr) {
            await client.query("ROLLBACK");
            console.error("updateProfile transaction error:", txErr);
            res.status(500).json({ message: "Failed to update profile." });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error("updateProfile error:", error);
        res.status(500).json({ message: "Failed to update profile." });
    }
}
/* ------------------------------------------------------------------ */
/*  POST /api/auth/contact-admin  (public)                             */
/*                                                                      */
/*  Delivers a contact/inquiry message to the institute's configured   */
/*  SMTP inbox.  This is for people WITHOUT an approved account.       */
/*  The recipient is SMTP_USER (the institute inbox), NOT any          */
/*  hardcoded @nbi address.                                            */
/* ------------------------------------------------------------------ */
async function contactAdmin(req, res) {
    try {
        const { name, email, message } = req.body;
        if (!email || !message) {
            res.status(400).json({ message: "email and message are required." });
            return;
        }
        if (message.trim().length < 10) {
            res.status(400).json({ message: "Message must be at least 10 characters." });
            return;
        }
        // Basic email format validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            res.status(400).json({ message: "Please enter a valid email address." });
            return;
        }
        const senderName = (name ?? "").trim() || "Anonymous";
        const senderEmail = email.trim().toLowerCase();
        // Send message to institute inbox (SMTP_USER)
        try {
            await (0, email_service_1.sendContactAdminEmail)({ senderName, senderEmail, message: message.trim() });
        }
        catch (emailErr) {
            console.error("Contact-admin email failed:", emailErr);
            res.status(503).json({
                message: "Unable to deliver your message at this time. Please try again later.",
            });
            return;
        }
        res.json({
            message: "Your message has been delivered to the institute administrator.",
        });
    }
    catch (error) {
        console.error("Contact admin error:", error);
        res.status(500).json({ message: "Failed to send message. Please try again." });
    }
}
