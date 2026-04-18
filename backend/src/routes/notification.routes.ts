import express from "express";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import prisma from "../prisma/client";

const router = express.Router();

router.get("/", authenticate, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json(notifications);
});

router.patch("/:id/read", authenticate, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.params;

  try {
    const notification = await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { read: true },
    });

    if (notification.count === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification marked as read" });
  } catch {
    res.status(500).json({ message: "Error updating notification" });
  }
});

export default router;
