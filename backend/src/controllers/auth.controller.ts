import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import prisma from "../prisma/client";
import { createAuditLog } from "../utils/activity";
import { sendLoginOtpEmail } from "../utils/mail";

const OTP_EXPIRY_MINUTES = 10;
const OTP_GRACE_PERIOD_MS = 2 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 1000 * 60 * 60 * 24,
};

const signAuthToken = (userId: string, role: Role) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET as string, {
    expiresIn: "1d",
  });

const generateOtpCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, inviteToken } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: Role;
      inviteToken?: string;
    };

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    let finalRole: Role = Role.JUNIOR_DEV;
    let invitationId: string | undefined;

    if (inviteToken) {
      const invitation = await prisma.invitation.findUnique({
        where: { token: inviteToken },
      });

      if (!invitation || invitation.used || invitation.expiresAt < new Date()) {
        return res.status(400).json({ message: "Invalid or expired invite token" });
      }

      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ message: "Invite token does not match this email" });
      }

      finalRole = invitation.role;
      invitationId = invitation.id;
    } else if (role && Object.values(Role).includes(role)) {
      finalRole = role;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role: finalRole,
      },
    });

    if (invitationId) {
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { used: true },
      });
    }

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Registration failed" });
  }
};

export const requestLoginOtp = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const otp = generateOtpCode();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.loginOtp.deleteMany({
      where: { email: normalizedEmail },
    });

    await prisma.loginOtp.create({
      data: {
        email: normalizedEmail,
        codeHash,
        expiresAt,
      },
    });

    const mailResult = await sendLoginOtpEmail(normalizedEmail, otp);

    await createAuditLog(
      "LOGIN_OTP_REQUESTED",
      user.id,
      undefined,
      {
        email: normalizedEmail,
        delivered: mailResult.delivered,
      },
      "LoginOtp"
    );

    res.json({
      message: "OTP sent to your email",
      email: normalizedEmail,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to send OTP" });
  }
};

export const verifyLoginOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body as { email?: string; otp?: string };

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOtp = otp.trim();
    const now = Date.now();
    const activeOtpRecords = await prisma.loginOtp.findMany({
      where: {
        email: normalizedEmail,
        expiresAt: {
          gt: new Date(now - OTP_GRACE_PERIOD_MS),
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeOtpRecords.length === 0) {
      const latestOtpRecord = await prisma.loginOtp.findFirst({
        where: {
          email: normalizedEmail,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!latestOtpRecord) {
        return res.status(400).json({ message: "OTP not requested. Please request a new OTP." });
      }

      await prisma.loginOtp.deleteMany({ where: { email: normalizedEmail } });
      return res.status(400).json({ message: "OTP expired. Please request a new OTP." });
    }

    let matchedOtpRecord = activeOtpRecords[0];
    let matches = false;

    for (const otpRecord of activeOtpRecords) {
      const isMatch = await bcrypt.compare(normalizedOtp, otpRecord.codeHash);

      if (isMatch) {
        matchedOtpRecord = otpRecord;
        matches = true;
        break;
      }
    }

    if (!matches) {
      const attempts = activeOtpRecords[0].attempts + 1;

      if (attempts >= MAX_OTP_ATTEMPTS) {
        await prisma.loginOtp.deleteMany({ where: { email: normalizedEmail } });
        return res.status(400).json({ message: "Too many incorrect attempts. Request a new OTP." });
      }

      await prisma.loginOtp.update({
        where: { id: activeOtpRecords[0].id },
        data: { attempts },
      });

      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isActive) {
      await prisma.loginOtp.deleteMany({ where: { email: normalizedEmail } });
      return res.status(403).json({ message: "Account is inactive" });
    }

    await prisma.loginOtp.deleteMany({
      where: {
        email: normalizedEmail,
        OR: [
          { expiresAt: { lte: new Date(now - OTP_GRACE_PERIOD_MS) } },
          { id: matchedOtpRecord.id },
        ],
      },
    });

    const token = signAuthToken(user.id, user.role);

    res.cookie("token", token, AUTH_COOKIE_OPTIONS);

    await createAuditLog(
      "LOGIN_OTP_VERIFIED",
      user.id,
      undefined,
      {
        email: normalizedEmail,
      },
      "LoginOtp"
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to verify OTP" });
  }
};
