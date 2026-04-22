import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MfaMethod, Role } from "@prisma/client";
import prisma from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";
import { createAuditLog } from "../utils/activity";
import { sendLoginOtpEmail } from "../utils/mail";
import { buildOtpAuthUri, generateTotpSecret, verifyTotpCode } from "../utils/totp";

const OTP_EXPIRY_MINUTES = 10;
const OTP_GRACE_PERIOD_MS = 2 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MFA_CHALLENGE_EXPIRY = "10m";
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 1000 * 60 * 60 * 24,
};

type LoginChallengePayload = {
  stage: "email_otp" | "google_authenticator";
  id: string;
  email: string;
};

const signAuthToken = (userId: string, role: Role) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET as string, {
    expiresIn: "1d",
  });

const signLoginChallenge = (payload: LoginChallengePayload) =>
  jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: MFA_CHALLENGE_EXPIRY,
  });

const verifyLoginChallenge = (token: string) =>
  jwt.verify(token, process.env.JWT_SECRET as string) as LoginChallengePayload;

const generateOtpCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;

const issueSession = async (
  res: Response,
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  },
  metadata?: Record<string, unknown>
) => {
  const token = signAuthToken(user.id, user.role);

  res.cookie("token", token, AUTH_COOKIE_OPTIONS);

  await createAuditLog(
    "LOGIN_MFA_VERIFIED",
    user.id,
    undefined,
    {
      email: user.email,
      ...metadata,
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
};

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

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
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

      if (invitation.email.toLowerCase() !== normalizedEmail) {
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
        name: name.trim(),
        email: normalizedEmail,
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

    const challengeToken = signLoginChallenge({
      stage: "email_otp",
      id: user.id,
      email: normalizedEmail,
    });

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
        method: MfaMethod.EMAIL_OTP,
      },
      "LoginOtp"
    );

    res.json({
      message: "OTP sent to your email",
      email: normalizedEmail,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
      challengeToken,
      mfaMethod: MfaMethod.EMAIL_OTP,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to send OTP" });
  }
};

export const verifyLoginOtp = async (req: Request, res: Response) => {
  try {
    const { challengeToken, otp, email } = req.body as {
      challengeToken?: string;
      otp?: string;
      email?: string;
    };

    if (!otp || (!challengeToken && !email)) {
      return res.status(400).json({ message: "Email or challenge token and OTP are required" });
    }

    let challenge: LoginChallengePayload | null = null;
    let user:
      | {
          id: string;
          name: string;
          email: string;
          role: Role;
          isActive: boolean;
          passwordHash: string;
          mfaEnabled: boolean;
          mfaMethod: MfaMethod;
          mfaSecret: string | null;
          mfaTempSecret: string | null;
        }
      | null = null;

    if (challengeToken) {
      try {
        challenge = verifyLoginChallenge(challengeToken);
      } catch {
        return res.status(400).json({ message: "Login session expired. Please sign in again." });
      }

      user = await prisma.user.findUnique({
        where: { id: challenge.id },
      });
    } else if (email) {
      const normalizedEmail = email.toLowerCase().trim();

      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (user) {
        challenge = {
          stage: "email_otp",
          id: user.id,
          email: normalizedEmail,
        };
      }
    }

    if (!challenge || !user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isActive) {
      await prisma.loginOtp.deleteMany({ where: { email: challenge.email } });
      return res.status(403).json({ message: "Account is inactive" });
    }

    if (challenge.stage !== "email_otp") {
      return res.status(400).json({ message: "Invalid login step. Please sign in again." });
    }

    const normalizedEmail = challenge.email.toLowerCase().trim();
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

    await prisma.loginOtp.deleteMany({
      where: {
        email: normalizedEmail,
        OR: [{ expiresAt: { lte: new Date(now - OTP_GRACE_PERIOD_MS) } }, { id: matchedOtpRecord.id }],
      },
    });

    if (!user.mfaEnabled) {
      return issueSession(res, user, { mfaMethod: "DISABLED" });
    }

    let totpSecret = user.mfaSecret || user.mfaTempSecret;
    const setupRequired = !user.mfaSecret;

    if (!totpSecret) {
      totpSecret = generateTotpSecret();

      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaTempSecret: totpSecret,
        },
      });

      await createAuditLog(
        "MFA_GOOGLE_AUTHENTICATOR_SETUP_STARTED",
        user.id,
        user.id,
        {
          method: MfaMethod.GOOGLE_AUTHENTICATOR,
          source: "login",
        },
        "User"
      );
    }

    const googleAuthenticatorChallengeToken = signLoginChallenge({
      stage: "google_authenticator",
      id: user.id,
      email: normalizedEmail,
    });

    return res.json({
      message: setupRequired
        ? "Set up Google Authenticator to finish signing in"
        : "Enter the 6-digit code from Google Authenticator",
      email: normalizedEmail,
      challengeToken: googleAuthenticatorChallengeToken,
      mfaMethod: MfaMethod.GOOGLE_AUTHENTICATOR,
      setupRequired,
      secret: totpSecret,
      otpAuthUri: buildOtpAuthUri(normalizedEmail, totpSecret),
      issuer: "Training Tracker",
      accountName: normalizedEmail,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to verify OTP" });
  }
};

