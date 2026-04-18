import { Response } from "express";
import { FeedbackType, Role } from "@prisma/client";
import prisma from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";
import { createAuditLog, createNotification } from "../utils/activity";

const normalizeFeedbackType = (type?: string) => {
  const normalizedType = type?.trim().toUpperCase();

  if (normalizedType === FeedbackType.EXTERNAL) return FeedbackType.EXTERNAL;
  if (normalizedType === FeedbackType.INTERNAL) return FeedbackType.INTERNAL;

  return undefined;
};

const canCreateFeedback = (role: Role, type: FeedbackType) => {
  const normalizedRole = `${role}`.trim().toUpperCase() as Role;

  if (type === FeedbackType.INTERNAL) {
    return normalizedRole === Role.TEAM_LEAD || normalizedRole === Role.HR;
  }

  return normalizedRole !== Role.JUNIOR_DEV;
};

const getCreateFeedbackError = (role: Role, type: FeedbackType) => {
  if (type === FeedbackType.INTERNAL) {
    return "Only HR and Team Lead can add internal feedback";
  }

  return "Only Senior Dev, Team Lead, and HR can add external feedback";
};

export const giveFeedback = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { developerId, content, type } = req.body as {
      developerId?: string;
      content?: string;
      type?: string;
    };
    const user = req.user;
    const normalizedType = normalizeFeedbackType(type);

    if (!developerId || !content?.trim() || !normalizedType) {
      return res.status(400).json({ message: "Developer, content, and valid feedback type are required" });
    }

    if (!canCreateFeedback(user.role, normalizedType)) {
      return res.status(403).json({ message: getCreateFeedbackError(user.role, normalizedType) });
    }

    if (developerId === user.id) {
      return res.status(400).json({ message: "Cannot give feedback to yourself" });
    }

    const developer = await prisma.user.findUnique({
      where: { id: developerId },
    });

    if (!developer || !developer.isActive) {
      return res.status(404).json({ message: "Developer not found" });
    }

    if (developer.role !== Role.JUNIOR_DEV && developer.role !== Role.SENIOR_DEV) {
      return res.status(400).json({ message: "Feedback can only be given to developers" });
    }

    const feedback = await prisma.feedback.create({
      data: {
        developerId,
        content: content.trim(),
        type: normalizedType,
        authorId: user.id,
      },
    });

    await createNotification(developerId, `New ${normalizedType.toLowerCase()} feedback added`);

    await createAuditLog("FEEDBACK_ADDED", "Feedback", user.id, feedback.id, {
      developerId,
      type: normalizedType,
    });

    res.status(201).json(feedback);
  } catch {
    res.status(500).json({ message: "Error creating feedback" });
  }
};

export const getMyFeedback = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const user = req.user;
    const canViewInternal = user.role === Role.HR || user.role === Role.TEAM_LEAD;

    const feedback = await prisma.feedback.findMany({
      where: {
        developerId: user.id,
        ...(canViewInternal ? {} : { type: FeedbackType.EXTERNAL }),
      },
      include: {
        author: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(feedback);
  } catch {
    res.status(500).json({ message: "Error fetching feedback" });
  }
};

export const getFeedbackByDeveloper = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { developerId } = req.params;
    const canViewInternal = req.user.role === Role.HR || req.user.role === Role.TEAM_LEAD;

    const feedbacks = await prisma.feedback.findMany({
      where: {
        developerId,
        ...(canViewInternal ? {} : { type: FeedbackType.EXTERNAL }),
      },
      include: {
        author: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(feedbacks);
  } catch {
    res.status(500).json({ message: "Error fetching feedback" });
  }
};

export const updateFeedback = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { content, type } = req.body as {
      content?: string;
      type?: string;
    };
    const normalizedType = normalizeFeedbackType(type);

    if (!content?.trim()) {
      return res.status(400).json({ message: "Feedback content is required" });
    }

    if (!normalizedType) {
      return res.status(400).json({ message: "Valid feedback type is required" });
    }

    const existingFeedback = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!existingFeedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    if (existingFeedback.authorId !== req.user.id) {
      return res.status(403).json({ message: "Only the author can edit feedback" });
    }

    if (!canCreateFeedback(req.user.role, normalizedType)) {
      return res.status(403).json({ message: getCreateFeedbackError(req.user.role, normalizedType) });
    }

    const updatedFeedback = await prisma.feedback.update({
        where: { id },
        data: {
          content: content.trim(),
          type: normalizedType,
        },
      });

    await createAuditLog("FEEDBACK_UPDATED", "Feedback", req.user.id, id, {
      fromType: existingFeedback.type,
      toType: normalizedType,
    });

    res.json(updatedFeedback);
  } catch {
    res.status(500).json({ message: "Error updating feedback" });
  }
};

export const deleteFeedback = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    const existingFeedback = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!existingFeedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    const canDelete =
      existingFeedback.type === FeedbackType.INTERNAL
        ? req.user.role === Role.HR
        : existingFeedback.authorId === req.user.id || req.user.role === Role.HR;

    if (!canDelete) {
      return res.status(403).json({
        message:
          existingFeedback.type === FeedbackType.INTERNAL
            ? "Only HR can delete internal feedback"
            : "Only the author or HR can delete feedback",
      });
    }

    await prisma.feedback.delete({
      where: { id },
    });

    await createAuditLog("FEEDBACK_DELETED", "Feedback", req.user.id, id, {
      developerId: existingFeedback.developerId,
      type: existingFeedback.type,
    });

    res.json({ message: "Feedback deleted successfully" });
  } catch {
    res.status(500).json({ message: "Error deleting feedback" });
  }
};
