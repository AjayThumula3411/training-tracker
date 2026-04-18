import express from "express";
import { Role, TrainingStatus } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/rbac.middleware";
import prisma from "../prisma/client";
import { createAuditLog, createNotification } from "../utils/activity";

const router = express.Router();

const publicProfileSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  department: true,
  photoUrl: true,
  skills: true,
  githubUrl: true,
  linkedinUrl: true,
  internalNotes: true,
  trainingStatus: true,
  trainingProgress: true,
  trainingStartDate: true,
  trainingEndDate: true,
  joinDate: true,
  createdAt: true,
  updatedAt: true,
};

const restrictedProfileSelect = {
  ...publicProfileSelect,
  internalNotes: false,
};

const getProfileSelect = (viewer: AuthRequest["user"]) =>
  viewer?.role === Role.HR || viewer?.role === Role.TEAM_LEAD ? publicProfileSelect : restrictedProfileSelect;

const canViewProfile = (viewer: AuthRequest["user"], profileId: string) => {
  return Boolean(viewer);
};

const canEditProfile = (viewer: AuthRequest["user"], profileId: string) => {
  if (!viewer) return false;
  return viewer.id === profileId || viewer.role === Role.HR;
};

router.post("/setup", authenticate, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { department, skills, githubUrl, linkedinUrl, photoUrl } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        department,
        skills: Array.isArray(skills) ? skills : [],
        githubUrl,
        linkedinUrl,
        photoUrl,
      },
      select: publicProfileSelect,
    });

    res.json({ message: "Profile setup completed", user: updatedUser });
  } catch {
    res.status(500).json({ message: "Error setting up profile" });
  }
});

router.get("/me", authenticate, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: publicProfileSelect,
  });

  if (!user || !user.isActive) return res.status(404).json({ message: "Profile not found" });

  res.json(user);
});

router.get("/", authenticate, async (req: AuthRequest, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: getProfileSelect(req.user),
    orderBy: { name: "asc" },
  });

  res.json(users);
});

router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.params;

  if (!canViewProfile(req.user, id)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: getProfileSelect(req.user),
    });

    if (!user || !user.isActive) return res.status(404).json({ message: "Profile not found" });

    res.json(user);
  } catch {
    res.status(500).json({ message: "Error fetching profile" });
  }
});

router.patch("/:id", authenticate, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.params;
  const { name, department, photoUrl, skills, githubUrl, linkedinUrl, internalNotes } = req.body;

  if (!canEditProfile(req.user, id)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existingUser || !existingUser.isActive) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        department,
        photoUrl,
        skills: Array.isArray(skills) ? skills : undefined,
        githubUrl,
        linkedinUrl,
        internalNotes:
          req.user.role === Role.HR || req.user.role === Role.TEAM_LEAD
            ? internalNotes
            : undefined,
      },
      select: publicProfileSelect,
    });

    await createAuditLog("PROFILE_UPDATED", "User", req.user.id, id, {
      fields: Object.keys(req.body),
    });

    res.json({ message: "Profile updated", user: updatedUser });
  } catch {
    res.status(500).json({ message: "Error updating profile" });
  }
});

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles(Role.TEAM_LEAD),
  async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { trainingStatus, trainingProgress, trainingStartDate, trainingEndDate } = req.body;

    if (!Object.values(TrainingStatus).includes(trainingStatus)) {
      return res.status(400).json({ message: "Invalid training status" });
    }

    if (
      trainingProgress !== undefined &&
      (typeof trainingProgress !== "number" || Number.isNaN(trainingProgress) || trainingProgress < 0 || trainingProgress > 100)
    ) {
      return res.status(400).json({ message: "Training progress must be between 0 and 100" });
    }

    try {
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, isActive: true, role: true },
      });

      if (!existingUser || !existingUser.isActive) {
        return res.status(404).json({ message: "Profile not found" });
      }

      if (existingUser.role !== Role.JUNIOR_DEV && existingUser.role !== Role.SENIOR_DEV) {
        return res.status(403).json({ message: "Training progress can only be updated for developers" });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          trainingStatus,
          trainingProgress:
            trainingProgress !== undefined ? Math.round(trainingProgress) : undefined,
          trainingStartDate: trainingStartDate ? new Date(trainingStartDate) : undefined,
          trainingEndDate: trainingEndDate ? new Date(trainingEndDate) : undefined,
        },
        select: publicProfileSelect,
      });

      await createNotification(
        id,
        `Training updated: ${trainingStatus.replaceAll("_", " ")}${trainingProgress !== undefined ? ` (${Math.round(trainingProgress)}%)` : ""}`
      );
      await createAuditLog("TRAINING_STATUS_CHANGED", "User", req.user?.id || "system", id, {
        trainingStatus,
        trainingProgress,
      });

      res.json(updatedUser);
    } catch {
      res.status(500).json({ message: "Error updating training status" });
    }
  }
);

export default router;
