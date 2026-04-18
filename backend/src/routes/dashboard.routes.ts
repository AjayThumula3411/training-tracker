import express from "express";
import { getDashboard } from "../controllers/dashboard.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/", authenticate, getDashboard);

export default router;