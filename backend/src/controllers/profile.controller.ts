import { Response } from "express";
import { NotificationType, Role, TaskStatus, TrainingStatus } from "@prisma/client";
import prisma from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";
import { createAuditLog, createNotification } from "../utils/activity";

const developerRoles: Role[] = [Role.JUNIOR_DEV, Role.SENIOR_DEV];
const trainingStatuses = Object.values(TrainingStatus);

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

const allowedProfileFields = new Set([
  "name",
  "email",
  "role",
  "department",
  "photoUrl",
  "joinDate",
  "trainingStartDate",
  "trainingEndDate",
  "trainingStatus",
  "trainingProgress",
  "skills",
  "githubUrl",
  "linkedinUrl",
  "internalNotes",
]);

const setupFields = new Set(["name", "photoUrl", "skills", "githubUrl", "linkedinUrl"]);

const getProfileSelect = (viewer: AuthRequest["user"]) =>
  viewer?.role === Role.HR || viewer?.role === Role.TEAM_LEAD ? publicProfileSelect : restrictedProfileSelect;

const isDeveloper = (role?: Role) => Boolean(role && developerRoles.includes(role));

const canViewProfile = (viewer: AuthRequest["user"], profileId: string) => {
  if (!viewer) return false;
  if (viewer.role === Role.HR || viewer.role === Role.TEAM_LEAD) return true;
  return viewer.id === profileId && isDeveloper(viewer.role);
};

const parseOptionalDate = (value: unknown, fieldName: string) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a valid date`);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return parsed;
};

const parseRequiredDateField = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a valid date`);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return parsed;
};

const parseSkills = (value: unknown) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("Skills must be an array of strings");
  }

  return value.map((entry) => entry.trim()).filter(Boolean);
};

const parseTrainingProgress = (value: unknown) => {
  if (value === undefined) return undefined;

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("Training progress must be a number between 0 and 100");
  }

  return Math.round(parsed);
};

const calculateProgress = async (userIds: string[]) => {
  if (userIds.length === 0) {
    return new Map<string, number>();
  }

  const [totals, completed] = await Promise.all([
    prisma.task.groupBy({
      by: ["assignedToId"],
      where: { assignedToId: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["assignedToId"],
      where: {
        assignedToId: { in: userIds },
        status: TaskStatus.COMPLETED,
      },
      _count: { _all: true },
    }),
  ]);

  const totalMap = new Map(totals.map((entry) => [entry.assignedToId, entry._count._all]));
  const completedMap = new Map(completed.map((entry) => [entry.assignedToId, entry._count._all]));

  return new Map(
    userIds.map((userId) => {
      const total = totalMap.get(userId) ?? 0;
      const done = completedMap.get(userId) ?? 0;
      const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
      return [userId, percentage];
    })
  );
};

const validateRequestedFields = (payload: Record<string, unknown>, allowedFields: Set<string>) => {
  const requestedFields = Object.keys(payload).filter((field) => field !== "id");
  const unsupportedFields = requestedFields.filter((field) => !allowedProfileFields.has(field));

  if (unsupportedFields.length > 0) {
    return {
      status: 400 as const,
      message: `Unsupported profile fields: ${unsupportedFields.join(", ")}`,
    };
  }

  const forbiddenFields = requestedFields.filter((field) => !allowedFields.has(field));

  if (forbiddenFields.length > 0) {
    return {
      status: 403 as const,
      message: `Access denied for fields: ${forbiddenFields.join(", ")}`,
    };
  }

  return null;
};

const buildAllowedFieldSet = (viewer: AuthRequest["user"], targetUserId: string) => {
  const allowedFields = new Set<string>();

  if (!viewer) return allowedFields;

  const isSelf = viewer.id === targetUserId;
  const isDeveloperSelf = isSelf && isDeveloper(viewer.role);

  if (viewer.role === Role.HR) {
    allowedProfileFields.forEach((field) => {
      if (!(field === "role" && isSelf)) {
        allowedFields.add(field);
      }
    });

    return allowedFields;
  }

  if (viewer.role === Role.TEAM_LEAD) {
    ["name", "photoUrl", "skills", "githubUrl", "linkedinUrl", "internalNotes"].forEach((field) =>
      allowedFields.add(field)
    );

    if (!isSelf) {
      ["trainingStartDate", "trainingEndDate", "trainingStatus", "trainingProgress"].forEach((field) =>
        allowedFields.add(field)
      );
    }

    return allowedFields;
  }

  if (isDeveloperSelf) {
    ["name", "photoUrl", "skills", "githubUrl", "linkedinUrl"].forEach((field) => allowedFields.add(field));
  }

  return allowedFields;
};

export const setupProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!isDeveloper(req.user.role)) {
      return res.status(403).json({ message: "Only developers can complete profile setup" });
    }

    const payload = req.body as Record<string, unknown>;
    const fieldValidation = validateRequestedFields(payload, setupFields);

    if (fieldValidation) {
      return res.status(fieldValidation.status).json({ message: fieldValidation.message });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: typeof payload.name === "string" ? payload.name.trim() : undefined,
        photoUrl: typeof payload.photoUrl === "string" ? payload.photoUrl.trim() : undefined,
        skills: parseSkills(payload.skills),
        githubUrl: typeof payload.githubUrl === "string" ? payload.githubUrl.trim() : undefined,
        linkedinUrl: typeof payload.linkedinUrl === "string" ? payload.linkedinUrl.trim() : undefined,
      },
      select: restrictedProfileSelect,
    });

    await createAuditLog(
      "PROFILE_SETUP_COMPLETED",
      req.user.id,
      req.user.id,
      {
        fields: Object.keys(payload),
      },
      "User"
    );

    return res.json({ message: "Profile setup completed", user: updatedUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error setting up profile";
    return res.status(message.includes("must be") ? 400 : 500).json({ message });
  }
};

