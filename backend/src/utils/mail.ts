import nodemailer from "nodemailer";

const mailConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.MAIL_FROM
  );

const createTransport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

export const sendLoginOtpEmail = async (email: string, otp: string) => {
  if (!mailConfigured()) {
    throw new Error("SMTP is not configured");
  }

  const transporter = createTransport();

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Your Training Tracker login code",
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2>Your login verification code</h2>
        <p>Use the code below to finish signing in to Training Tracker.</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">${otp}</div>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `,
  });

  return { delivered: true };
};

export const sendInvitationEmail = async (email: string, setupLink: string, role: string) => {
  if (!mailConfigured()) {
    throw new Error("SMTP is not configured");
  }

  const transporter = createTransport();
  const roleLabel = role.replace(/_/g, " ");

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Your Training Tracker invitation",
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2>You have been invited to Training Tracker</h2>
        <p>Your role has been set to <strong>${roleLabel}</strong>.</p>
        <p>Use the button below to complete your registration.</p>
        <p style="margin: 24px 0;">
          <a
            href="${setupLink}"
            style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 700;"
          >
            Complete Registration
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p>${setupLink}</p>
        <p>This invitation link will expire in 7 days.</p>
      </div>
    `,
  });

  return { delivered: true };
};
