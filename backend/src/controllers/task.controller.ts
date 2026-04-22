import { Response } from "express";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NotificationType, Priority, Role, TaskStatus } from "@prisma/client";
import prisma from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";
import { createAuditLog, createNotification } from "../utils/activity";
import { sendTaskAssignedEmail, sendTaskSubmittedEmail } from "../utils/mail";

const developerRoles: Role[] = [Role.JUNIOR_DEV, Role.SENIOR_DEV];

const isDeveloper = (role: Role) => developerRoles.includes(role);
const isHr = (role: Role) => role === Role.HR;
const isTeamLead = (role: Role) => role === Role.TEAM_LEAD;
const isManager = (role: Role) => isHr(role) || isTeamLead(role);

const validPriorities = Object.values(Priority);
const validTaskStatuses = Object.values(TaskStatus);
const supportedAttachmentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const supportedAttachmentExtensions = new Set([".pdf", ".doc", ".docx"]);

const parseOptionalDate = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Due date must be a valid date");
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Due date must be a valid date");
  }

  return parsed;
};

const parseAttachments = (value: unknown) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("Attachments must be an array of strings");
  }

  return value.map((entry) => entry.trim()).filter(Boolean);
};

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getTaskWithRelations = (id: string) =>
  prisma.task.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
      assignedBy: { select: { id: true, name: true, role: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      updatedBy: { select: { id: true, name: true, role: true } },
    },
  });

const runSideEffect = async (label: string, effect: () => Promise<void>) => {
  try {
    await effect();
  } catch (error) {
    console.error(`${label} failed`, error);
  }
};

const getBaseUrl = (req: AuthRequest) => `${req.protocol}://${req.get("host")}`;

const isAttachmentAllowed = (fileName: string, mimeType: string) => {
  const extension = path.extname(fileName).toLowerCase();
  return supportedAttachmentTypes.has(mimeType) || supportedAttachmentExtensions.has(extension);
};

const getTaskAttachmentsDirectory = (taskId: string) =>
  path.resolve(process.cwd(), "uploads", "task-attachments", taskId);

const getTaskAttachmentRelativePrefix = (taskId: string) => `/uploads/task-attachments/${taskId}/`;

