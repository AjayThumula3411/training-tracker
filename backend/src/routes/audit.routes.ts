import express from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/rbac.middleware";
import prisma from "../prisma/client";

const router = express.Router();

router.get("/", authenticate, authorizeRoles(Role.HR, Role.TEAM_LEAD), async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json(logs);
});

export default router;
