import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getNotifications, markNotificationRead } from "../controllers/notification.controller";

const router = express.Router();

router.get("/", authenticate, getNotifications);
router.patch("/:id/read", authenticate, markNotificationRead);

export default router;
