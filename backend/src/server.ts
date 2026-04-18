import express from "express";           // create server
import dotenv from "dotenv";             // load .env variables
import cors from "cors";                 // allow frontend to connect
import cookieParser from "cookie-parser"; // read cookies from browser

// 🔹 ROUTES
import authRoutes from "./routes/auth.routes";
import taskRoutes from "./routes/task.routes";
import profileRoutes from "./routes/profile.routes";
import feedbackRoutes from "./routes/feedback.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import userRoutes from "./routes/user.routes";
import notificationRoutes from "./routes/notification.routes";
import auditRoutes from "./routes/audit.routes";

// 🔹 MIDDLEWARE
import { authenticate, AuthRequest } from "./middleware/auth.middleware";
import { authorizeRoles } from "./middleware/rbac.middleware";

dotenv.config(); // load environment variables

const app = express(); // create express app

// ================= MIDDLEWARES =================

// ✅ Enable CORS (VERY IMPORTANT for frontend)
app.use(cors({
  origin: "http://localhost:3000", // frontend URL
  credentials: true,               // allow cookies
}));

// ✅ Parse JSON request body
app.use(express.json());

// ✅ Parse cookies (REQUIRED for auth)
app.use(cookieParser());

// ================= ROUTES =================

// 🔐 Auth routes (login, register, me)
app.use("/api/auth", authRoutes);

// 📋 Task routes
app.use("/api/tasks", taskRoutes);

// 👤 Profile routes
app.use("/api/profile", profileRoutes);
app.use("/api/profiles", profileRoutes);

// 💬 Feedback routes
app.use("/api/feedback", feedbackRoutes);

// 📊 Dashboard routes
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-log", auditRoutes);

// ================= TEST / ROLE ROUTES =================

// ✅ Protected route (any logged-in user)
app.get("/api/protected", authenticate, (req: AuthRequest, res) => {
  res.json({
    message: "You are authorized!",
    user: req.user,
  });
});

// ✅ HR only route
app.get("/api/hr", authenticate, authorizeRoles("HR"), (req, res) => {
  res.json({ message: "Welcome HR" });
});

// ✅ Team Lead only route
app.get("/api/tl", authenticate, authorizeRoles("TEAM_LEAD"), (req, res) => {
  res.json({ message: "Welcome TL" });
});

// ✅ Developer only route
app.get("/api/dev", authenticate, authorizeRoles("JUNIOR_DEV"), (req, res) => {
  res.json({ message: "Welcome Developer" });
});

// ================= START SERVER =================

// 🚀 Start backend server
app.listen(Number(process.env.PORT), () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