export const verifyLoginGoogleAuthenticator = async (req: Request, res: Response) => {
  try {
    const { challengeToken, otp } = req.body as { challengeToken?: string; otp?: string };

    if (!challengeToken || !otp) {
      return res.status(400).json({ message: "Challenge token and authenticator code are required" });
    }

    let challenge: LoginChallengePayload;

    try {
      challenge = verifyLoginChallenge(challengeToken);
    } catch {
      return res.status(400).json({ message: "Login session expired. Please sign in again." });
    }

    if (challenge.stage !== "google_authenticator") {
      return res.status(400).json({ message: "Invalid login step. Please sign in again." });
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is inactive" });
    }

    const activeSecret = user.mfaSecret || user.mfaTempSecret;

    if (!activeSecret || !verifyTotpCode(activeSecret, otp)) {
      return res.status(400).json({ message: "Invalid authenticator code" });
    }

    if (!user.mfaSecret || user.mfaMethod !== MfaMethod.GOOGLE_AUTHENTICATOR) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaMethod: MfaMethod.GOOGLE_AUTHENTICATOR,
          mfaSecret: activeSecret,
          mfaTempSecret: null,
        },
      });

      await createAuditLog(
        "MFA_GOOGLE_AUTHENTICATOR_ENABLED",
        user.id,
        user.id,
        {
          email: user.email,
          method: MfaMethod.GOOGLE_AUTHENTICATOR,
          source: "login",
        },
        "User"
      );
    }

    return issueSession(
      res,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      { mfaMethod: MfaMethod.GOOGLE_AUTHENTICATOR }
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to verify Google Authenticator" });
  }
};

export const setupGoogleAuthenticator = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ message: "User not found" });
    }

    const secret = generateTotpSecret();
    const otpAuthUri = buildOtpAuthUri(user.email, secret);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaTempSecret: secret,
      },
    });

    await createAuditLog(
      "MFA_GOOGLE_AUTHENTICATOR_SETUP_STARTED",
      user.id,
      user.id,
      {
        method: MfaMethod.GOOGLE_AUTHENTICATOR,
      },
      "User"
    );

    return res.json({
      message: "Google Authenticator setup started",
      secret,
      otpAuthUri,
      issuer: "Training Tracker",
      accountName: user.email,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to start Google Authenticator setup" });
  }
};

export const verifyGoogleAuthenticator = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { otp } = req.body as { otp?: string };

    if (!otp) {
      return res.status(400).json({ message: "Authenticator code is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        isActive: true,
        mfaTempSecret: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.mfaTempSecret) {
      return res.status(400).json({ message: "Start Google Authenticator setup first" });
    }

    if (!verifyTotpCode(user.mfaTempSecret, otp)) {
      return res.status(400).json({ message: "Invalid authenticator code" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaMethod: MfaMethod.GOOGLE_AUTHENTICATOR,
        mfaSecret: user.mfaTempSecret,
        mfaTempSecret: null,
      },
    });

    await createAuditLog(
      "MFA_GOOGLE_AUTHENTICATOR_ENABLED",
      user.id,
      user.id,
      {
        email: user.email,
        method: MfaMethod.GOOGLE_AUTHENTICATOR,
      },
      "User"
    );

    return res.json({
      message: "Google Authenticator enabled",
      mfaMethod: MfaMethod.GOOGLE_AUTHENTICATOR,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to verify Google Authenticator" });
  }
};

export const disableGoogleAuthenticator = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaMethod: MfaMethod.EMAIL_OTP,
        mfaSecret: null,
        mfaTempSecret: null,
      },
    });

    await createAuditLog(
      "MFA_GOOGLE_AUTHENTICATOR_DISABLED",
      user.id,
      user.id,
      {
        email: user.email,
        fallbackMethod: MfaMethod.EMAIL_OTP,
      },
      "User"
    );

    return res.json({
      message: "Google Authenticator disabled. Email OTP is active.",
      mfaMethod: MfaMethod.EMAIL_OTP,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to disable Google Authenticator" });
  }
};
