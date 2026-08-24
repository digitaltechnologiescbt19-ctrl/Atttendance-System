"use strict";
/**
 * NBI Smart Attendance — Auth Middleware
 *
 * authenticate  — verifies the Bearer JWT on every protected route.
 *                 Attaches userId and userRole to the request.
 * requireRole   — role-based access control guard.
 *                 Use after authenticate.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/* ------------------------------------------------------------------ */
/*  authenticate                                                        */
/* ------------------------------------------------------------------ */
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ message: "Authentication required." });
        return;
    }
    const token = header.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error("JWT_SECRET is not configured");
        res.status(500).json({ message: "Server configuration error." });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        req.userId = payload.sub;
        req.userRole = payload.role;
        // removed temporary debug logging
        next();
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({ message: "Session expired. Please sign in again." });
        }
        else {
            res.status(401).json({ message: "Invalid or expired token." });
        }
    }
}
/* ------------------------------------------------------------------ */
/*  requireRole                                                         */
/* ------------------------------------------------------------------ */
function requireRole(...roles) {
    return (req, res, next) => {
        const role = req.userRole;
        // removed temporary debug logging
        if (!role || !roles.includes(role)) {
            res.status(403).json({
                message: `Access denied. Required role: ${roles.join(" or ")}.`,
            });
            return;
        }
        next();
    };
}
