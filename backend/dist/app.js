"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const db_1 = __importDefault(require("./database/db"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/", (_req, res) => {
    res.json({
        message: "NBI Institute AI Assistant Backend Running"
    });
});
app.get("/api/test-db", async (_req, res) => {
    try {
        const result = await db_1.default.query("SELECT NOW()");
        res.json({
            message: "PostgreSQL connection successful",
            time: result.rows[0].now
        });
    }
    catch (error) {
        console.error("Database connection error:", error);
        res.status(500).json({
            message: "Database connection failed"
        });
    }
});
app.use("/api/chat", chat_routes_1.default);
app.use("/api/attendance", attendance_routes_1.default);
app.use("/api/auth", auth_routes_1.default);
exports.default = app;
