import { Prisma } from "@prisma/client";
import prisma from "../prisma/client";

type AuditDetails = Prisma.InputJsonValue;

export const createNotification = async (userId: string, message: string) => {
  await prisma.notification.create({
    data: {
      userId,
      message,
    },
  });
};

export const createAuditLog = async (
  action: string,
  entity: string,
  actorId: string,
  entityId?: string,
  details?: AuditDetails
) => {
  await prisma.auditLog.create({
    data: {
      action,
      entity,
      entityId,
      actorId,
      details,
    },
  });
};
