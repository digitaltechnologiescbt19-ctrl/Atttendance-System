import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import chatRoutes from "./routes/chat.routes";
import attendanceRoutes from "./routes/attendance.routes";
import authRoutes from "./routes/auth.routes";
import pool from "./database/db";

dotenv.config();

const app = express();

/* ------------------------------------------------------------------ */
/*  CORS                                                                */
/*  FRONTEND_URL is set in Vercel environment variables to the         */
/*  deployed frontend URL e.g. https://your-app.vercel.app            */
/*  Falls back to * in development.                                    */
/* ------------------------------------------------------------------ */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Also allow any *.vercel.app subdomain for preview deployments
      if (/\.vercel\.app$/.test(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (_req, res) => {
    res.json({
        message: "NBI Institute AI Assistant Backend Running"
    });
});

app.get("/api/test-db", async (_req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            message: "PostgreSQL connection successful",
            time: result.rows[0].now
        });
    } catch (error) {
        console.error("Database connection error:", error);

        res.status(500).json({
            message: "Database connection failed"
        });
    }
});

app.use("/api/chat", chatRoutes);

app.use("/api/attendance", attendanceRoutes);

app.use("/api/auth", authRoutes);

export default app;