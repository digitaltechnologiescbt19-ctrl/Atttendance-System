import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
    res.json({
        message: "Chat API is working"
    });
});

export default router;
