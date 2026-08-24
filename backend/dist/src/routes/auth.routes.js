"use strict";
/**
 * NBI Smart Attendance — Auth Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/* ── Public ── */
router.post("/login", auth_controller_1.login);
router.post("/contact-admin", auth_controller_1.contactAdmin);
/* ── Account Activation (first-time, 3 steps) ── */
router.post("/request-activation", auth_controller_1.requestActivation); // Step 1: send OTP to registered email
router.post("/verify-activation-otp", auth_controller_1.verifyActivationOtp); // Step 2: verify OTP → activation_token
router.post("/activate-account", auth_controller_1.activateAccount); // Step 3: set password → account active
/* ── Password Reset for ACTIVE accounts (3 steps) ── */
router.post("/request-password-reset", auth_controller_1.requestPasswordReset); // Step 1: send OTP
router.post("/verify-reset-otp", auth_controller_1.verifyResetOtp); // Step 2: verify OTP → reset_token
router.post("/reset-password", auth_controller_1.resetPassword); // Step 3: set new password
/* ── Legacy (kept for VerifyEmail page compatibility) ── */
router.post("/verify-email", auth_controller_1.verifyEmail);
router.post("/resend-verification", auth_controller_1.resendVerification);
/* ── Admin only ── */
router.post("/register", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)("admin"), auth_controller_1.register);
/* ── Any authenticated user ── */
router.get("/me", auth_middleware_1.authenticate, auth_controller_1.getMe);
router.post("/change-password", auth_middleware_1.authenticate, auth_controller_1.changePassword);
// Update authenticated user's lecturer profile (self-service)
router.patch("/profile", auth_middleware_1.authenticate, auth_controller_1.updateProfile);
exports.default = router;
