import { Role } from "@prisma/client";
import { Response } from "express";
import prisma from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role !== Role.HR && req.user.role !== Role.TEAM_LEAD) {
      return res.status(403).json({ message: "Access denied" });
    }

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const performerIds = [...new Set(logs.map((log) => log.performedBy))];
    const users = performerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: performerIds } },
          select: { id: true, name: true, role: true },
        })
      : [];

    const userMap = new Map(users.map((user) => [user.id, user]));

    return res.json(
      logs.map((log) => ({
        ...log,
        performer: userMap.get(log.performedBy) ?? null,
      }))
    );
  } catch {
    return res.status(500).json({ message: "Error fetching audit logs" });
  }
};
