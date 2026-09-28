import { Router } from "express";
import {
    handleChatMessage,
    getChatHistory,
    clearChatHistory,
    deleteChatMessage,
    editChatMessage
} from "../controllers/chat.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", (_req, res) => {
    res.json({
        message: "NBI AI Assistant Chat API Active",
    });
});

router.get("/history", authenticate, getChatHistory);
router.delete("/history", authenticate, clearChatHistory);
router.delete("/messages/:id", authenticate, deleteChatMessage);
router.put("/messages/:id", authenticate, editChatMessage);
router.post("/", authenticate, handleChatMessage);

export default router;