const getTaskAttachmentUrls = async (taskId: string, req: AuthRequest) => {
  try {
    const files = await fs.readdir(getTaskAttachmentsDirectory(taskId), { withFileTypes: true });

    return files
      .filter((entry) => entry.isFile())
      .map((entry) => `${getBaseUrl(req)}/uploads/task-attachments/${taskId}/${encodeURIComponent(entry.name)}`)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
};

const withTaskAttachments = async <T extends { id: string }>(task: T, req: AuthRequest) => {
  const storedAttachments = Array.isArray((task as { attachments?: string[] }).attachments)
    ? (task as { attachments?: string[] }).attachments ?? []
    : [];
  const uploadedAttachments = await getTaskAttachmentUrls(task.id, req);

  return {
    ...task,
    attachments: [...new Set([...storedAttachments, ...uploadedAttachments])],
  };
};

const withTasksAttachments = async <T extends { id: string }>(tasks: T[], req: AuthRequest) =>
  Promise.all(tasks.map((task) => withTaskAttachments(task, req)));

const canManageTaskAttachments = (user: AuthRequest["user"], task: { assignedToId: string; status: TaskStatus }) => {
  if (!user) return false;

  if (isManager(user.role)) {
    return true;
  }

  const developerUploadableStatuses: TaskStatus[] = [TaskStatus.IN_PROGRESS, TaskStatus.NEEDS_REVISION];

  return (
    isDeveloper(user.role) &&
    task.assignedToId === user.id &&
    developerUploadableStatuses.includes(task.status)
  );
};

const getAttachmentFileNameFromUrl = (attachmentUrl: string, taskId: string) => {
  const relativePrefix = getTaskAttachmentRelativePrefix(taskId);

  try {
    const parsedUrl = new URL(attachmentUrl);
    if (!parsedUrl.pathname.startsWith(relativePrefix)) {
      return null;
    }

    return decodeURIComponent(parsedUrl.pathname.slice(relativePrefix.length));
  } catch {
    if (!attachmentUrl.startsWith(relativePrefix)) {
      return null;
    }

    return decodeURIComponent(attachmentUrl.slice(relativePrefix.length));
  }
};

const notifyManagersAboutTaskSubmission = async (
  task: NonNullable<Awaited<ReturnType<typeof getTaskWithRelations>>>
) => {
  const managers = await prisma.user.findMany({
    where: {
      isActive: true,
      role: {
        in: [Role.HR, Role.TEAM_LEAD],
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  const message = `Task submitted for review: ${task.title}`;

  await Promise.all(
    managers.map((manager) =>
      runSideEffect(`TASK_SUBMITTED notification for ${manager.id}`, () =>
        createNotification(manager.id, message, NotificationType.TASK_SUBMITTED)
      )
    )
  );

  await runSideEffect("TASK_SUBMITTED email", async () => {
    await sendTaskSubmittedEmail({
      recipients: managers.map((manager) => manager.email),
      taskTitle: task.title,
      submittedBy: task.assignedTo?.name || "Developer",
      assignedBy: task.assignedBy?.name,
      taskStatus: formatLabel(TaskStatus.SUBMITTED),
    });
  });
};

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { title, description, priority, dueDate, assignedToId, attachments } = req.body;
    const user = req.user;

    if (!isManager(user.role)) {
      return res.status(403).json({ message: "Only HR and Team Lead can create and assign tasks" });
    }

    if (!title?.trim() || !description?.trim() || !assignedToId) {
      return res.status(400).json({ message: "Title, description, and assigned developer are required" });
    }

    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ message: "Invalid priority" });
    }

    const parsedAttachments = parseAttachments(attachments) ?? [];
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });

    if (!assignee || !assignee.isActive || !isDeveloper(assignee.role)) {
      return res.status(400).json({ message: "Tasks can only be assigned to developers" });
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        attachments: parsedAttachments,
        priority,
        dueDate: parseOptionalDate(dueDate),
        assignedToId,
        assignedById: user.id,
        createdById: user.id,
        updatedById: user.id,
      },
    });

    await runSideEffect("TASK_ASSIGNED notification", () =>
      createNotification(assignedToId, `New task assigned: ${task.title}`, NotificationType.TASK_ASSIGNED)
    );
    await runSideEffect("TASK_ASSIGNED audit log", () =>
      createAuditLog(
        "TASK_ASSIGNED",
        user.id,
        task.id,
        {
          assignedToId,
          title: task.title,
          priority: task.priority,
        },
        "Task"
      )
    );

    const createdTask = await getTaskWithRelations(task.id);
    await runSideEffect("TASK_ASSIGNED email", async () => {
      await sendTaskAssignedEmail({
        recipient: assignee.email,
        taskTitle: task.title,
        description: task.description,
        priority: formatLabel(task.priority),
        dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
        assignedBy: createdTask?.assignedBy?.name,
        attachments: parsedAttachments,
      });
    });
    res.status(201).json(createdTask ? await withTaskAttachments(createdTask, req) : createdTask);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Error creating task";
    res.status(message.includes("Due date") || message.includes("Attachments") ? 400 : 500).json({ message });
  }
};

export const assignTask = createTask;

export const getAssignableDevelopers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!isManager(req.user.role)) {
      return res.status(403).json({ message: "Only HR and Team Lead can assign tasks" });
    }

    const developers = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: developerRoles },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
      orderBy: { name: "asc" },
    });

    res.json(developers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error loading assignable developers" });
  }
};

export const getAllTasks = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const user = req.user;
    const whereClause = isDeveloper(user.role) ? { assignedToId: user.id } : {};

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        updatedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(await withTasksAttachments(tasks, req));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching tasks" });
  }
};

