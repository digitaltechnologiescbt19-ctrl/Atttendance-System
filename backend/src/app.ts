import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import chatRoutes from "./routes/chat.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
    res.json({
        message: "NBI Institute AI Assistant Backend Running"
    });
});

app.use("/api/chat", chatRoutes);

export default app;