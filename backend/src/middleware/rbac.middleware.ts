import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { AuthRequest } from "./auth.middleware";

export const authorizeRoles = (...roles: Array<Role | string>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const requiredRoles = roles.map((role) => `${role}`.trim().toUpperCase());
    const currentRole = `${user.role}`.trim().toUpperCase();

    if (!requiredRoles.includes(currentRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};

export const requireRole = authorizeRoles;
