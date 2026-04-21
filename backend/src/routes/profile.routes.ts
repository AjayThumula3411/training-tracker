import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/rbac.middleware";
import { getProfile, listProfiles, setupProfile, updateProfile } from "../controllers/profile.controller";

const router = express.Router();

router.post("/setup", authenticate, setupProfile);
router.get("/me", authenticate, getProfile);
router.get("/", authenticate, listProfiles);
router.patch("/update", authenticate, updateProfile);
router.patch("/training/status", authenticate, authorizeRoles("HR", "TEAM_LEAD"), updateProfile);
router.get("/:id", authenticate, getProfile);
router.patch("/:id", authenticate, updateProfile);

export default router;