export const getTasksByDeveloper = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { developerId } = req.params;

    if (isDeveloper(req.user.role) && req.user.id !== developerId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const tasks = await prisma.task.findMany({
      where: { assignedToId: developerId },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        updatedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(await withTasksAttachments(tasks, req));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching tasks" });
  }
};

export const updateTaskDetails = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { title, description, priority, dueDate, assignedToId, attachments } = req.body;
    const user = req.user;

    if (!isManager(user.role)) {
      return res.status(403).json({ message: "Only HR and Team Lead can edit task details" });
    }

    const existingTask = await prisma.task.findUnique({ where: { id } });

    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ message: "Invalid priority" });
    }

    const parsedAttachments = parseAttachments(attachments);

    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee || !assignee.isActive || !isDeveloper(assignee.role)) {
        return res.status(400).json({ message: "Tasks can only be assigned to developers" });
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title?.trim() || existingTask.title,
        description: description?.trim() || existingTask.description,
        attachments: parsedAttachments ?? existingTask.attachments,
        priority: priority || existingTask.priority,
        dueDate: dueDate === undefined ? existingTask.dueDate : parseOptionalDate(dueDate),
        assignedToId: assignedToId || existingTask.assignedToId,
        updatedById: user.id,
      },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        updatedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (assignedToId && assignedToId !== existingTask.assignedToId) {
      await runSideEffect("TASK_REASSIGNED notification", () =>
        createNotification(assignedToId, `New task assigned: ${updatedTask.title}`, NotificationType.TASK_ASSIGNED)
      );
    }

    await runSideEffect("TASK_UPDATED audit log", () =>
      createAuditLog(
        "TASK_UPDATED",
        user.id,
        id,
        {
          before: {
            title: existingTask.title,
            description: existingTask.description,
            priority: existingTask.priority,
            dueDate: existingTask.dueDate,
            assignedToId: existingTask.assignedToId,
          },
          after: {
            title: updatedTask.title,
            description: updatedTask.description,
            priority: updatedTask.priority,
            dueDate: updatedTask.dueDate,
            assignedToId: updatedTask.assignedToId,
          },
        },
        "Task"
      )
    );

    res.json(await withTaskAttachments(updatedTask, req));
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Error updating task";
    res.status(message.includes("Due date") || message.includes("Attachments") ? 400 : 500).json({ message });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    if (!isHr(req.user.role)) {
      return res.status(403).json({ message: "Only HR can delete tasks" });
    }

    const existingTask = await prisma.task.findUnique({ where: { id } });

    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    await prisma.task.delete({ where: { id } });
    await createAuditLog(
      "TASK_DELETED",
      req.user.id,
      id,
      {
        title: existingTask.title,
        assignedToId: existingTask.assignedToId,
      },
      "Task"
    );

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting task" });
  }
};

