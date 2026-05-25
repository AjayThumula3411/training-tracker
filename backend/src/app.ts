import path from "path";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

import authRoutes from "./routes/auth.routes";
import taskRoutes from "./routes/task.routes";
import profileRoutes from "./routes/profile.routes";
import feedbackRoutes from "./routes/feedback.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import userRoutes from "./routes/user.routes";
import notificationRoutes from "./routes/notification.routes";
import auditRoutes from "./routes/audit.routes";

import { authenticate, AuthRequest } from "./middleware/auth.middleware";
import { authorizeRoles } from "./middleware/rbac.middleware";

export const createBackendApp = () => {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "backend", "uploads")));

  app.use("/api/auth", authRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/profiles", profileRoutes);
  app.use("/api/feedback", feedbackRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/audit-log", auditRoutes);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/protected", authenticate, (req: AuthRequest, res) => {
    res.json({
      message: "You are authorized!",
      user: req.user,
    });
  });

  app.get("/api/hr", authenticate, authorizeRoles("HR"), (_req, res) => {
    res.json({ message: "Welcome HR" });
  });

  app.get("/api/tl", authenticate, authorizeRoles("TEAM_LEAD"), (_req, res) => {
    res.json({ message: "Welcome TL" });
  });

  app.get("/api/dev", authenticate, authorizeRoles("JUNIOR_DEV"), (_req, res) => {
    res.json({ message: "Welcome Developer" });
  });

  return app;
};
