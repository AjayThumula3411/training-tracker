import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/rbac.middleware";
import {
  getProfile,
  listProfiles,
  setupProfile,
  updateProfile,
  updateTrainingStatus,
  uploadProfilePhoto,
} from "../controllers/profile.controller";

const router = express.Router();

router.post("/setup", authenticate, setupProfile);
router.post("/photo", authenticate, uploadProfilePhoto);
router.get("/me", authenticate, getProfile);
router.get("/", authenticate, listProfiles);
router.patch("/update", authenticate, updateProfile);
router.patch("/training/status", authenticate, authorizeRoles("HR", "TEAM_LEAD"), updateTrainingStatus);
router.post("/:id/photo", authenticate, uploadProfilePhoto);
router.get("/:id", authenticate, getProfile);
router.patch("/:id", authenticate, updateProfile);

export default router;
