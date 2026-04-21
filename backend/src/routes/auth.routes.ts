import express from "express";
import { register, requestLoginOtp, verifyLoginOtp } from "../controllers/auth.controller";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import prisma from "../prisma/client";

const router = express.Router();
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false,
  sameSite: "lax" as const,
  path: "/",
};

router.post("/register", register);
router.post("/login", requestLoginOtp);
router.post("/verify-otp", verifyLoginOtp);

router.post("/logout", (req, res) => {
  res.clearCookie("token", AUTH_COOKIE_OPTIONS);
  res.json({ message: "Logged out" });
});

// ✅ ONLY ONE /me route (KEEP THIS)
router.get("/me", authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const user = (await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        mfaMethod: true,
        department: true,
        photoUrl: true,
        githubUrl: true,
        linkedinUrl: true,
        skills: true,
        trainingStatus: true,
        trainingProgress: true,
        trainingStartDate: true,
        trainingEndDate: true,
        joinDate: true,
      } as never,
    })) as {
      id: string;
      name: string;
      email: string;
      role: string;
      isActive: boolean;
      mfaEnabled?: boolean;
      mfaMethod?: string;
      department?: string | null;
      photoUrl?: string | null;
      githubUrl?: string | null;
      linkedinUrl?: string | null;
      skills?: string[];
      trainingStatus?: string;
      trainingProgress?: number;
      trainingStartDate?: Date | null;
      trainingEndDate?: Date | null;
      joinDate?: Date;
    } | null;

    if (!user || !user.isActive) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user" });
  }
});

export default router;
