import { NotificationType, Prisma } from "@prisma/client";
import prisma from "../prisma/client";

type AuditDetails = Prisma.InputJsonValue;

export const createNotification = async (userId: string, message: string, type: NotificationType) => {
  await prisma.notification.create({
    data: {
      userId,
      message,
      type,
    },
  });
};

export const createAuditLog = async (
  action: string,
  performedBy: string,
  targetId?: string,
  metadata?: AuditDetails,
  entity = "System"
) => {
  await prisma.auditLog.create({
    data: {
      action,
      entity,
      targetId,
      performedBy,
      metadata,
    },
  });
};