export const listProfiles = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (req.user.role !== Role.HR && req.user.role !== Role.TEAM_LEAD) {
      return res.status(403).json({ message: "Access denied" });
    }

    const visibleRoles =
      req.user.role === Role.HR ? [...developerRoles, Role.TEAM_LEAD] : developerRoles;

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: visibleRoles },
      },
      select: getProfileSelect(req.user),
      orderBy: { name: "asc" },
    });

    const progressMap = await calculateProgress(users.map((profile) => profile.id));

    return res.json(
      users.map((profile) => ({
        ...profile,
        trainingProgress: profile.trainingProgress ?? progressMap.get(profile.id) ?? 0,
      }))
    );
  } catch {
    return res.status(500).json({ message: "Error fetching profiles" });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const profileId = req.params.id || req.user.id;

    if (!canViewProfile(req.user, profileId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const profile = await prisma.user.findUnique({
      where: { id: profileId },
      select: getProfileSelect(req.user),
    });

    if (!profile || !profile.isActive) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.json({
      ...profile,
      trainingProgress: profile.trainingProgress ?? 0,
    });
  } catch {
    return res.status(500).json({ message: "Error fetching profile" });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const payload = req.body as Record<string, unknown>;
    const id = req.params.id || (typeof payload.id === "string" ? payload.id : req.user.id);

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existingUser || !existingUser.isActive) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const allowedFields = buildAllowedFieldSet(req.user, id);
    const fieldValidation = validateRequestedFields(payload, allowedFields);

    if (fieldValidation) {
      return res.status(fieldValidation.status).json({ message: fieldValidation.message });
    }

    if (allowedFields.size === 0) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (payload.trainingStatus !== undefined && !trainingStatuses.includes(payload.trainingStatus as TrainingStatus)) {
      return res.status(400).json({ message: "Invalid training status" });
    }

    if (payload.role !== undefined && !Object.values(Role).includes(payload.role as Role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name: typeof payload.name === "string" ? payload.name.trim() : undefined,
        email: typeof payload.email === "string" ? payload.email.trim().toLowerCase() : undefined,
        role: payload.role as Role | undefined,
        department: typeof payload.department === "string" ? payload.department.trim() : undefined,
        photoUrl: typeof payload.photoUrl === "string" ? payload.photoUrl.trim() : undefined,
        joinDate: parseRequiredDateField(payload.joinDate, "Join date"),
        trainingStartDate: parseOptionalDate(payload.trainingStartDate, "Training start date"),
        trainingEndDate: parseOptionalDate(payload.trainingEndDate, "Training end date"),
        trainingStatus: payload.trainingStatus as TrainingStatus | undefined,
        trainingProgress: parseTrainingProgress(payload.trainingProgress),
        skills: parseSkills(payload.skills),
        githubUrl: typeof payload.githubUrl === "string" ? payload.githubUrl.trim() : undefined,
        linkedinUrl: typeof payload.linkedinUrl === "string" ? payload.linkedinUrl.trim() : undefined,
        internalNotes: typeof payload.internalNotes === "string" ? payload.internalNotes.trim() : undefined,
      },
      select: getProfileSelect(req.user),
    });

    if (
      payload.trainingStatus !== undefined ||
      payload.trainingStartDate !== undefined ||
      payload.trainingEndDate !== undefined
    ) {
      await createNotification(id, "Training status changed", NotificationType.TRAINING_STATUS_CHANGED);
    }

    await createAuditLog(
      "PROFILE_UPDATED",
      req.user.id,
      id,
      {
        fields: Object.keys(payload),
      },
      "User"
    );

    return res.json({
      message: "Profile updated",
      user: {
        ...updatedUser,
        trainingProgress: updatedUser.trainingProgress ?? 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error updating profile";
    return res.status(message.includes("must be") || message.includes("between 0 and 100") ? 400 : 500).json({ message });
  }
};
