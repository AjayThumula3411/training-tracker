import { Response } from "express";
import prisma from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return res.json(notifications);
  } catch {
    return res.status(500).json({ message: "Error fetching notifications" });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const notification = await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { isRead: true },
    });

    if (notification.count === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json({ message: "Notification marked as read" });
  } catch {
    return res.status(500).json({ message: "Error updating notification" });
  }
};
