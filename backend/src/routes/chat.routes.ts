import { Router } from "express";
import { handleChatMessage } from "../controllers/chat.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", (_req, res) => {
    res.json({
        message: "NBI AI Assistant Chat API Active",
    });
});

router.post("/", authenticate, handleChatMessage);

export default router;
