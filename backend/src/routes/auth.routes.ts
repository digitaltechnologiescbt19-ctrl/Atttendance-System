/**
 * NBI Smart Attendance — Auth Routes
 */

import { Router } from "express";
import {
    login,
    register,
    verifyEmail,
    resendVerification,
    getMe,
    requestPasswordReset,
    verifyResetOtp,
    resetPassword,
    changePassword,
    contactAdmin,
    updateProfile,
    requestActivation,
    verifyActivationOtp,
    activateAccount,
} from "../controllers/auth.controller";
import { authenticate, requireRole } from "../middleware/auth.middleware";

const router = Router();

/* ── Public ── */
router.post("/login",                   login);
router.post("/contact-admin",           contactAdmin);

/* ── Account Activation (first-time, 3 steps) ── */
router.post("/request-activation",      requestActivation);   // Step 1: send OTP to registered email
router.post("/verify-activation-otp",   verifyActivationOtp); // Step 2: verify OTP → activation_token
router.post("/activate-account",        activateAccount);     // Step 3: set password → account active

/* ── Password Reset for ACTIVE accounts (3 steps) ── */
router.post("/request-password-reset",  requestPasswordReset); // Step 1: send OTP
router.post("/verify-reset-otp",        verifyResetOtp);       // Step 2: verify OTP → reset_token
router.post("/reset-password",          resetPassword);        // Step 3: set new password

/* ── Legacy (kept for VerifyEmail page compatibility) ── */
router.post("/verify-email",            verifyEmail);
router.post("/resend-verification",     resendVerification);

/* ── Admin only ── */
router.post(
    "/register",
    authenticate,
    requireRole("admin"),
    register
);

/* ── Any authenticated user ── */
router.get("/me",              authenticate, getMe);
router.post("/change-password", authenticate, changePassword);
// Update authenticated user's lecturer profile (self-service)
router.patch("/profile", authenticate, updateProfile);

export default router;
