import { Response } from "express";
import prisma from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";

// Get My Profile
export const getMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const profile = await prisma.user.findUnique({
      where: { id: user.id }
    });

    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: "Error fetching profile" });
  }
};

// Update Profile
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { department, skills, githubUrl, linkedinUrl } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        department,
        skills,
        githubUrl,
        linkedinUrl
      }
    });

    res.json({
      message: "Profile updated",
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating profile" });
  }
};
