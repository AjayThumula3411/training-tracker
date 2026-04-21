import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getAuditLogs } from "../controllers/audit.controller";

const router = express.Router();

router.get("/", authenticate, getAuditLogs);

export default router;
