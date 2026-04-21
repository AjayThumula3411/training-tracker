import express from "express";
import {
  createTask,
  updateTaskStatus,
  getAllTasks,
  getAssignableDevelopers,
  getTasksByDeveloper,
  updateTaskDetails,
  deleteTask,
} from "../controllers/task.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/rbac.middleware";

const router = express.Router();

// ================= CREATE TASK =================
router.post(
  "/create",
  authenticate,
  authorizeRoles("HR", "TEAM_LEAD"),
  createTask
);

// ================= ASSIGN TASK =================
router.post(
  "/assign",
  authenticate,
  authorizeRoles("HR", "TEAM_LEAD"),
  createTask
);

// ================= GET TASKS =================
router.get("/", authenticate, getAllTasks);
router.get(
  "/assignable-developers",
  authenticate,
  authorizeRoles("HR", "TEAM_LEAD"),
  getAssignableDevelopers
);
router.get("/:developerId", authenticate, getTasksByDeveloper);

// ================= UPDATE TASK DETAILS =================
router.put(
  "/:id",
  authenticate,
  authorizeRoles("HR", "TEAM_LEAD"),
  updateTaskDetails
);

// ================= DELETE TASK =================
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("HR"),
  deleteTask
);

// ================= UPDATE STATUS =================
router.put(
  "/:id/status",
  authenticate,
  updateTaskStatus
);

router.patch(
  "/:id/status",
  authenticate,
  updateTaskStatus
);

router.patch(
  "/status/:id",
  authenticate,
  updateTaskStatus
);

router.patch(
  "/status",
  authenticate,
  updateTaskStatus
);

export default router;
