import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import prisma from "../prisma/client";

export type AuthUser = {
  id: string;
  role: Role;
};

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const run = async () => {
    const cookieToken = req.cookies?.token;
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : "";
    const token = cookieToken || bearerToken;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    const payload = decoded as AuthUser;

    const activeUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!activeUser || !activeUser.isActive) {
      res.clearCookie("token");
      return res.status(401).json({ message: "Account is inactive" });
    }

    req.user = {
      id: activeUser.id,
      role: activeUser.role,
    };

    next();
  };

  run().catch(() => {
    res.clearCookie("token");
    return res.status(401).json({ message: "Invalid token" });
  });
};
