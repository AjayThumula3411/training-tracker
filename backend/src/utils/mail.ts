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

type TaskSubmittedMailPayload = {
  recipients: string[];
  taskTitle: string;
  submittedBy: string;
  assignedBy?: string;
  taskStatus: string;
};

type TaskAssignedMailPayload = {
  recipient: string;
  taskTitle: string;
  description: string;
  priority: string;
  dueDate?: string | null;
  assignedBy?: string;
  attachments?: string[];
};

export const sendTaskSubmittedEmail = async ({
  recipients,
  taskTitle,
  submittedBy,
  assignedBy,
  taskStatus,
}: TaskSubmittedMailPayload) => {
  if (!mailConfigured()) {
    throw new Error("SMTP is not configured");
  }

  const uniqueRecipients = [...new Set(recipients.map((email) => email.trim().toLowerCase()).filter(Boolean))];

  if (uniqueRecipients.length === 0) {
    return { delivered: false };
  }

  const transporter = createTransport();

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: uniqueRecipients.join(", "),
    subject: `Task submitted for review: ${taskTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2>Task submitted for review</h2>
        <p><strong>${submittedBy}</strong> submitted <strong>${taskTitle}</strong>.</p>
        <p>Current status: <strong>${taskStatus}</strong></p>
        <p>Assigned by: <strong>${assignedBy || "Not available"}</strong></p>
        <p>Please review the submission in Training Tracker.</p>
      </div>
    `,
  });

  return { delivered: true };
};

export const sendTaskAssignedEmail = async ({
  recipient,
  taskTitle,
  description,
  priority,
  dueDate,
  assignedBy,
  attachments = [],
}: TaskAssignedMailPayload) => {
  if (!mailConfigured()) {
    throw new Error("SMTP is not configured");
  }

  const normalizedRecipient = recipient.trim().toLowerCase();

  if (!normalizedRecipient) {
    return { delivered: false };
  }

  const transporter = createTransport();
  const dueDateLabel = dueDate || "Not set";
  const attachmentMarkup =
    attachments.length > 0
      ? `<div>
          <p><strong>Attachments</strong></p>
          <ul>${attachments.map((attachment) => `<li><a href="${attachment}">${attachment}</a></li>`).join("")}</ul>
        </div>`
      : "<p><strong>Attachments:</strong> None</p>";

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: normalizedRecipient,
    subject: `New task assigned: ${taskTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2>A new task has been assigned to you</h2>
        <p><strong>Title:</strong> ${taskTitle}</p>
        <p><strong>Description:</strong> ${description}</p>
        <p><strong>Priority:</strong> ${priority}</p>
        <p><strong>Due date:</strong> ${dueDateLabel}</p>
        <p><strong>Assigned by:</strong> ${assignedBy || "Not available"}</p>
        ${attachmentMarkup}
        <p>Please sign in to Training Tracker to start working on it.</p>
      </div>
    `,
  });

  return { delivered: true };
};
