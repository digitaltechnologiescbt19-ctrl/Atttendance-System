/**
 * NBI Smart Attendance — Auth Middleware
 *
 * authenticate  — verifies the Bearer JWT on every protected route.
 *                 Attaches userId and userRole to the request.
 * requireRole   — role-based access control guard.
 *                 Use after authenticate.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/* Extend Express Request with our own fields */
export interface AuthRequest extends Request {
    userId:   number;
    userRole: string;
}

interface JwtPayload {
    sub:  number;
    role: string;
    iat?: number;
    exp?: number;
}

/* ------------------------------------------------------------------ */
/*  authenticate                                                        */
/* ------------------------------------------------------------------ */

export function authenticate(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ message: "Authentication required." });
        return;
    }

    const token  = header.slice(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        console.error("JWT_SECRET is not configured");
        res.status(500).json({ message: "Server configuration error." });
        return;
    }

    try {
        const payload = jwt.verify(token, secret) as unknown as JwtPayload;
        (req as AuthRequest).userId   = payload.sub;
        (req as AuthRequest).userRole = payload.role;
        // removed temporary debug logging
        next();
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            res.status(401).json({ message: "Session expired. Please sign in again." });
        } else {
            res.status(401).json({ message: "Invalid or expired token." });
        }
    }
}

/* ------------------------------------------------------------------ */
/*  requireRole                                                         */
/* ------------------------------------------------------------------ */

export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const role = (req as AuthRequest).userRole;

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