export const uploadTaskAttachment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { taskId, fileName, mimeType, contentBase64 } = req.body as {
      taskId?: string;
      fileName?: string;
      mimeType?: string;
      contentBase64?: string;
    };

    if (!taskId || !fileName?.trim() || !contentBase64?.trim()) {
      return res.status(400).json({ message: "Task, file name, and file content are required" });
    }

    const normalizedMimeType = mimeType?.trim() || "application/octet-stream";

    if (!isAttachmentAllowed(fileName, normalizedMimeType)) {
      return res.status(400).json({ message: "Only PDF, DOC, and DOCX files are allowed" });
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (isDeveloper(req.user.role)) {
      if (task.assignedToId !== req.user.id) {
        return res.status(403).json({ message: "Only the assigned developer can upload task files" });
      }

      const uploadableStatuses: TaskStatus[] = [TaskStatus.IN_PROGRESS, TaskStatus.NEEDS_REVISION];

      if (!uploadableStatuses.includes(task.status)) {
        return res.status(400).json({ message: "Files can only be uploaded while the task is in progress or under revision" });
      }
    } else if (!isManager(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const fileBuffer = Buffer.from(contentBase64, "base64");

    if (!fileBuffer.length) {
      return res.status(400).json({ message: "Uploaded file is empty" });
    }

    const safeExtension = path.extname(fileName).toLowerCase() || ".bin";
    const storedFileName = `${randomUUID()}${safeExtension}`;
    const uploadsDirectory = getTaskAttachmentsDirectory(task.id);
    await fs.mkdir(uploadsDirectory, { recursive: true });

    const filePath = path.join(uploadsDirectory, storedFileName);
    await fs.writeFile(filePath, fileBuffer);

    const attachmentUrl = `${getBaseUrl(req)}/uploads/task-attachments/${task.id}/${encodeURIComponent(storedFileName)}`;

    res.status(201).json({
      message: "Task attachment uploaded",
      attachment: attachmentUrl,
      attachments: await getTaskAttachmentUrls(task.id, req),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to upload task file" });
  }
};

export const removeTaskAttachment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { attachmentUrl } = req.body as { attachmentUrl?: string };

    if (!id || !attachmentUrl?.trim()) {
      return res.status(400).json({ message: "Task id and attachment URL are required" });
    }

    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!canManageTaskAttachments(req.user, task)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const normalizedAttachmentUrl = attachmentUrl.trim();
    let removedAnyAttachment = false;

    if (task.attachments.includes(normalizedAttachmentUrl)) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          attachments: task.attachments.filter((entry) => entry !== normalizedAttachmentUrl),
          updatedById: req.user.id,
        },
      });
      removedAnyAttachment = true;
    }

    const fileName = getAttachmentFileNameFromUrl(normalizedAttachmentUrl, task.id);

    if (fileName) {
      try {
        await fs.unlink(path.join(getTaskAttachmentsDirectory(task.id), fileName));
        removedAnyAttachment = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }

    if (!removedAnyAttachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const updatedTask = await getTaskWithRelations(task.id);
    res.json({
      message: "Attachment removed",
      task: updatedTask ? await withTaskAttachments(updatedTask, req) : updatedTask,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to remove task file" });
  }
};

export const updateTaskStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { status: rawStatus, id: bodyTaskId } = req.body as { status?: string; id?: string };
    const id = req.params.id || bodyTaskId;
    const user = req.user;
    const status = rawStatus?.trim().toUpperCase() as TaskStatus | undefined;

    if (!id) {
      return res.status(400).json({ message: "Task id is required" });
    }

    if (!status || !validTaskStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid task status" });
    }

    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const developerTransitions: Record<TaskStatus, TaskStatus[]> = {
      ASSIGNED: [TaskStatus.IN_PROGRESS],
      IN_PROGRESS: [TaskStatus.SUBMITTED],
      SUBMITTED: [],
      NEEDS_REVISION: [TaskStatus.IN_PROGRESS],
      REVIEWED: [],
      COMPLETED: [],
    };

    const managerTransitions: Record<TaskStatus, TaskStatus[]> = {
      ASSIGNED: [],
      IN_PROGRESS: [],
      SUBMITTED: [TaskStatus.REVIEWED, TaskStatus.NEEDS_REVISION],
      NEEDS_REVISION: [],
      REVIEWED: [TaskStatus.COMPLETED, TaskStatus.NEEDS_REVISION],
      COMPLETED: [],
    };

    if (isDeveloper(user.role)) {
      if (task.assignedToId !== user.id) {
        return res.status(403).json({ message: "Not your task" });
      }

      const developerAllowedStatuses: TaskStatus[] = [TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED];

      if (!developerAllowedStatuses.includes(status)) {
        return res.status(403).json({ message: "Invalid status update" });
      }

      if (!developerTransitions[task.status].includes(status)) {
        return res.status(400).json({
          message: `Invalid transition from ${task.status} to ${status}`,
        });
      }
    } else if (isManager(user.role)) {
      if (!managerTransitions[task.status].includes(status)) {
        if (status === TaskStatus.IN_PROGRESS || status === TaskStatus.SUBMITTED) {
          return res.status(403).json({ message: "Invalid status update" });
        }

        return res.status(400).json({
          message: `Invalid transition from ${task.status} to ${status}`,
        });
      }
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status, updatedById: user.id },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        updatedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (status === TaskStatus.SUBMITTED) {
      await notifyManagersAboutTaskSubmission(updatedTask);
    }

    if (status === TaskStatus.REVIEWED) {
      await runSideEffect("TASK_REVIEWED notification", () =>
        createNotification(task.assignedToId, `Task reviewed: ${task.title}`, NotificationType.TASK_REVIEWED)
      );
    }

    if (status === TaskStatus.NEEDS_REVISION) {
      await runSideEffect("TASK_NEEDS_REVISION notification", () =>
        createNotification(task.assignedToId, `Task marked needs revision: ${task.title}`, NotificationType.TASK_NEEDS_REVISION)
      );
    }

    if (status === TaskStatus.COMPLETED) {
      await runSideEffect("TASK_COMPLETED notification for assignee", () =>
        createNotification(task.assignedToId, `Task completed: ${task.title}`, NotificationType.TASK_COMPLETED)
      );
      await runSideEffect("TASK_COMPLETED notification for assigner", () =>
        createNotification(task.assignedById, `Task completed: ${task.title}`, NotificationType.TASK_COMPLETED)
      );
    }

    await runSideEffect("TASK_STATUS_CHANGED audit log", () =>
      createAuditLog(
        "TASK_STATUS_CHANGED",
        user.id,
        task.id,
        {
          from: task.status,
          to: status,
          label: formatLabel(status),
        },
        "Task"
      )
    );

    res.json(await withTaskAttachments(updatedTask, req));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating status" });
  }
};
