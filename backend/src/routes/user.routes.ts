import crypto from "crypto";
import express from "express";
import { Role } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/rbac.middleware";
import prisma from "../prisma/client";
import { createAuditLog } from "../utils/activity";
import { sendInvitationEmail } from "../utils/mail";

const router = express.Router();

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  department: true,
  trainingStatus: true,
  createdAt: true,
};

const deleteUserHandler = async (req: AuthRequest, res: express.Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.params;

  if (req.user.id === id) {
    return res.status(400).json({ message: "You cannot permanently delete your own account" });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({
        where: {
          OR: [{ assignedToId: id }, { assignedById: id }],
        },
      });

      await tx.feedback.deleteMany({
        where: {
          OR: [{ developerId: id }, { authorId: id }],
        },
      });

      await tx.notification.deleteMany({
        where: { userId: id },
      });

      await tx.loginOtp.deleteMany({
        where: { email: existingUser.email.toLowerCase() },
      });

      await tx.invitation.deleteMany({
        where: { email: existingUser.email.toLowerCase() },
      });

      await tx.user.delete({
        where: { id },
      });
    });

    await createAuditLog(
      "USER_DELETED",
      req.user.id,
      id,
      {
        email: existingUser.email,
        role: existingUser.role,
        permanent: true,
      },
      "User"
    );

    return res.json({ message: "User deleted permanently" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ message: "Error deleting user" });
  }
};

router.get("/", authenticate, authorizeRoles(Role.HR), async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error loading users" });
  }
});

router.post("/invite", authenticate, authorizeRoles(Role.HR), async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { email, role } = req.body as { email?: string; role?: Role };

  if (!email || !role || !Object.values(Role).includes(role)) {
    return res.status(400).json({ message: "Email and valid role are required" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const setupLink = `http://localhost:3000/register?token=${token}`;

  try {
    const invitation = await prisma.invitation.upsert({
      where: { email: normalizedEmail },
      update: {
        role,
        token,
        used: false,
        expiresAt,
        createdBy: req.user.id,
      },
      create: {
        email: normalizedEmail,
        role,
        token,
        expiresAt,
        createdBy: req.user.id,
      },
    });

    await sendInvitationEmail(normalizedEmail, setupLink, role);

    await createAuditLog(
      "INVITE_CREATED",
      req.user.id,
      invitation.id,
      {
        email: normalizedEmail,
        role,
      },
      "Invitation"
    );

    res.status(201).json({
      message: "Invitation email sent successfully",
    });
  } catch (error) {
    console.error("Error creating invite:", error);
    res.status(500).json({ message: "Error sending invitation email" });
  }
});

router.patch("/:id/role", authenticate, authorizeRoles(Role.HR), async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.params;
  const { role } = req.body as { role?: Role };

  if (!role || !Object.values(Role).includes(role)) {
    return res.status(400).json({ message: "Valid role is required" });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser || !existingUser.isActive) return res.status(404).json({ message: "User not found" });
    if (req.user.id === id) {
      return res.status(400).json({ message: "You cannot change your own role" });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: userSelect,
    });

    await createAuditLog(
      "ROLE_CHANGED",
      req.user.id,
      id,
      {
        from: existingUser.role,
        to: role,
      },
      "User"
    );

    res.json(updatedUser);
  } catch {
    res.status(500).json({ message: "Error updating role" });
  }
});

router.delete("/:id", authenticate, authorizeRoles(Role.HR), deleteUserHandler);

export default router;
